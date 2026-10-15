import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { TOURNAMENT } from "../_shared/tournament-config.ts";
import { localParts, weekLabel, weekWindow } from "../_shared/tournament-engine.ts";
import { ensureOpenWeek, log, runPipeline } from "./pipeline.ts";
import { previewTest, sendFridayNudges, sendTest, sendWeeklyResults } from "./emails.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const db = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function requireAdmin(req: Request, admin: ReturnType<typeof db>) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data } = await admin.auth.getUser(token);
  const uid = data.user?.id;
  if (!uid) return null;
  const { data: role } = await admin.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
  return role ? uid : null;
}

/** Hourly: close and publish overdue weeks, send pending emails, Friday nudges, open next week. Idempotent. */
async function tick(admin: ReturnType<typeof db>) {
  const now = new Date();
  const out: any = { processed: [] };
  const { data: due } = await admin.from("game_weeks").select("id")
    .eq("is_test", false).neq("status", "published").lte("locks_at", now.toISOString()).order("locks_at");
  for (const w of due ?? []) {
    await runPipeline(admin, w.id);
    out.processed.push(w.id);
  }
  const open = await ensureOpenWeek(admin, now);
  out.openWeek = open.id;

  // Results emails for weeks published in the last 3 days (resumes partial sends).
  const since = new Date(now.getTime() - 3 * 86400000).toISOString();
  const { data: recent } = await admin.from("game_weeks").select("*").eq("is_test", false).eq("status", "published").gte("published_at", since);
  for (const w of recent ?? []) out[`email_${w.id}`] = await sendWeeklyResults(admin, w);

  // Friday 9am local nudge.
  const lp = localParts(now);
  if (lp.dow === TOURNAMENT.NUDGE_DOW && lp.h === TOURNAMENT.NUDGE_HOUR) {
    const { data: wk } = await admin.from("game_weeks").select("*").eq("id", open.id).single();
    out.nudges = await sendFridayNudges(admin, wk);
  }
  return out;
}

function testWeekId(realId: string) { return `TEST-${realId}`; }

async function resetTest(admin: ReturnType<typeof db>) {
  const real = weekWindow(new Date());
  await admin.from("game_weeks").delete().eq("id", testWeekId(real.id));
  await log(admin, testWeekId(real.id), "reset_test", "ok");
  return testWeekId(real.id);
}

const unsubPage = (msg: string) => new Response(
  `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Spider League</title><body style="font-family:system-ui;background:#0b0f14;color:#e8eef5;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center"><div><div style="font-size:40px">🕷️</div><h1 style="font-size:22px">${msg}</h1><p style="color:#9aa5b1">You can turn emails back on any time in Settings.</p><a href="${TOURNAMENT.SITE_URL}" style="color:#7dd3a8">Back to Spider League</a></div></body>`,
  { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } },
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const admin = db();
  const url = new URL(req.url);

  // One-click unsubscribe — works without logging in (GET from email link, POST from mail clients).
  if (url.searchParams.get("action") === "unsubscribe") {
    const token = url.searchParams.get("token") ?? "";
    const kind = url.searchParams.get("kind") ?? "all";
    if (!/^[0-9a-f-]{36}$/i.test(token) || !["weekly_results", "friday_nudge", "all"].includes(kind)) return unsubPage("That link isn't valid.");
    const { data } = await admin.rpc("unsubscribe_email", { p_token: token, p_kind: kind });
    if (!data?.ok) return unsubPage("We couldn't find that subscription.");
    return unsubPage(kind === "weekly_results" ? "You're unsubscribed from weekly results." : kind === "friday_nudge" ? "Friday reminders are off." : "You're unsubscribed from all Spider League emails.");
  }

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = body.action ?? url.searchParams.get("action") ?? "tick";

    if (action === "tick") return json({ ok: true, ...(await tick(admin)) });

    if (action === "store_cup_card") {
      // Any signed-in player can provide the cup preview image once; the server stores it at a fixed path.
      const token = req.headers.get("Authorization")?.replace("Bearer ", "");
      const { data: u } = token ? await admin.auth.getUser(token) : { data: { user: null } };
      if (!u?.user) return json({ error: "Sign in required" }, 401);
      const weekId = String(body.week_id ?? "");
      if (!/^\d{4}-W\d{2}$/.test(weekId)) return json({ error: "Bad week" }, 400);
      const { data: wk } = await admin.from("game_weeks").select("status").eq("id", weekId).maybeSingle();
      if (wk?.status !== "published") return json({ error: "Not published" }, 400);
      const path = `cup-cards/${weekId}-v1.png`;
      const { data: existing } = await admin.storage.from("spiders").list("cup-cards", { search: `${weekId}-v1.png` });
      if (existing?.length) return json({ ok: true, existed: true });
      const bytes = Uint8Array.from(atob(String(body.png ?? "")), (c) => c.charCodeAt(0));
      if (bytes.length < 1000 || bytes.length > 3_000_000 || bytes[0] !== 0x89 || bytes[1] !== 0x50) return json({ error: "Bad image" }, 400);
      await admin.storage.from("spiders").upload(path, bytes, { contentType: "image/png", upsert: false });
      return json({ ok: true });
    }

    const adminId = await requireAdmin(req, admin);
    if (!adminId) return json({ error: "Admins only" }, 403);

    switch (action) {
      case "run_test": {
        const id = await resetTest(admin);
        const real = await ensureOpenWeek(admin);
        const { data: realWeek } = await admin.from("game_weeks").select("*").eq("id", real.id).single();
        await admin.from("game_weeks").insert({
          id, starts_at: realWeek.starts_at, locks_at: new Date().toISOString(), status: "open", is_test: true,
          display_name: `Test · ${weekLabel(realWeek.starts_at, realWeek.display_name)}`,
        });
        const week = await runPipeline(admin, id, real.id);
        return json({ ok: true, week });
      }
      case "reset_test": return json({ ok: true, deleted: await resetTest(admin) });
      case "set_display_name": {
        const name = typeof body.display_name === "string" ? body.display_name.trim().slice(0, 60) : "";
        if (typeof body.week_id !== "string") return json({ error: "week_id required" }, 400);
        await admin.from("game_weeks").update({ display_name: name || null }).eq("id", body.week_id);
        return json({ ok: true });
      }
      case "run_now": {
        // Force-run the pipeline for an overdue real week (same as the hourly job).
        return json({ ok: true, ...(await tick(admin)) });
      }
      case "send_test_results":
      case "send_test_nudge":
      case "preview_test_results":
      case "preview_test_nudge": {
        const kind = action.endsWith("results") ? "weekly_results" : "friday_nudge";
        let week: any;
        if (kind === "weekly_results") {
          const { data } = await admin.from("game_weeks").select("*").eq("status", "published").order("published_at", { ascending: false }).limit(1).maybeSingle();
          week = data;
          if (!week) return json({ error: "No published week yet — run a test week first." }, 400);
        } else {
          const open = await ensureOpenWeek(admin);
          week = (await admin.from("game_weeks").select("*").eq("id", open.id).single()).data;
        }
        if (action.startsWith("preview")) {
          const m = await previewTest(admin, kind, week, adminId);
          return json({ ok: true, week: week.id, subject: m.subject, html: m.html });
        }
        try {
          return json({ ok: true, week: week.id, ...(await sendTest(admin, kind, week, adminId)) });
        } catch (e) {
          return json({ ok: false, error: String((e as Error).message ?? e) }, 200);
        }
      }
      default: return json({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    console.error("weekly-tournament error", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
