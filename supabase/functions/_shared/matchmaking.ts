// Shared, server-authoritative matchmaking for training battles.
// Used by battle-start (preview + create) and quick-battle so the
// opponent shown in a preview is exactly the one that enters the arena.

export const COOLDOWN_MS = 4 * 60 * 60 * 1000;
const BANDS = [0.12, 0.2, 0.35, 0.55, 1.0];

export async function isDemoUser(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("is_demo").eq("id", userId).maybeSingle();
  return !!data?.is_demo;
}

async function demoOwnerSet(supabase: any, ownerIds: string[]): Promise<Set<string>> {
  if (ownerIds.length === 0) return new Set();
  const { data } = await supabase.from("profiles").select("id").in("id", ownerIds).eq("is_demo", true);
  return new Set((data || []).map((r: any) => r.id));
}

async function dropDemo(supabase: any, rows: any[]): Promise<any[]> {
  const demo = await demoOwnerSet(supabase, [...new Set(rows.map((r) => r.owner_id))] as string[]);
  return rows.filter((r) => !demo.has(r.owner_id));
}

export async function loadPlayerSpider(supabase: any, userId: string, spiderId: string | null) {
  const now = new Date().toISOString();
  const cutoff = new Date(Date.now() - COOLDOWN_MS).toISOString();
  let q = supabase.from("spiders").select("*")
    .eq("owner_id", userId).eq("is_approved", true).gt("eligible_until", now)
    .or(`last_battled_at.is.null,last_battled_at.lt.${cutoff}`);
  if (spiderId) q = q.eq("id", spiderId);
  const { data, error } = await q.order("power_score", { ascending: false }).limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

/** Returns null if valid, or a human reason why this opponent can't be used. */
export async function validateOpponent(
  supabase: any, userId: string, opponentSpiderId: string, leagueOwnerIds: string[] | null,
): Promise<{ opponent: any | null; reason: string | null }> {
  const { data } = await supabase.from("spiders").select("*").eq("id", opponentSpiderId).maybeSingle();
  if (!data) return { opponent: null, reason: "That opponent spider no longer exists." };
  if (data.owner_id === userId) return { opponent: null, reason: "That spider now belongs to you." };
  if (!data.is_approved) return { opponent: null, reason: "That opponent is no longer approved to battle." };
  if (!data.eligible_until || new Date(data.eligible_until) <= new Date()) {
    return { opponent: null, reason: "That opponent has retired from active duty." };
  }
  if (leagueOwnerIds && !leagueOwnerIds.includes(data.owner_id)) {
    return { opponent: null, reason: "That opponent is no longer in this pod." };
  }
  if (await isDemoUser(supabase, data.owner_id)) {
    return { opponent: null, reason: "That opponent is a demo spider." };
  }
  return { opponent: data, reason: null };
}

export async function pickOpponent(
  supabase: any, userId: string, player: any, leagueOwnerIds: string[] | null,
) {
  const now = new Date().toISOString();
  for (const pct of BANDS) {
    const low = Math.floor(player.power_score * (1 - pct));
    const high = Math.ceil(player.power_score * (1 + pct));
    let q = supabase.from("spiders").select("*")
      .eq("is_approved", true).neq("owner_id", userId).gt("eligible_until", now)
      .gte("power_score", low).lte("power_score", high);
    if (leagueOwnerIds) q = q.in("owner_id", leagueOwnerIds);
    const { data } = await q.limit(20);
    const pool = await dropDemo(supabase, data || []);
    if (pool.length > 0) return pool[Math.floor(Math.random() * pool.length)];
  }
  let q = supabase.from("spiders").select("*")
    .eq("is_approved", true).neq("owner_id", userId).gt("eligible_until", now);
  if (leagueOwnerIds) q = q.in("owner_id", leagueOwnerIds);
  const { data } = await q.order("power_score", { ascending: false }).limit(20);
  const pool = await dropDemo(supabase, data || []);
  return pool[0] ?? null;
}

/** Existing battle for an idempotency key (scoped to the caller). */
export async function findBattleByKey(supabase: any, userId: string, key: string | null) {
  if (!key) return null;
  const { data } = await supabase.from("battles").select("id, team_a").eq("idempotency_key", key).maybeSingle();
  if (data && (data.team_a as any)?.userId === userId) return data.id as string;
  return null;
}

/** An in-progress interactive battle already using this spider (resume instead of duplicating). */
export async function findActiveBattleForSpider(supabase: any, userId: string, spiderId: string) {
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase.from("battles").select("id, team_a")
    .eq("is_active", true).eq("mode", "interactive").gte("created_at", since)
    .contains("team_a", { userId, spider: { id: spiderId } })
    .order("created_at", { ascending: false }).limit(1);
  return data?.[0]?.id ?? null;
}

export function publicSpider(s: any) {
  if (!s) return null;
  const { latitude: _a, longitude: _b, location_accuracy_m: _c, rng_seed: _d, ...rest } = s;
  return rest;
}
