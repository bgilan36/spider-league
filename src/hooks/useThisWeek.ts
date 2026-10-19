import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { TOURNAMENT, type Bracket, type GameWeek, isFresh } from "@/lib/tournament";

export interface MySpider {
  id: string;
  nickname: string;
  species: string;
  image_url: string;
  power_score: number;
  rarity: string;
  created_at: string;
}

export interface PodActivity {
  podId: string;
  podName: string;
  members: { userId: string; name: string; entered: number }[];
}

const db = supabase as any;

/** Everything the Home "This Week" surface needs. */
export function useThisWeek() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [week, setWeek] = useState<GameWeek | null>(null);
  const [fresh, setFresh] = useState<MySpider[]>([]);
  const [veterans, setVeterans] = useState<MySpider[]>([]);
  const [entryIds, setEntryIds] = useState<string[]>([]);
  const [veteranId, setVeteranId] = useState<string | null>(null);
  const [explicit, setExplicit] = useState(false);
  const [pods, setPods] = useState<PodActivity[]>([]);
  const [unwatched, setUnwatched] = useState<GameWeek | null>(null);
  const [unwatchedBracket, setUnwatchedBracket] = useState<Bracket | null>(null);
  const [lastPublished, setLastPublished] = useState<GameWeek | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: weeks } = await db.from("game_weeks").select("*").eq("is_test", false).order("starts_at", { ascending: false }).limit(4);
    const all = (weeks ?? []) as GameWeek[];
    const open = all.find((w) => w.status === "open") ?? null;
    const published = all.find((w) => w.status === "published") ?? null;
    setWeek(open);
    setLastPublished(published);
    if (!user) { setLoading(false); return; }

    const [spRes, entRes, viewRes, memRes] = await Promise.all([
      db.from("spiders").select("id, nickname, species, image_url, power_score, rarity, created_at").eq("owner_id", user.id).order("power_score", { ascending: false }),
      open ? db.from("weekly_entries").select("spider_id, is_veteran").eq("week_id", open.id).eq("user_id", user.id) : Promise.resolve({ data: [] }),
      published ? db.from("result_views").select("reached_champion").eq("week_id", published.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
      db.from("private_league_members").select("league_id, private_leagues(name)").eq("user_id", user.id),
    ]);
    const mine = (spRes.data ?? []) as MySpider[];
    const f = mine.filter((s) => isFresh(s.created_at, open) && s.species !== TOURNAMENT.STARTER_SPECIES);
    setFresh(f);
    setVeterans(mine.filter((s) => !f.includes(s)));
    const ents = (entRes.data ?? []) as { spider_id: string; is_veteran: boolean }[];
    const chosen = ents.filter((e) => !e.is_veteran).map((e) => e.spider_id).filter((id) => f.some((s) => s.id === id));
    setExplicit(chosen.length > 0);
    setEntryIds(chosen.length ? chosen : f.slice(0, TOURNAMENT.MAX_ENTRIES_PER_USER).map((s) => s.id));
    setVeteranId(ents.find((e) => e.is_veteran)?.spider_id ?? null);
    const isUnwatched = published && !viewRes.data?.reached_champion;
    setUnwatched(isUnwatched ? published : null);
    if (isUnwatched) {
      const { data: gb } = await db.from("brackets").select("*").eq("week_id", published.id).eq("type", "global").maybeSingle();
      setUnwatchedBracket((gb as Bracket) ?? null);
    } else setUnwatchedBracket(null);

    // Pod activity
    const memberships = (memRes.data ?? []) as any[];
    const podIds = memberships.map((m) => m.league_id);
    if (podIds.length && open) {
      const { data: members } = await db.from("private_league_members").select("league_id, user_id, profiles(display_name)").in("league_id", podIds);
      const memberIds = [...new Set((members ?? []).map((m: any) => m.user_id))];
      const [{ data: theirFresh }, { data: theirEntries }] = await Promise.all([
        db.from("spiders").select("owner_id").in("owner_id", memberIds).gte("created_at", open.starts_at).lt("created_at", open.locks_at).neq("species", TOURNAMENT.STARTER_SPECIES),
        db.from("weekly_entries").select("user_id, is_veteran").eq("week_id", open.id).in("user_id", memberIds),
      ]);
      const freshCount = new Map<string, number>();
      for (const s of theirFresh ?? []) freshCount.set(s.owner_id, (freshCount.get(s.owner_id) ?? 0) + 1);
      const vets = new Set((theirEntries ?? []).filter((e: any) => e.is_veteran).map((e: any) => e.user_id));
      setPods(memberships.map((m) => ({
        podId: m.league_id,
        podName: m.private_leagues?.name ?? "Pod",
        members: (members ?? []).filter((x: any) => x.league_id === m.league_id).map((x: any) => ({
          userId: x.user_id,
          name: x.user_id === user.id ? "You" : x.profiles?.display_name ?? "Player",
          entered: Math.min(TOURNAMENT.MAX_ENTRIES_PER_USER, freshCount.get(x.user_id) ?? 0) || (vets.has(x.user_id) ? 1 : 0),
        })).sort((a: any, b: any) => b.entered - a.entered),
      })));
    } else setPods([]);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return { loading, week, fresh, veterans, entryIds, veteranId, explicit, pods, unwatched, unwatchedBracket, lastPublished, reload: load };
}

export function useCountdown(target: string | null | undefined) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!target) return null;
  const ms = Math.max(0, new Date(target).getTime() - now);
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  return { ms, d, h, m, s };
}
