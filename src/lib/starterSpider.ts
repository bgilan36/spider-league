import { supabase } from "@/integrations/supabase/client";

export interface StarterSpider {
  id: string;
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
  eligible_until?: string | null;
  is_approved?: boolean | null;
}

export type StarterResult =
  | { status: "ready"; spider: StarterSpider; created: boolean; active: boolean }
  | { status: "session_expired" }
  | { status: "failed"; message: string };

// One in-flight request per user per tab: repeated calls share the same promise,
// and the server only creates a starter when the account owns no spiders.
const inflight = new Map<string, Promise<StarterResult>>();

async function provision(): Promise<StarterResult> {
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) return { status: "session_expired" };

  let lastError = "Could not hatch your starter spider.";
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase.functions.invoke("create-starter-spider");
    if (!error && data?.spider) {
      const s = data.spider as StarterSpider;
      const active = !!s.is_approved && !!s.eligible_until && new Date(s.eligible_until) > new Date();
      return { status: "ready", spider: s, created: !data.alreadyExists, active };
    }
    const status = (error as any)?.context?.status;
    if (status === 401) return { status: "session_expired" };
    lastError = (data as any)?.error || error?.message || lastError;
    await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
  }
  return { status: "failed", message: lastError };
}

export function ensureStarterSpider(userId: string): Promise<StarterResult> {
  const existing = inflight.get(userId);
  if (existing) return existing;
  const p = provision().finally(() => {
    // Allow a manual retry later, but dedupe concurrent callers.
    setTimeout(() => inflight.delete(userId), 0);
  });
  inflight.set(userId, p);
  return p;
}
