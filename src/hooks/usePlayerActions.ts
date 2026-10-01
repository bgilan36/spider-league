import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { BATTLE_COOLDOWN_MS } from "@/lib/gameRules";

export type SpiderState = "ready" | "cooldown" | "retired" | "in_battle";

export interface PlayerSpider {
  id: string; nickname: string; image_url: string; power_score: number;
  eligible_until: string | null; last_battled_at: string | null;
}
export interface ActiveBattle {
  id: string; created_at: string; myTurn: boolean; training: boolean;
  mySpider: string; oppSpider: string; mySpiderId: string;
}
export interface IncomingChallenge {
  id: string; challengerSpider: string; mySpider: string; expires_at: string; capture: boolean;
}

export function spiderState(s: PlayerSpider, inBattleIds: Set<string>, now = Date.now()): SpiderState {
  if (inBattleIds.has(s.id)) return "in_battle";
  if (!s.eligible_until || new Date(s.eligible_until).getTime() <= now) return "retired";
  if (s.last_battled_at && new Date(s.last_battled_at).getTime() + BATTLE_COOLDOWN_MS > now) return "cooldown";
  return "ready";
}

export function cooldownEndsAt(s: PlayerSpider) {
  return s.last_battled_at ? new Date(s.last_battled_at).getTime() + BATTLE_COOLDOWN_MS : 0;
}

/** Real player state used by Home "Next up", the Battles hub and spider card states. */
export function usePlayerActions() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [spiders, setSpiders] = useState<PlayerSpider[]>([]);
  const [battles, setBattles] = useState<ActiveBattle[]>([]);
  const [incoming, setIncoming] = useState<IncomingChallenge[]>([]);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const uid = user.id;
    const [{ data: sp }, { data: bt }] = await Promise.all([
      supabase.from("spiders").select("id,nickname,image_url,power_score,eligible_until,last_battled_at")
        .eq("owner_id", uid).eq("is_approved", true).order("power_score", { ascending: false }),
      supabase.from("battles").select("id,created_at,team_a,team_b,awaiting_user_id,stakes_type")
        .eq("is_active", true)
        .or(`team_a->>userId.eq.${uid},team_b->>userId.eq.${uid}`)
        .order("created_at", { ascending: false }).limit(20),
    ]);
    const mine = (sp || []) as PlayerSpider[];
    setSpiders(mine);
    setBattles((bt || []).map((b: any) => {
      const meA = b.team_a?.userId === uid;
      const me = meA ? b.team_a : b.team_b; const opp = meA ? b.team_b : b.team_a;
      const training = b.stakes_type === "training";
      return {
        id: b.id, created_at: b.created_at, training,
        // Training opponents are AI-played: the battle only advances while you have it open.
        myTurn: b.awaiting_user_id === uid || training,
        mySpider: me?.spider?.nickname ?? "Your spider", mySpiderId: me?.spider?.id,
        oppSpider: opp?.spider?.nickname ?? "Opponent",
      };
    }));
    const ids = mine.map((s) => s.id);
    {
      const filt = ids.length ? `target_user_id.eq.${uid},accepter_spider_id.in.(${ids.join(",")})` : `target_user_id.eq.${uid}`;
      const { data: ch } = await supabase.from("battle_challenges")
        .select("id,challenger_id,challenger_spider_id,accepter_spider_id,expires_at,is_all_or_nothing")
        .eq("status", "OPEN").or(filt).neq("challenger_id", uid)
        .gt("expires_at", new Date().toISOString()).limit(10);
      const cs = ch || [];
      const chIds = [...new Set(cs.map((c: any) => c.challenger_spider_id))];
      const { data: csp } = chIds.length
        ? await supabase.from("spiders").select("id,nickname").in("id", chIds)
        : { data: [] as any[] };
      const nm = new Map((csp || []).map((s: any) => [s.id, s.nickname]));
      setIncoming(cs.map((c: any) => ({
        id: c.id, expires_at: c.expires_at, capture: !!c.is_all_or_nothing,
        challengerSpider: nm.get(c.challenger_spider_id) ?? "A spider",
        mySpider: mine.find((s) => s.id === c.accepter_spider_id)?.nickname ?? "your spider",
      })));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const inBattleIds = new Set(battles.map((b) => b.mySpiderId).filter(Boolean));
  return { loading, spiders, battles, incoming, inBattleIds, reload: load };
}
