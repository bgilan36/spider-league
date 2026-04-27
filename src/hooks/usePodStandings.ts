import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PodTimeframe = "weekly" | "all_time";

export interface PodStanding {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  wins: number;
  losses: number;
  battles: number;
  win_rate: number;
  streak: number;
  power_diff?: number;
  top_spider: any;
}

interface CacheEntry {
  data: PodStanding[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 60 * 1000; // 1 minute fresh window
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<PodStanding[]>>();

const keyFor = (leagueId: string, timeframe: PodTimeframe) => `${leagueId}:${timeframe}`;

async function fetchStandings(leagueId: string, timeframe: PodTimeframe): Promise<PodStanding[]> {
  const k = keyFor(leagueId, timeframe);
  const existing = inflight.get(k);
  if (existing) return existing;
  const promise = (async () => {
    const { data } = await (supabase as any).rpc("get_private_league_standings", {
      league_id: leagueId,
      timeframe,
    });
    const list = (data || []) as PodStanding[];
    cache.set(k, { data: list, fetchedAt: Date.now() });
    return list;
  })().finally(() => {
    inflight.delete(k);
  });
  inflight.set(k, promise);
  return promise;
}

/** Bust cache for a league (all timeframes) so next read refetches. */
export function invalidatePodStandings(leagueId: string) {
  for (const k of Array.from(cache.keys())) {
    if (k.startsWith(`${leagueId}:`)) cache.delete(k);
  }
}

export function getCachedPodStandings(leagueId: string, timeframe: PodTimeframe) {
  return cache.get(keyFor(leagueId, timeframe))?.data ?? null;
}

/**
 * Stale-while-revalidate hook for private-league standings.
 * - Returns cached data immediately if present (no skeleton flash on tab switch).
 * - Refetches in background; `refreshing` is true during background revalidation.
 * - `loading` is only true when there is no cached data yet.
 */
export function usePodStandings(leagueId: string | null | undefined, timeframe: PodTimeframe) {
  const initial = leagueId ? getCachedPodStandings(leagueId, timeframe) : null;
  const [standings, setStandings] = useState<PodStanding[]>(initial ?? []);
  const [loading, setLoading] = useState<boolean>(!initial && !!leagueId);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(
    async (opts: { force?: boolean } = {}) => {
      if (!leagueId) {
        setStandings([]);
        setLoading(false);
        return;
      }
      const cached = getCachedPodStandings(leagueId, timeframe);
      const entry = cache.get(keyFor(leagueId, timeframe));
      const isFresh = entry ? Date.now() - entry.fetchedAt < CACHE_TTL_MS : false;

      if (cached) {
        setStandings(cached);
        setLoading(false);
        if (isFresh && !opts.force) return; // skip background fetch
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const list = await fetchStandings(leagueId, timeframe);
        if (!mountedRef.current) return;
        setStandings(list);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [leagueId, timeframe],
  );

  // Reload when key inputs change. Cached entry yields instant render, then SWR.
  useEffect(() => {
    if (!leagueId) return;
    const cached = getCachedPodStandings(leagueId, timeframe);
    setStandings(cached ?? []);
    setLoading(!cached);
    load();
  }, [leagueId, timeframe, load]);

  const refresh = useCallback(() => load({ force: true }), [load]);
  const invalidate = useCallback(() => {
    if (leagueId) invalidatePodStandings(leagueId);
  }, [leagueId]);

  return { standings, loading, refreshing, refresh, invalidate };
}