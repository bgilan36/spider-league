import { supabase } from "@/integrations/supabase/client";

export type ChallengeMode = "training" | "friendly" | "capture";

export interface ChallengeSpider {
  id: string; nickname: string; species?: string; image_url: string; power_score: number;
  owner_id?: string; rarity?: string; owner_name?: string; owner_last_seen?: string | null;
}

/** Calls the server-side challenge function and normalizes errors into a message + code. */
export async function callChallenge(action: string, body: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("challenge", { body: { action, ...body } });
  const payload: any = data ?? (error as any)?.context?.json ?? null;
  let parsed = payload;
  if (!parsed && (error as any)?.context?.text) {
    try { parsed = JSON.parse(await (error as any).context.text()); } catch { /* */ }
  }
  if (parsed?.error || error) {
    return { ok: false as const, error: parsed?.error || "Something went wrong. Please try again.", code: parsed?.code as string | undefined, data: parsed };
  }
  return { ok: true as const, data: parsed };
}

/** Honest presence label — never implies someone is live unless seen in the last 5 minutes. */
export function presenceLabel(lastSeen?: string | null) {
  if (!lastSeen) return "Not recently active";
  const mins = (Date.now() - new Date(lastSeen).getTime()) / 60000;
  if (mins < 5) return "Online now";
  if (mins < 60) return `Active ${Math.round(mins)}m ago`;
  if (mins < 60 * 24) return `Active ${Math.round(mins / 60)}h ago`;
  return `Active ${Math.round(mins / 1440)}d ago`;
}

export function strengthLabel(mine: number, theirs: number) {
  const r = theirs / Math.max(1, mine);
  if (r > 1.15) return { label: "Underdog", detail: `Their spider has ${Math.round((r - 1) * 100)}% more Power.`, tone: "warn" as const };
  if (r < 0.87) return { label: "You're favored", detail: `Your spider has ${Math.round((1 / r - 1) * 100)}% more Power.`, tone: "good" as const };
  return { label: "Even match", detail: "Power within about 15% — skill and timing decide it.", tone: "even" as const };
}

export function timeLeftLabel(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "now";
  const m = Math.ceil(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

// Global open helpers — a single host in Layout renders the dialogs so they survive
// the modal or page that opened them closing.
export interface ComposeArgs { mySpiderId?: string; targetSpider?: ChallengeSpider; mode?: ChallengeMode }
export const openChallengeComposer = (args: ComposeArgs = {}) =>
  window.dispatchEvent(new CustomEvent("challenge:compose", { detail: args }));
export const openChallengeResponse = (challengeId: string) =>
  window.dispatchEvent(new CustomEvent("challenge:respond", { detail: { challengeId } }));
