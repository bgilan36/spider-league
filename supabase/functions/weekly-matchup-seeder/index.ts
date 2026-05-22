import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import {
  buildPairings,
  type HistoryEntry,
  type PlayerInput,
} from "../_shared/matchup-engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ACTIVITY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

interface SeedSummary {
  surface: string;
  podId: string | null;
  paired: number;
  bye: string | null;
  skipped?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Resolve current season + week
    const nowIso = new Date().toISOString();
    const { data: season, error: seasonErr } = await supabase
      .from("seasons").select("id, current_week_number")
      .lte("start_date", nowIso).gte("end_date", nowIso)
      .order("start_date", { ascending: false }).limit(1).maybeSingle();
    if (seasonErr) throw seasonErr;
    if (!season) {
      return json({ success: false, error: "No active season" }, 200);
    }

    const { data: week, error: weekErr } = await supabase
      .from("weeks").select("id")
      .eq("season_id", season.id)
      .lte("start_date", nowIso).gte("end_date", nowIso)
      .order("start_date", { ascending: false }).limit(1).maybeSingle();
    if (weekErr) throw weekErr;
    if (!week) {
      return json({ success: false, error: "No active week" }, 200);
    }

    const summaries: SeedSummary[] = [];

    // 2. Public weekly league
    summaries.push(
      await seedSurface(supabase, {
        surface: "public",
        seasonId: season.id,
        weekId: week.id,
        podId: null,
      }),
    );

    // 3. Each active private pod
    const { data: pods } = await supabase
      .from("private_leagues").select("id").eq("is_active", true);
    for (const pod of pods ?? []) {
      summaries.push(
        await seedSurface(supabase, {
          surface: "pod",
          seasonId: season.id,
          weekId: week.id,
          podId: pod.id,
        }),
      );
    }

    return json({ success: true, weekId: week.id, summaries });
  } catch (err: any) {
    console.error("weekly-matchup-seeder error:", err);
    return json({ error: "Internal error" }, 500);
  }
});

async function seedSurface(
  supabase: ReturnType<typeof createClient>,
  ctx: {
    surface: "public" | "pod";
    seasonId: string;
    weekId: string;
    podId: string | null;
  },
): Promise<SeedSummary> {
  // Idempotency: skip if matchups already exist for this surface+week
  const existingQ = supabase
    .from("matchups").select("id", { count: "exact", head: true })
    .eq("week_id", ctx.weekId);
  const { count: existing } = ctx.podId
    ? await existingQ.eq("pod_league_id", ctx.podId)
    : await existingQ.is("pod_league_id", null);
  if ((existing ?? 0) > 0) {
    return { surface: ctx.surface, podId: ctx.podId, paired: 0, bye: null, skipped: "already_seeded" };
  }

  // 1. Pull eligible user ids
  let userIds: string[] = [];
  if (ctx.podId) {
    const { data: members } = await supabase
      .from("private_league_members").select("user_id").eq("league_id", ctx.podId);
    userIds = (members ?? []).map((m: any) => m.user_id);
  } else {
    // Public: anyone with at least one approved spider currently eligible
    const { data: rows } = await supabase
      .from("spiders").select("owner_id")
      .eq("is_approved", true)
      .gt("eligible_until", new Date().toISOString());
    userIds = Array.from(new Set((rows ?? []).map((r: any) => r.owner_id)));
  }
  if (userIds.length < 2) {
    return { surface: ctx.surface, podId: ctx.podId, paired: 0, bye: userIds[0] ?? null, skipped: "not_enough_players" };
  }

  // 2. Build PlayerInput for each
  const cutoff = new Date(Date.now() - ACTIVITY_WINDOW_MS).toISOString();
  const [profilesRes, spidersRes, streaksRes, recentBattlesRes] = await Promise.all([
    supabase.from("profiles")
      .select("id, rating_elo, season_wins")
      .in("id", userIds),
    supabase.from("spiders")
      .select("owner_id, power_score, last_battled_at")
      .in("owner_id", userIds).eq("is_approved", true),
    supabase.from("login_streaks")
      .select("user_id, updated_at, last_login_date")
      .in("user_id", userIds),
    supabase.from("battle_challenges")
      .select("challenger_id, accepter_id, winner_id, created_at, status")
      .or(`challenger_id.in.(${userIds.join(",")}),accepter_id.in.(${userIds.join(",")})`)
      .gte("created_at", cutoff),
  ]);

  const profileById = new Map<string, any>((profilesRes.data ?? []).map((p: any) => [p.id, p]));

  // Top power per owner
  const topPower = new Map<string, number>();
  const lastBattle = new Map<string, number>();
  for (const s of spidersRes.data ?? []) {
    const cur = topPower.get(s.owner_id) ?? 0;
    if ((s.power_score ?? 0) > cur) topPower.set(s.owner_id, s.power_score);
    const t = s.last_battled_at ? new Date(s.last_battled_at).getTime() : 0;
    if (t > (lastBattle.get(s.owner_id) ?? 0)) lastBattle.set(s.owner_id, t);
  }

  const loginAt = new Map<string, number>();
  for (const r of streaksRes.data ?? []) {
    const t = r.updated_at ? new Date(r.updated_at).getTime() : 0;
    loginAt.set(r.user_id, t);
  }

  // Weekly W-L from this week's resolved challenges
  const weeklyWins = new Map<string, number>();
  const weeklyLosses = new Map<string, number>();
  for (const c of recentBattlesRes.data ?? []) {
    if (c.status !== "RESOLVED" && c.status !== "ACCEPTED") continue;
    if (!c.winner_id) continue;
    const loserId = c.winner_id === c.challenger_id ? c.accepter_id : c.challenger_id;
    weeklyWins.set(c.winner_id, (weeklyWins.get(c.winner_id) ?? 0) + 1);
    if (loserId) weeklyLosses.set(loserId, (weeklyLosses.get(loserId) ?? 0) + 1);
  }

  const players: PlayerInput[] = userIds.map((uid) => {
    const prof = profileById.get(uid);
    return {
      userId: uid,
      power: topPower.get(uid) ?? 0,
      elo: prof?.rating_elo ?? 1000,
      weeklyWins: weeklyWins.get(uid) ?? 0,
      weeklyLosses: weeklyLosses.get(uid) ?? 0,
      seasonWins: prof?.season_wins ?? 0,
      lastActiveAt: Math.max(loginAt.get(uid) ?? 0, lastBattle.get(uid) ?? 0),
    };
  });

  // 3. Activity gating (public surface only — pods always include everyone)
  const cutoffMs = Date.now() - ACTIVITY_WINDOW_MS;
  const activePlayers = ctx.podId
    ? players
    : players.filter((p) => p.lastActiveAt >= cutoffMs);

  if (activePlayers.length < 2) {
    return { surface: ctx.surface, podId: ctx.podId, paired: 0, bye: null, skipped: "not_enough_active" };
  }

  // 4. Last 4 weeks of pairings for rematch history
  const { data: histRows } = await supabase
    .from("matchups").select("user_a_id, user_b_id, week_id, created_at")
    .in("user_a_id", activePlayers.map((p) => p.userId))
    .order("created_at", { ascending: false }).limit(500);
  const fourWeeksAgo = Date.now() - 28 * 24 * 60 * 60 * 1000;
  const history: HistoryEntry[] = (histRows ?? [])
    .filter((m: any) => new Date(m.created_at).getTime() >= fourWeeksAgo)
    .map((m: any) => ({
      userA: m.user_a_id,
      userB: m.user_b_id,
      weeksAgo: Math.max(1, Math.floor((Date.now() - new Date(m.created_at).getTime()) / (7 * 24 * 60 * 60 * 1000))),
    }));

  // 5. Run engine
  const { pairings, bye } = buildPairings(activePlayers, history);

  // 6. Insert (upsert via unique index → ignore conflicts)
  if (pairings.length > 0) {
    const rows = pairings.map((p) => ({
      season_id: ctx.seasonId,
      week_id: ctx.weekId,
      pod_league_id: ctx.podId,
      user_a_id: p.userA,
      user_b_id: p.userB,
      team_a: [],
      team_b: [],
    }));
    const { error: insertErr } = await supabase
      .from("matchups").upsert(rows, {
        onConflict: "week_id,pod_league_id,user_a_id,user_b_id",
        ignoreDuplicates: true,
      });
    if (insertErr) {
      console.error(`insert error for ${ctx.surface}/${ctx.podId}:`, insertErr);
    }
  }

  return { surface: ctx.surface, podId: ctx.podId, paired: pairings.length, bye };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}