import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { TOURNAMENT, roundName } from "../_shared/tournament-config.ts";
import { finishDepth, isLastWeekOfSeason, seasonIdFor, weekLabel, type Participant } from "../_shared/tournament-engine.ts";
import { log } from "./pipeline.ts";

type DB = SupabaseClient<any, "public", any>;
const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const BATCH = 80;

export function emailConfigured() {
  return !!Deno.env.get("LOVABLE_API_KEY") && !!Deno.env.get("RESEND_API_KEY");
}

async function sendEmail(to: string, subject: string, html: string, unsubUrl: string) {
  const res = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      "X-Connection-Api-Key": Deno.env.get("RESEND_API_KEY")!,
    },
    body: JSON.stringify({
      from: TOURNAMENT.EMAIL_FROM, to: [to], subject, html,
      headers: { "List-Unsubscribe": `<${unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    }),
  });
  if (!res.ok) throw new Error(`Resend [${res.status}]: ${await res.text()}`);
}

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const utm = (path: string, campaign: string) => `${TOURNAMENT.SITE_URL}${path}${path.includes("?") ? "&" : "?"}utm_source=email&utm_medium=email&utm_campaign=${campaign}`;

function unsubLink(token: string, kind: string) {
  const base = `${Deno.env.get("SUPABASE_URL")}/functions/v1/weekly-tournament?action=unsubscribe&token=${token}&kind=${kind}`;
  return base;
}

function shell(body: string, footer: string) {
  return `<!doctype html><html><body style="margin:0;background:#0b0f14;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e8eef5">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<div style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#7dd3a8;font-weight:700">🕷️ Spider League</div>
${body}
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #1f2933;font-size:12px;color:#7b8794;line-height:1.5">${footer}</div>
</div></body></html>`;
}
const h2 = (t: string) => `<h2 style="font-size:17px;margin:28px 0 10px;color:#fff">${t}</h2>`;
const button = (href: string, label: string) =>
  `<div style="margin:22px 0"><a href="${href}" style="display:block;text-align:center;background:#22c55e;color:#06210f;font-weight:800;font-size:16px;padding:14px 18px;border-radius:12px;text-decoration:none">${esc(label)}</a></div>`;

async function emailsFor(db: DB, ids: string[]) {
  const want = new Set(ids);
  const map = new Map<string, string>();
  for (let page = 1; page < 50 && map.size < want.size; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) if (want.has(u.id) && u.email) map.set(u.id, u.email);
    if (data.users.length < 1000) break;
  }
  return map;
}

async function settingsFor(db: DB, ids: string[]) {
  if (!ids.length) return new Map<string, any>();
  const { data } = await db.from("profile_settings").select("id, weekly_results_email, friday_reminder_email, unsubscribe_token").in("id", ids);
  const have = new Set((data ?? []).map((r: any) => r.id));
  const missing = ids.filter((i) => !have.has(i));
  let extra: any[] = [];
  if (missing.length) {
    const { data: ins } = await db.from("profile_settings").upsert(missing.map((id) => ({ id })), { onConflict: "id" })
      .select("id, weekly_results_email, friday_reminder_email, unsubscribe_token");
    extra = ins ?? [];
  }
  return new Map([...(data ?? []), ...extra].map((r: any) => [r.id, r]));
}

/** Build one user's weekly results email. */
export async function buildResultsEmail(db: DB, week: any, userId: string, token: string) {
  const { data: brackets } = await db.from("brackets").select("id, type, pod_id, size, participants, champion_participant_id, upset_match_id").eq("week_id", week.id);
  const label = weekLabel(week.starts_at, week.display_name);
  const resultsUrl = utm(`/week/${week.id}?tab=global`, `weekly_results_${week.id}`);
  const global = (brackets ?? []).find((b) => b.type === "global");
  const myPods = (brackets ?? []).filter((b) => b.type === "pod");
  const { data: memberRows } = await db.from("private_league_members").select("league_id").eq("user_id", userId);
  const mine = new Set((memberRows ?? []).map((m: any) => m.league_id));
  const pods = myPods.filter((b) => mine.has(b.pod_id));

  const allMatches = new Map<string, any[]>();
  for (const b of [global, ...pods].filter(Boolean)) {
    const { data } = await db.from("matches").select("id, round_number, slot, spider_a_id, spider_b_id, winner_id, is_upset, commentary").eq("bracket_id", b!.id).order("round_number");
    allMatches.set(b!.id, data ?? []);
  }

  // 1. My spiders
  const spiderLines: string[] = [];
  let bestStory: { score: number; subject: string } = { score: -1, subject: "This week's Spider League results are in" };
  const seen = new Set<string>();
  const describe = (b: any, isGlobal: boolean) => {
    const parts = b.participants as Participant[];
    const ms = allMatches.get(b.id) ?? [];
    const depth = finishDepth(ms.map((m: any) => ({ round_number: m.round_number, slot: m.slot, a: m.spider_a_id, b: m.spider_b_id, winner: m.winner_id, is_upset: m.is_upset, rounds: [], score: [0, 0], commentary: "" })));
    for (const p of parts.filter((x) => x.owner_id === userId)) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      const d = depth.get(p.id) ?? 0;
      const reached = b.size / Math.pow(2, d);
      const isChamp = b.champion_participant_id === p.id;
      let status: string;
      if (isGlobal && reached <= 2) status = "reached the Global Cup Final";
      else if (isChamp) status = "won the pod 🏆";
      else if (d === 0) status = `fell in the ${roundName(b.size)}`;
      else status = `made the ${roundName(reached)}`;
      const myMatches = ms.filter((m: any) => m.spider_a_id === p.id || m.spider_b_id === p.id);
      const last = myMatches[myMatches.length - 1];
      const hideLine = isGlobal && reached <= 2; // never reveal the Global Cup winner
      spiderLines.push(`<tr><td style="padding:8px 0;vertical-align:top;width:64px">${p.image_url ? `<img src="${esc(p.image_url)}" width="56" height="56" style="border-radius:10px;object-fit:cover;display:block" alt="">` : ""}</td>
<td style="padding:8px 0 8px 12px;vertical-align:top"><div style="font-weight:700;color:#fff">${esc(p.name)} <span style="font-weight:400;color:#9aa5b1">${esc(status)}${isGlobal ? " · Global Cup" : ""}</span></div>
${last?.commentary && !hideLine ? `<div style="font-size:14px;color:#cbd2d9;margin-top:4px">${esc(last.commentary)}</div>` : ""}</td></tr>`);
      const score = isChamp && !isGlobal ? 1000 : isGlobal ? 100 + d * 10 : d * 10;
      const subj = isChamp && !isGlobal ? "You won your pod! 🏆" : d === 0 ? bestStory.subject : `${p.name} made the ${isGlobal && reached <= 2 ? "Global Cup Final" : roundName(reached)} 🕷️`;
      if (score > bestStory.score && (d > 0 || (isChamp && !isGlobal))) bestStory = { score, subject: subj };
    }
  };
  for (const b of pods) describe(b, false);
  if (global) describe(global, true);

  // 2. Pods
  const seasonId = seasonIdFor(new Date(week.locks_at));
  const lastOfSeason = isLastWeekOfSeason(new Date(week.locks_at));
  const podBlocks: string[] = [];
  if (pods.length) {
    const podIds = pods.map((p) => p.pod_id);
    const [{ data: names }, { data: standings }] = await Promise.all([
      db.from("private_leagues").select("id, name").in("id", podIds),
      db.from("pod_season_standings").select("pod_id, user_id, points").eq("season_id", seasonId).in("pod_id", podIds),
    ]);
    const uids = [...new Set((standings ?? []).map((s: any) => s.user_id))];
    const { data: profs } = uids.length ? await db.from("profiles").select("id, display_name").in("id", uids) : { data: [] };
    const pname = new Map((profs ?? []).map((p: any) => [p.id, p.display_name ?? "Player"]));
    for (const b of pods) {
      const champ = (b.participants as Participant[]).find((p) => p.id === b.champion_participant_id);
      const rows = (standings ?? []).filter((s: any) => s.pod_id === b.pod_id).sort((a: any, c: any) => c.points - a.points);
      const myPos = rows.findIndex((r: any) => r.user_id === userId) + 1;
      const top = rows.slice(0, 3).map((r: any, i: number) => `${i + 1}. ${esc(pname.get(r.user_id))} · ${r.points} pts`).join("<br>");
      podBlocks.push(`<div style="background:#111821;border:1px solid #1f2933;border-radius:12px;padding:14px;margin-bottom:10px">
<div style="font-weight:800;color:#fff">${esc(names?.find((n: any) => n.id === b.pod_id)?.name ?? "Your pod")}</div>
<div style="font-size:14px;margin-top:6px">Champion: <b>${esc(champ?.name ?? "—")}</b>${champ?.owner_name ? ` (${esc(champ.owner_name)})` : champ?.is_wild ? " (Wild)" : ""}</div>
<div style="font-size:13px;color:#cbd2d9;margin-top:8px;line-height:1.6">${top || "No standings yet"}</div>
${myPos ? `<div style="font-size:13px;color:#7dd3a8;margin-top:6px">You're #${myPos} this season</div>` : ""}
${lastOfSeason && rows[0] ? `<div style="font-size:13px;color:#fbbf24;margin-top:6px">🏆 Season champion: ${esc(pname.get(rows[0].user_id))}</div>` : ""}
</div>`);
    }
  }

  // 3. Upset of the Week (never from the Global Cup final)
  let upsetHtml = "";
  for (const b of [global, ...pods].filter(Boolean)) {
    if (!b!.upset_match_id) continue;
    const m = (allMatches.get(b!.id) ?? []).find((x: any) => x.id === b!.upset_match_id);
    if (!m || (b!.type === "global" && m.round_number === Math.log2(b!.size))) continue;
    upsetHtml = `${h2("⚡ Upset of the Week")}<div style="font-size:15px;color:#e8eef5">${esc(m.commentary)}</div>`;
    break;
  }

  const hasGames = spiderLines.length > 0 || pods.length > 0;
  const cup = global
    ? `${h2("🏆 The Global Cup")}<div style="font-size:15px;line-height:1.5">${global.participants.length} spiders battled. A champion has been crowned — and we're not telling you who.</div>${button(resultsUrl, "See who won the Global Cup →")}`
    : button(utm(`/week/${week.id}`, `weekly_results_${week.id}`), "See this week's results →");
  const next = `<div style="font-size:15px;line-height:1.5;margin-top:20px">Next week is open. Entries lock ${TOURNAMENT.LOCK_LABEL}. <a href="${utm("/upload", `weekly_results_${week.id}`)}" style="color:#7dd3a8;font-weight:700">Go catch a contender.</a></div>`;

  const body = hasGames
    ? `<h1 style="font-size:24px;margin:10px 0 4px;color:#fff">${esc(label)} results</h1>
${spiderLines.length ? `${h2("Your spiders")}<table style="width:100%;border-collapse:collapse">${spiderLines.join("")}</table>` : ""}
${podBlocks.length ? `${h2("Your pods")}${podBlocks.join("")}` : ""}
${upsetHtml}${cup}${next}`
    : `<h1 style="font-size:24px;margin:10px 0 4px;color:#fff">${esc(label)}: the Global Cup is decided</h1>${cup}
<div style="font-size:15px;line-height:1.5">You didn't have a spider in this week's tournaments. Next week is open — entries lock ${TOURNAMENT.LOCK_LABEL}.</div>
${button(utm("/upload", `weekly_results_${week.id}`), "Catch a spider")}`;

  const unsub = unsubLink(token, "weekly_results");
  const footer = `You're getting this because weekly results emails are on. <a href="${unsub}" style="color:#9aa5b1">Unsubscribe from weekly results</a> · <a href="${unsubLink(token, "all")}" style="color:#9aa5b1">Unsubscribe from all</a>`;
  return { subject: hasGames ? bestStory.subject : "This week's Spider League results are in", html: shell(body, footer), unsub };
}

/** Friday nudge for one user. */
export async function buildNudgeEmail(db: DB, week: any, userId: string, token: string) {
  const { data: memberRows } = await db.from("private_league_members").select("league_id").eq("user_id", userId);
  const podIds = (memberRows ?? []).map((m: any) => m.league_id);
  let lines = "";
  if (podIds.length) {
    const [{ data: mates }, { data: pods }] = await Promise.all([
      db.from("private_league_members").select("league_id, user_id").in("league_id", podIds).neq("user_id", userId),
      db.from("private_leagues").select("id, name").in("id", podIds),
    ]);
    const mateIds = [...new Set((mates ?? []).map((m: any) => m.user_id))];
    if (mateIds.length) {
      const { data: fresh } = await db.from("spiders").select("owner_id").in("owner_id", mateIds).gte("created_at", week.starts_at).lt("created_at", week.locks_at);
      const counts = new Map<string, number>();
      for (const s of fresh ?? []) counts.set(s.owner_id, Math.min(TOURNAMENT.MAX_ENTRIES_PER_USER, (counts.get(s.owner_id) ?? 0) + 1));
      for (const p of pods ?? []) {
        const total = (mates ?? []).filter((m: any) => m.league_id === p.id).reduce((n: number, m: any) => n + (counts.get(m.user_id) ?? 0), 0);
        lines += `<div style="font-size:15px;margin:6px 0"><b>${esc(p.name)}</b>: your pod mates have entered ${total} spider${total === 1 ? "" : "s"}.</div>`;
      }
    }
  }
  const unsub = unsubLink(token, "friday_nudge");
  const body = `<h1 style="font-size:24px;margin:10px 0 8px;color:#fff">2 days left to catch a contender</h1>
<div style="font-size:15px;line-height:1.5">You haven't entered a spider this week. Entries lock ${TOURNAMENT.LOCK_LABEL}, and only this week's catches can enter the Global Cup.</div>
${lines}${button(utm("/upload", `friday_nudge_${week.id}`), "Catch a spider")}`;
  const footer = `You're getting this because Friday reminders are on. <a href="${unsub}" style="color:#9aa5b1">Turn off Friday reminders</a> · <a href="${unsubLink(token, "all")}" style="color:#9aa5b1">Unsubscribe from all</a>`;
  return { subject: "2 days left to catch a contender 🕷️", html: shell(body, footer), unsub };
}

async function realUserIds(db: DB): Promise<string[]> {
  const ids: string[] = [];
  for (let from = 0; from < 100000; from += 1000) {
    const { data } = await db.from("profiles").select("id").eq("is_demo", false).range(from, from + 999);
    ids.push(...(data ?? []).map((r: any) => r.id));
    if (!data || data.length < 1000) break;
  }
  return ids;
}

async function sendBatch(db: DB, weekId: string, kind: "weekly_results" | "friday_nudge", candidates: string[], build: (uid: string, token: string) => Promise<{ subject: string; html: string; unsub: string }>) {
  const { data: logged } = await db.from("email_log").select("user_id").eq("week_id", weekId).eq("kind", kind);
  const done = new Set((logged ?? []).map((r: any) => r.user_id));
  const pending = candidates.filter((id) => !done.has(id));
  const settings = await settingsFor(db, pending);
  const prefKey = kind === "weekly_results" ? "weekly_results_email" : "friday_reminder_email";
  const eligible = pending.filter((id) => settings.get(id)?.[prefKey] !== false).slice(0, BATCH);
  const emails = await emailsFor(db, eligible);
  let sent = 0, failed = 0;
  for (const uid of eligible) {
    const email = emails.get(uid);
    if (!email || email.startsWith("demo+")) continue;
    // Claim the unique slot first — guarantees at most one email per user per week.
    const { error: claimErr } = await db.from("email_log").insert({ user_id: uid, week_id: weekId, kind, status: "sending" });
    if (claimErr) continue;
    try {
      const msg = await build(uid, settings.get(uid).unsubscribe_token);
      await sendEmail(email, msg.subject, msg.html, msg.unsub);
      await db.from("email_log").update({ status: "sent", subject: msg.subject }).eq("user_id", uid).eq("week_id", weekId).eq("kind", kind);
      sent++;
    } catch (e) {
      failed++;
      await db.from("email_log").update({ status: "failed", error: String((e as Error).message ?? e).slice(0, 500) }).eq("user_id", uid).eq("week_id", weekId).eq("kind", kind);
    }
    await new Promise((r) => setTimeout(r, 550)); // stay under Resend's rate limit
  }
  const remaining = pending.length - eligible.length;
  await log(db, weekId, `email_${kind}`, failed ? "partial" : "ok", { sent, failed, remainingForNextRun: Math.max(0, remaining) });
  return { sent, failed };
}

export async function sendWeeklyResults(db: DB, week: any) {
  if (!emailConfigured()) { await log(db, week.id, "email_weekly_results", "skipped", { reason: "Resend not connected" }); return; }
  const ids = await realUserIds(db);
  return sendBatch(db, week.id, "weekly_results", ids, (uid, tok) => buildResultsEmail(db, week, uid, tok));
}

export async function nudgeCandidates(db: DB, week: any) {
  const since = new Date(new Date(week.starts_at).getTime() - TOURNAMENT.NUDGE_ACTIVE_WEEKS * 7 * 86400000).toISOString();
  const { data: recent } = await db.from("spiders").select("owner_id, created_at").gte("created_at", since);
  const active = new Set<string>(), freshNow = new Set<string>();
  for (const s of recent ?? []) {
    if (s.created_at >= week.starts_at) freshNow.add(s.owner_id); else active.add(s.owner_id);
  }
  const ids = [...active].filter((id) => !freshNow.has(id));
  if (!ids.length) return [];
  const { data: profs } = await db.from("profiles").select("id").in("id", ids).eq("is_demo", false);
  return (profs ?? []).map((p: any) => p.id);
}

export async function sendFridayNudges(db: DB, week: any) {
  if (!emailConfigured()) { await log(db, week.id, "email_friday_nudge", "skipped", { reason: "Resend not connected" }); return; }
  const ids = await nudgeCandidates(db, week);
  return sendBatch(db, week.id, "friday_nudge", ids, (uid, tok) => buildNudgeEmail(db, week, uid, tok));
}

/** Admin test: send to one address without touching email_log. */
export async function previewTest(db: DB, kind: "weekly_results" | "friday_nudge", week: any, userId: string) {
  const s = (await settingsFor(db, [userId])).get(userId);
  return kind === "weekly_results" ? await buildResultsEmail(db, week, userId, s.unsubscribe_token) : await buildNudgeEmail(db, week, userId, s.unsubscribe_token);
}

export async function sendTest(db: DB, kind: "weekly_results" | "friday_nudge", week: any, userId: string) {
  if (!emailConfigured()) throw new Error("Resend isn't connected yet");
  const s = (await settingsFor(db, [userId])).get(userId);
  const email = (await emailsFor(db, [userId])).get(userId);
  if (!email) throw new Error("No email on your account");
  const msg = kind === "weekly_results" ? await buildResultsEmail(db, week, userId, s.unsubscribe_token) : await buildNudgeEmail(db, week, userId, s.unsubscribe_token);
  await sendEmail(email, `[Test] ${msg.subject}`, msg.html, msg.unsub);
  return { to: email, subject: msg.subject };
}
