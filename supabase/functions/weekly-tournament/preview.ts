import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { TOURNAMENT, STAT_KEYS } from "../_shared/tournament-config.ts";
import { selectFreshEntries } from "../_shared/tournament-entries.ts";
import { applyVeteran, bracketSize, layoutBracket, type Participant } from "../_shared/tournament-engine.ts";

/** Paginate so the preview doesn't silently stop at PostgREST's row limit. */
async function allRows(query: any): Promise<any[]> {
  const rows: any[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await query.range(start, start + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) return rows;
  }
}

type DB = SupabaseClient<any, "public", any>;

async function openWeek(db: DB, weekId?: string) {
  let query = db.from("game_weeks").select("id, starts_at, locks_at, status, display_name").eq("is_test", false);
  query = weekId ? query.eq("id", weekId) : query.eq("status", "open").order("starts_at", { ascending: false }).limit(1);
  const { data: week, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  const closed = !!week && (week.status !== "open" || Date.now() >= new Date(week.locks_at).getTime());
  return { week, closed };
}

const COLS = "id, owner_id, nickname, species, image_url, power_score, hit_points, damage, speed, defense, venom, webcraft";

/** Same provisional field the lock step would freeze right now: fresh picks plus opted-in veterans (pods only). */
async function provisionalField(db: DB, week: any, withVeterans: boolean) {
  const [fresh, choices] = await Promise.all([
    allRows(db.from("spiders").select(COLS)
      .gte("created_at", week.starts_at).lt("created_at", week.locks_at).neq("is_approved", false).neq("species", TOURNAMENT.STARTER_SPECIES).order("id")),
    allRows(db.from("weekly_entries").select("spider_id, user_id, is_veteran").eq("week_id", week.id).order("id")),
  ]);
  const selected: any[] = selectFreshEntries(fresh, choices).map((s: any) => ({ ...s, veteran: false }));
  if (withVeterans) {
    const freshOwners = new Set(fresh.map((s: any) => s.owner_id));
    const vetChoices = choices.filter((c: any) => c.is_veteran && !freshOwners.has(c.user_id));
    for (let i = 0; i < vetChoices.length; i += 200) {
      const chunk = vetChoices.slice(i, i + 200);
      const vets = await allRows(db.from("spiders").select(COLS).in("id", chunk.map((c: any) => c.spider_id)).order("id"));
      for (const v of vets) if (chunk.some((c: any) => c.spider_id === v.id && c.user_id === v.owner_id)) selected.push({ ...v, veteran: true });
    }
  }
  const owners = [...new Set(selected.map((s) => s.owner_id))];
  const profiles: any[] = [];
  for (let i = 0; i < owners.length; i += 200) {
    profiles.push(...await allRows(db.from("profiles").select("id, display_name, is_demo").in("id", owners.slice(i, i + 200)).order("id")));
  }
  const prof = new Map(profiles.map((p) => [p.id, p]));
  return selected.filter((s) => prof.has(s.owner_id)).map((s) => {
    let stats = Object.fromEntries(STAT_KEYS.map((k) => [k, Number(s[k] ?? 0)])) as Participant["stats"];
    let power = s.power_score;
    if (s.veteran) ({ stats, power } = applyVeteran(stats, power));
    return {
      id: s.id, spider_id: s.id, owner_id: s.owner_id, owner_name: prof.get(s.owner_id)?.display_name ?? "Player",
      name: s.nickname, species: s.species, image_url: s.image_url, power, stats,
      is_wild: false, is_veteran: !!s.veteran, is_demo: !!prof.get(s.owner_id)?.is_demo,
    } as Participant & { is_demo: boolean };
  });
}

function bracketOf(participants: Participant[], avoidSameOwner: boolean) {
  const clean = participants.map(({ is_demo: _d, ...p }: any) => p as Participant);
  const size = clean.length >= TOURNAMENT.MIN_REAL_POD_ENTRIES ? bracketSize(clean.length, 2) : 0;
  return { participants: clean, size, slots: size ? layoutBracket(clean, size, avoidSameOwner) : [] };
}

/** Public, read-only field: no private profile fields, demo identities, or simulation. */
export async function previewGlobalCup(db: DB, weekId?: string) {
  const { week, closed } = await openWeek(db, weekId);
  if (!week) return { ok: true, week: null, participants: [], slots: [], size: 0 };
  if (closed) return { ok: true, week, participants: [], slots: [], size: 0, closed: true };
  const field = (await provisionalField(db, week, false)).filter((p) => !p.is_demo);
  const b = bracketOf(field, false);
  return { ok: true, week, ...b, updated_at: new Date().toISOString() };
}

/** Members-only: provisional bracket for each pod the caller belongs to, matching the pipeline's pod rules. */
export async function previewPods(db: DB, userId: string, weekId?: string) {
  const { week, closed } = await openWeek(db, weekId);
  if (!week || closed) return { ok: true, week, closed, pods: [] };
  const { data: mine } = await db.from("private_league_members").select("league_id").eq("user_id", userId);
  const podIds = (mine ?? []).map((m: any) => m.league_id);
  if (!podIds.length) return { ok: true, week, pods: [] };
  const [{ data: pods }, { data: members }, field] = await Promise.all([
    db.from("private_leagues").select("id, name").eq("is_active", true).in("id", podIds),
    db.from("private_league_members").select("league_id, user_id").in("league_id", podIds),
    provisionalField(db, week, true),
  ]);
  const out = (pods ?? []).map((pod: any) => {
    const mem = new Set((members ?? []).filter((m: any) => m.league_id === pod.id).map((m: any) => m.user_id));
    return { id: pod.id, name: pod.name, ...bracketOf(field.filter((p) => mem.has(p.owner_id)), true) };
  });
  return { ok: true, week, pods: out, updated_at: new Date().toISOString() };
}
