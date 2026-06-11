import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  SPECIES_DEX, TOTAL_DEX_SPECIES, matchSpeciesSlug, getDexSpecies,
  type DexSpecies,
} from "./species";

export interface CollectedRow {
  user_id: string;
  species_slug: string;
  common_name: string;
  first_caught_at: string;
  first_spider_id: string;
  best_spider_id: string;
  best_power: number;
  count: number;
}

export interface SpiderLite {
  id: string;
  owner_id: string;
  nickname: string;
  species: string;
  image_url: string;
  power_score: number;
  rarity: string;
  hit_points: number;
  damage: number;
  speed: number;
  defense: number;
  venom: number;
  webcraft: number;
  created_at: string | null;
  eligible_until: string | null;
}

export interface DexEntry {
  species: DexSpecies | null;          // null means "wild catch" (unknown to dex)
  slug: string;                        // canonical slug or raw fallback
  commonName: string;
  caught: boolean;
  count: number;
  bestPower: number;
  bestSpider: SpiderLite | null;
  retired: boolean;                    // all of user's catches are past eligible_until
  catches: SpiderLite[];
}

export interface SpeciesProgress {
  loading: boolean;
  entries: DexEntry[];                 // dex entries (always TOTAL_DEX_SPECIES of these)
  wildEntries: DexEntry[];             // unmatched/exotic species the user has caught
  caughtCount: number;
  totalCanon: number;
  distinctEver: number;
  totalCatches: number;
  retiredMemorials: number;
}

/**
 * Loads every spider this user has ever owned (active + retired) and
 * groups them by canonical SpiderDex slug. Active spiders take priority
 * for the dex card photo; retired ones still count + show in the modal.
 */
export function useSpeciesProgress(userId: string | null): SpeciesProgress {
  const [spiders, setSpiders] = useState<SpiderLite[]>([]);
  const [collected, setCollected] = useState<CollectedRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!userId) { setLoading(false); return; }
    setLoading(true);

    (async () => {
      const [{ data: spiderRows }, { data: collectedRows }] = await Promise.all([
        supabase.from("spiders")
          .select("id,owner_id,nickname,species,image_url,power_score,rarity,hit_points,damage,speed,defense,venom,webcraft,created_at,eligible_until")
          .eq("owner_id", userId)
          .eq("is_approved", true)
          .order("power_score", { ascending: false }),
        (supabase.from as any)("species_collected")
          .select("*")
          .eq("user_id", userId),
      ]);
      if (cancelled) return;
      setSpiders((spiderRows as SpiderLite[]) || []);
      setCollected((collectedRows as CollectedRow[]) || []);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [userId]);

  return useMemo(() => {
    // Bucket every spider by canonical slug (or by raw species for wild catches).
    const buckets = new Map<string, { slug: string; commonName: string; species: DexSpecies | null; list: SpiderLite[] }>();
    for (const s of spiders) {
      const slug = matchSpeciesSlug(s.species);
      const key = slug ?? `wild:${(s.species || "Unknown").trim().toLowerCase()}`;
      const def = slug ? getDexSpecies(slug)! : null;
      const commonName = def?.commonName ?? (s.species || "Unknown").trim();
      const bucket = buckets.get(key) ?? { slug: key, commonName, species: def, list: [] };
      bucket.list.push(s);
      buckets.set(key, bucket);
    }

    const now = Date.now();
    const buildEntry = (def: DexSpecies | null, slug: string, commonName: string, list: SpiderLite[]): DexEntry => {
      const sorted = [...list].sort((a, b) => b.power_score - a.power_score);
      const best = sorted[0] ?? null;
      const retired = sorted.length > 0 && sorted.every(
        (s) => !!s.eligible_until && new Date(s.eligible_until).getTime() < now,
      );
      return {
        species: def,
        slug,
        commonName,
        caught: sorted.length > 0,
        count: sorted.length,
        bestPower: best?.power_score ?? 0,
        bestSpider: best,
        retired,
        catches: sorted,
      };
    };

    // One entry per canonical species (caught or not)
    const entries: DexEntry[] = SPECIES_DEX.map((def) => {
      const bucket = buckets.get(def.slug);
      return buildEntry(def, def.slug, def.commonName, bucket?.list ?? []);
    });

    // Wild catches: everything in buckets keyed by "wild:..."
    const wildEntries: DexEntry[] = [];
    for (const [key, b] of buckets.entries()) {
      if (!key.startsWith("wild:")) continue;
      wildEntries.push(buildEntry(null, key, b.commonName, b.list));
    }
    wildEntries.sort((a, b) => b.bestPower - a.bestPower);

    const caughtCount = entries.filter((e) => e.caught).length;
    const totalCatches = spiders.length;
    const retiredMemorials = entries.concat(wildEntries).filter((e) => e.retired).length;
    const distinctEver = entries.filter((e) => e.caught).length + wildEntries.length
      || collected.length; // fall back to server count if spiders haven't loaded yet

    return {
      loading,
      entries,
      wildEntries,
      caughtCount,
      totalCanon: TOTAL_DEX_SPECIES,
      distinctEver,
      totalCatches,
      retiredMemorials,
    };
  }, [spiders, collected, loading]);
}