import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { STAT_KEYS, STAT_LABELS, TOURNAMENT } from "../_shared/tournament-config.ts";
import { selectFreshEntries } from "../_shared/tournament-entries.ts";
import {
  applyVeteran, bracketSize, finishDepth, makeWildChallengers, noCupReason, openWeekFor, podPoints,
  seasonIdFor, simulateBracket, type BracketResult, type Participant, type Stats,
} from "../_shared/tournament-engine.ts";

type DB = SupabaseClient<any, "public", any>;

export async function log(db: DB, weekId: string | null, step: string, status: string, detail: unknown = null) {
  console.log(`[weekly-tournament] ${weekId ?? "-"} ${step} ${status}`, detail ?? "");
  await db.from("tournament_pipeline_log").insert({ week_id: weekId, step, status, detail });
}

/** Make sure the week that should currently be open exists. */
export async function ensureOpenWeek(db: DB, now = new Date()) {
  const w = openWeekFor(now);
  const { data: existing } = await db.from("game_weeks").select("id").eq("id", w.id).maybeSingle();
  if (!existing) {
    await db.from("game_weeks").upsert({
      id: w.id, starts_at: w.startsAt.toISOString(), locks_at: w.locksAt.toISOString(), status: "open",
    }, { onConflict: "id", ignoreDuplicates: true });
    await log(db, w.id, "open_week", "ok");
  }
  return w;
}

const SPIDER_COLS = "id, owner_id, nickname, species, image_url, power_score, created_at, is_approved, hit_points, damage, speed, defense, venom, webcraft";

function statsOf(s: any): Stats {
  const o = {} as Stats;
  for (const k of STAT_KEYS) o[k] = Number(s[k] ?? 0);
  return o;
}

/** Step 1 — freeze entries. `explicitWeekId` is where players' choices live (differs for test weeks). */
export async function lockEntries(db: DB, week: any, explicitWeekId: string) {
  const start = week.starts_at, end = week.locks_at;
  const { data: fresh } = await db.from("spiders").select(SPIDER_COLS)
    .gte("created_at", start).lt("created_at", end).neq("is_approved", false).neq("species", TOURNAMENT.STARTER_SPECIES);
  const { data: explicit } = await db.from("weekly_entries").select("spider_id, user_id, is_veteran")
    .eq("week_id", explicitWeekId);

  const freshByUser = new Map<string, any[]>();
  for (const s of fresh ?? []) {
    if (!freshByUser.has(s.owner_id)) freshByUser.set(s.owner_id, []);
    freshByUser.get(s.owner_id)!.push(s);
  }
  const explicitByUser = new Map<string, any[]>();
  for (const e of explicit ?? []) {
    if (!explicitByUser.has(e.user_id)) explicitByUser.set(e.user_id, []);
    explicitByUser.get(e.user_id)!.push(e);
  }

  const rows: any[] = [];
  const frozenAt = new Date().toISOString();
  for (const s of selectFreshEntries(fresh ?? [], explicit ?? [])) {
    const chosen = (explicitByUser.get(s.owner_id) ?? []).some((e) => !e.is_veteran && (freshByUser.get(s.owner_id) ?? []).some((f) => f.id === e.spider_id));
    rows.push({ week_id: week.id, spider_id: s.id, user_id: s.owner_id, is_veteran: false, effective_power: s.power_score, is_auto: !chosen, frozen_at: frozenAt });
  }
  // Veterans: only players with zero fresh catches who opted in.
  const vetRows = (explicit ?? []).filter((e) => e.is_veteran && !freshByUser.has(e.user_id));
  if (vetRows.length) {
    const { data: vets } = await db.from("spiders").select("id, owner_id, power_score").in("id", vetRows.map((v) => v.spider_id));
    for (const v of vets ?? []) {
      const e = vetRows.find((r) => r.spider_id === v.id);
      if (!e || v.owner_id !== e.user_id) continue;
      rows.push({ week_id: week.id, spider_id: v.id, user_id: v.owner_id, is_veteran: true, effective_power: Math.round(v.power_score * TOURNAMENT.VETERAN_MULTIPLIER), is_auto: false, frozen_at: frozenAt });
    }
  }

  await db.from("weekly_entries").delete().eq("week_id", week.id);
  if (rows.length) {
    const { error } = await db.from("weekly_entries").insert(rows);
    if (error) throw new Error(`lock insert: ${error.message}`);
  }
  await db.from("game_weeks").update({ status: "locked" }).eq("id", week.id);
  await log(db, week.id, "lock_entries", "ok", { entries: rows.length, players: new Set(rows.map((r) => r.user_id)).size });
}

async function loadParticipants(db: DB, weekId: string) {
  const { data: entries } = await db.from("weekly_entries").select("spider_id, user_id, is_veteran, effective_power").eq("week_id", weekId);
  const ids = (entries ?? []).map((e) => e.spider_id);
  const userIds = [...new Set((entries ?? []).map((e) => e.user_id))];
  const [{ data: spiders }, { data: profiles }] = await Promise.all([
    ids.length ? db.from("spiders").select(SPIDER_COLS).in("id", ids) : Promise.resolve({ data: [] as any[] }),
    userIds.length ? db.from("profiles").select("id, display_name, is_demo").in("id", userIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const prof = new Map((profiles ?? []).map((p: any) => [p.id, p]));
  const sp = new Map((spiders ?? []).map((s: any) => [s.id, s]));
  const out: (Participant & { is_demo: boolean })[] = [];
  for (const e of entries ?? []) {
    const s = sp.get(e.spider_id);
    if (!s) continue;
    let stats = statsOf(s), power = s.power_score;
    if (e.is_veteran) ({ stats, power } = applyVeteran(stats, power));
    const p = prof.get(e.user_id);
    out.push({
      id: s.id, spider_id: s.id, owner_id: e.user_id, owner_name: p?.display_name ?? "Player",
      name: s.nickname, species: s.species, image_url: s.image_url, power, stats,
      is_wild: false, is_veteran: e.is_veteran, is_demo: !!p?.is_demo,
    });
  }
  return out;
}

async function wildSample(db: DB, real: Participant[]) {
  if (real.length >= TOURNAMENT.WILD_MIN_REAL_SAMPLE) return real.map((p) => ({ stats: p.stats, power: p.power }));
  const { data } = await db.from("spiders").select("power_score, hit_points, damage, speed, defense, venom, webcraft").neq("is_approved", false).limit(1000);
  return (data ?? []).map((s: any) => ({ stats: statsOf(s), power: s.power_score }));
}

async function writeRecap(result: BracketResult, label: string): Promise<string | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  const final = result.matches[result.matches.length - 1];
  if (!key || !final?.b) return null;
  const by = new Map(result.participants.map((p) => [p.id, p]));
  const a = by.get(final.a!)!, b = by.get(final.b)!;
  const w = by.get(final.winner)!;
  const rounds = final.rounds.map((r, i) => `Round ${i + 1}: ${STAT_LABELS[r.attribute]} — ${a.name} ${r.a_value} vs ${b.name} ${r.b_value}, won by ${r.winner === "a" ? a.name : b.name}`).join("\n");
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: TOURNAMENT.RECAP_MODEL,
        messages: [
          { role: "system", content: "You are a punchy sports commentator for Spider League, a game where real photographed spiders battle. Write a 2–3 sentence recap of a tournament final. Vivid, fun, family-friendly. No hashtags, no emojis, plain text." },
          { role: "user", content: `${label} final.\n${a.name} (${a.species}${a.is_wild ? ", a Wild Challenger" : `, owned by ${a.owner_name}`}) vs ${b.name} (${b.species}${b.is_wild ? ", a Wild Challenger" : `, owned by ${b.owner_name}`}).\n${rounds}\nChampion: ${w.name}, ${final.score[0]}–${final.score[1]}.` },
        ],
      }),
    });
    if (!res.ok) { console.error("recap failed", res.status, await res.text()); return null; }
    const j = await res.json();
    return (j.choices?.[0]?.message?.content ?? "").trim() || null;
  } catch (e) {
    console.error("recap error", e);
    return null;
  }
}

async function insertBracket(db: DB, weekId: string, type: "global" | "pod", podId: string | null, result: BracketResult, recap: string | null) {
  const { data: b, error } = await db.from("brackets").insert({
    week_id: weekId, type, pod_id: podId, size: result.size, participants: result.participants,
    champion_participant_id: result.champion.id, final_recap: recap, simulated_at: new Date().toISOString(),
  }).select("id").single();
  if (error) throw new Error(`bracket insert: ${error.message}`);
  const rows = result.matches.map((m) => ({
    bracket_id: b.id, round_number: m.round_number, slot: m.slot, spider_a_id: m.a, spider_b_id: m.b,
    winner_id: m.winner, is_upset: m.is_upset, rounds: m.rounds, commentary: m.commentary,
  }));
  const { data: inserted, error: mErr } = await db.from("matches").insert(rows).select("id, round_number, slot");
  if (mErr) throw new Error(`matches insert: ${mErr.message}`);
  if (result.upset) {
    const u = inserted?.find((r) => r.round_number === result.upset!.round_number && r.slot === result.upset!.slot);
    if (u) await db.from("brackets").update({ upset_match_id: u.id }).eq("id", b.id);
  }
  return b.id;
}

/** Steps 2+3 — build and simulate every bracket. Safe to re-run: clears this week's brackets first. */
export async function buildAndSimulate(db: DB, week: any) {
  await db.from("brackets").delete().eq("week_id", week.id);
  const all = await loadParticipants(db, week.id);
  const summary: any[] = [];

  // Global Cup: fresh catches from real (non-demo) players only.
  const globalReal = all.filter((p) => !p.is_veteran && !p.is_demo);
  // Real spiders only: bracket size = next power of two of real entries; top seeds get byes.
  if (globalReal.length >= 2) {
    const size = bracketSize(globalReal.length, 2);
    const wild: Participant[] = [];
    const result = simulateBracket(globalReal, size, `${week.id}:global`, false);
    const recap = await writeRecap(result, "Global Cup");
    await insertBracket(db, week.id, "global", null, result, recap);
    await db.from("game_weeks").update({ no_cup_reason: null }).eq("id", week.id);
    summary.push({ type: "global", real: globalReal.length, wild: wild.length, size });
  } else {
    await db.from("game_weeks").update({ no_cup_reason: noCupReason(globalReal.length) }).eq("id", week.id);
    await log(db, week.id, "global_cup_skipped", "ok", { real: globalReal.length });
  }

  // Pods
  const { data: pods } = await db.from("private_leagues").select("id, name").eq("is_active", true);
  const { data: members } = await db.from("private_league_members").select("league_id, user_id");
  const membersByPod = new Map<string, Set<string>>();
  for (const m of members ?? []) {
    if (!membersByPod.has(m.league_id)) membersByPod.set(m.league_id, new Set());
    membersByPod.get(m.league_id)!.add(m.user_id);
  }
  for (const pod of pods ?? []) {
    const mem = membersByPod.get(pod.id) ?? new Set();
    const real = all.filter((p) => p.owner_id && mem.has(p.owner_id));
    if (real.length < TOURNAMENT.MIN_REAL_POD_ENTRIES) continue;
    if (real.length < 2) continue;
    const size = bracketSize(real.length, 2);
    const wild: Participant[] = [];
    const result = simulateBracket(real, size, `${week.id}:${pod.id}`, true);
    const recap = await writeRecap(result, `${pod.name} pod`);
    await insertBracket(db, week.id, "pod", pod.id, result, recap);
    summary.push({ type: "pod", pod: pod.id, real: real.length, wild: wild.length, size });
  }

  await db.from("game_weeks").update({ status: "simulated" }).eq("id", week.id);
  await log(db, week.id, "simulate", "ok", { brackets: summary.length, summary });
}

/** Step 4 — publish: standings, trophies, champion. */
export async function publish(db: DB, week: any) {
  const { data: brackets } = await db.from("brackets").select("id, type, pod_id, participants, champion_participant_id").eq("week_id", week.id);
  const seasonId = seasonIdFor(new Date(week.locks_at));
  const trophyRows: any[] = [];
  const weekPoints: any[] = [];
  let globalChampion: string | null = null;

  for (const b of brackets ?? []) {
    const { data: ms } = await db.from("matches").select("round_number, slot, spider_a_id, spider_b_id, winner_id, is_upset, rounds").eq("bracket_id", b.id);
    const parts = b.participants as Participant[];
    const champ = parts.find((p) => p.id === b.champion_participant_id);
    if (b.type === "global") globalChampion = champ?.spider_id ?? null;
    if (champ?.spider_id && champ.owner_id) {
      trophyRows.push({ kind: b.type === "global" ? "global_cup" : "pod_champion", week_id: week.id, pod_id: b.pod_id, spider_id: champ.spider_id, user_id: champ.owner_id });
    }
    if (b.type === "pod") {
      const result = {
        participants: parts, champion: champ!, upset: null, size: parts.length,
        matches: (ms ?? []).map((m: any) => ({ round_number: m.round_number, slot: m.slot, a: m.spider_a_id, b: m.spider_b_id, winner: m.winner_id, is_upset: m.is_upset, rounds: m.rounds, score: [0, 0] as [number, number], commentary: "" })),
      } as BracketResult;
      const pts = podPoints(result);
      const depth = finishDepth(result.matches);
      const owners = new Set(parts.filter((p) => p.owner_id).map((p) => p.owner_id!));
      for (const uid of owners) {
        const best = Math.max(...parts.filter((p) => p.owner_id === uid).map((p) => depth.get(p.id) ?? 0));
        weekPoints.push({ week_id: week.id, pod_id: b.pod_id, user_id: uid, season_id: seasonId, points: pts.get(uid) ?? 0, finish: best, is_champion: champ?.owner_id === uid });
      }
    }
  }

  if (weekPoints.length) await db.from("pod_season_week_points").upsert(weekPoints, { onConflict: "week_id,pod_id,user_id" });
  if (!week.is_test) {
    for (const t of trophyRows) {
      const { error } = await db.from("trophies").insert(t);
      if (error && !String(error.message).includes("duplicate")) throw new Error(`trophy: ${error.message}`);
    }
    await recomputeSeason(db, seasonId);
  }
  await db.from("game_weeks").update({ status: "published", champion_spider_id: globalChampion, published_at: new Date().toISOString() }).eq("id", week.id);
  await log(db, week.id, "publish", "ok", { trophies: trophyRows.length, podRows: weekPoints.length, season: seasonId });
}

export async function recomputeSeason(db: DB, seasonId: string) {
  const { data: rows } = await db.from("pod_season_week_points").select("pod_id, user_id, points, finish, is_champion, game_weeks!inner(is_test)")
    .eq("season_id", seasonId).eq("game_weeks.is_test", false);
  const agg = new Map<string, any>();
  for (const r of rows ?? []) {
    const k = `${r.pod_id}:${r.user_id}`;
    const a = agg.get(k) ?? { season_id: seasonId, pod_id: r.pod_id, user_id: r.user_id, points: 0, best_finish: 0, championships: 0 };
    a.points += r.points;
    a.best_finish = Math.max(a.best_finish, r.finish ?? 0);
    a.championships += r.is_champion ? 1 : 0;
    agg.set(k, a);
  }
  if (agg.size) await db.from("pod_season_standings").upsert([...agg.values()].map((a) => ({ ...a, updated_at: new Date().toISOString() })), { onConflict: "season_id,pod_id,user_id" });
}

/** Full pipeline for one week; resumes from whatever status it's in. */
export async function runPipeline(db: DB, weekId: string, explicitWeekId?: string) {
  for (let i = 0; i < 4; i++) {
    const { data: week } = await db.from("game_weeks").select("*").eq("id", weekId).single();
    if (!week) throw new Error(`week ${weekId} missing`);
    try {
      if (week.status === "open") await lockEntries(db, week, explicitWeekId ?? week.id);
      else if (week.status === "locked") await buildAndSimulate(db, week);
      else if (week.status === "simulated") await publish(db, week);
      else return week;
    } catch (e) {
      await log(db, weekId, `step_${week.status}`, "error", { message: String((e as Error).message ?? e) });
      throw e;
    }
  }
}
