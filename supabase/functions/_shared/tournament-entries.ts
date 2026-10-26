import { TOURNAMENT } from "./tournament-config.ts";

export interface FreshSpider { id: string; owner_id: string; power_score: number }
export interface EntryChoice { spider_id: string; user_id: string; is_veteran: boolean }

/** Shared by lock and preview: valid choices, otherwise strongest fresh catches. */
export function selectFreshEntries<T extends FreshSpider>(fresh: T[], choices: EntryChoice[]): T[] {
  const byOwner = new Map<string, T[]>();
  for (const s of fresh) byOwner.set(s.owner_id, [...(byOwner.get(s.owner_id) ?? []), s]);
  return [...byOwner].flatMap(([uid, spiders]) => {
    const ids = new Set(spiders.map((s) => s.id));
    const chosen = new Set(choices.filter((e) => e.user_id === uid && !e.is_veteran && ids.has(e.spider_id)).map((e) => e.spider_id));
    const pick = chosen.size ? spiders.filter((s) => chosen.has(s.id)) : [...spiders].sort((a, b) => b.power_score - a.power_score);
    return pick.slice(0, TOURNAMENT.MAX_ENTRIES_PER_USER);
  });
}