import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { TOURNAMENT, STAT_KEYS } from "../_shared/tournament-config.ts";
import { selectFreshEntries } from "../_shared/tournament-entries.ts";
import { bracketSize, layoutBracket, type Participant } from "../_shared/tournament-engine.ts";

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

/** Public, read-only field: no private profile fields, demo identities, or simulation. */
export async function previewGlobalCup(db: SupabaseClient<any, "public", any>, weekId?: string) {
  let query = db.from("game_weeks").select("id, starts_at, locks_at, status, display_name").eq("is_test", false);
  query = weekId ? query.eq("id", weekId) : query.eq("status", "open").order("starts_at", { ascending: false }).limit(1);
  const { data: week, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!week) return { ok: true, week: null, participants: [], slots: [], size: 0 };
  if (week.status !== "open" || Date.now() >= new Date(week.locks_at).getTime()) {
    return { ok: true, week, participants: [], slots: [], size: 0, closed: true };
  }
  const [fresh, choices] = await Promise.all([
    allRows(db.from("spiders").select("id, owner_id, nickname, species, image_url, power_score, hit_points, damage, speed, defense, venom, webcraft")
      .gte("created_at", week.starts_at).lt("created_at", week.locks_at).neq("is_approved", false).neq("species", TOURNAMENT.STARTER_SPECIES).order("id")),
    allRows(db.from("weekly_entries").select("spider_id, user_id, is_veteran").eq("week_id", week.id).order("id")),
  ]);
  const selected = selectFreshEntries(fresh, choices);
  const owners = [...new Set(selected.map((s) => s.owner_id))];
  const profiles: any[] = [];
  for (let i = 0; i < owners.length; i += 200) {
    profiles.push(...await allRows(db.from("profiles").select("id, display_name").eq("is_demo", false).in("id", owners.slice(i, i + 200)).order("id")));
  }
  const names = new Map(profiles.map((p) => [p.id, p.display_name]));
  const participants: Participant[] = selected.filter((s) => names.has(s.owner_id)).map((s) => ({
    id: s.id, spider_id: s.id, owner_id: s.owner_id, owner_name: names.get(s.owner_id) ?? "Player",
    name: s.nickname, species: s.species, image_url: s.image_url, power: s.power_score,
    stats: Object.fromEntries(STAT_KEYS.map((k) => [k, Number(s[k] ?? 0)])) as Participant["stats"],
    is_wild: false, is_veteran: false,
  }));
  const size = participants.length >= 2 ? bracketSize(participants.length, 2) : 0;
  const slots = size ? layoutBracket(participants, size, false) : [];
  return { ok: true, week, participants, slots, size, updated_at: new Date().toISOString() };
}