import { supabase } from "@/integrations/supabase/client";
export {
  TOURNAMENT, STAT_KEYS, STAT_LABELS, roundName,
} from "../../supabase/functions/_shared/tournament-config.ts";
export type { StatKey } from "../../supabase/functions/_shared/tournament-config.ts";
import { TOURNAMENT } from "../../supabase/functions/_shared/tournament-config.ts";

export interface GameWeek {
  id: string;
  starts_at: string;
  locks_at: string;
  status: "open" | "locked" | "simulated" | "published";
  champion_spider_id: string | null;
  display_name: string | null;
  is_test: boolean;
  published_at: string | null;
  no_cup_reason: string | null;
}

export interface Participant {
  id: string;
  spider_id: string | null;
  owner_id: string | null;
  owner_name: string | null;
  name: string;
  species: string;
  image_url: string | null;
  power: number;
  stats: Record<string, number>;
  is_wild: boolean;
  is_veteran: boolean;
  seed?: number;
}

export interface Bracket {
  id: string;
  week_id: string;
  type: "global" | "pod";
  pod_id: string | null;
  size: number;
  participants: Participant[];
  champion_participant_id: string | null;
  upset_match_id: string | null;
  final_recap: string | null;
}

export interface Match {
  id: string;
  bracket_id: string;
  round_number: number;
  slot: number;
  spider_a_id: string | null;
  spider_b_id: string | null;
  winner_id: string | null;
  is_upset: boolean;
  rounds: { attribute: string; a_value: number; b_value: number; winner: "a" | "b" }[];
  commentary: string | null;
}

/** "Week of Oct 26" (or the admin display name). Never ISO numbers. */
export function weekLabel(w: Pick<GameWeek, "starts_at" | "display_name"> | null | undefined): string {
  if (!w) return "This week";
  if (w.display_name) return w.display_name;
  const s = new Date(w.starts_at).toLocaleDateString("en-US", { timeZone: TOURNAMENT.TIMEZONE, month: "short", day: "numeric" });
  return `Week of ${s}`;
}

export function isFresh(createdAt: string | null | undefined, w: GameWeek | null | undefined) {
  if (!createdAt || !w) return false;
  const t = new Date(createdAt).getTime();
  return t >= new Date(w.starts_at).getTime() && t < new Date(w.locks_at).getTime();
}

export type AppEvent = "spider_uploaded" | "entry_changed" | "results_viewed" | "share_clicked" | "email_visit" | "app_visit";

export async function logEvent(event: AppEvent, props: Record<string, unknown> = {}, weekId?: string | null) {
  try {
    const { data } = await supabase.auth.getSession();
    await supabase.from("app_events" as any).insert({
      event, props, week_id: weekId ?? null, user_id: data.session?.user?.id ?? null,
    });
  } catch {
    /* analytics must never break the app */
  }
}

/** Public share link: crawlers get an OG card; people get redirected to /cup/:weekId. */
export function cupShareUrl(weekId: string) {
  const id = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  return `https://${id}.supabase.co/functions/v1/og-card?type=cup&id=${encodeURIComponent(weekId)}`;
}

export async function sha256Hex(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Bracket size → round names, round 1 first. */
export function roundLabels(size: number): string[] {
  const out: string[] = [];
  for (let n = size; n >= 2; n /= 2) out.push(n === 2 ? "Final" : n === 4 ? "Final Four" : n === 8 ? "Elite 8" : n === 16 ? "Sweet 16" : `Round of ${n}`);
  return out;
}
