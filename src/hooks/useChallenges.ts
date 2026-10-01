import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";

export type ChallengeState = "incoming" | "pending" | "your_turn" | "waiting" | "expired" | "declined" | "cancelled" | "completed";

export interface ChallengeRow {
  id: string; state: ChallengeState; capture: boolean; mine: boolean;
  mySpider: string; theirSpider: string | null; expires_at: string; battle_id: string | null;
  turn_deadline: string | null; won?: boolean; created_at: string;
}

export const STATE_LABEL: Record<ChallengeState, string> = {
  incoming: "Waiting for you", pending: "Pending", your_turn: "Your turn", waiting: "Waiting on opponent",
  expired: "Expired", declined: "Declined", cancelled: "Cancelled", completed: "Completed",
};

/** Friendly Challenges and Capture Battles the player sent or received, with a derived state. */
export function useChallenges() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ChallengeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const uid = user.id;
    const since = new Date(Date.now() - 14 * 86400_000).toISOString();
    const { data } = await supabase.from("battle_challenges")
      .select("id,status,challenger_id,accepter_id,target_user_id,challenger_spider_id,accepter_spider_id,is_all_or_nothing,expires_at,battle_id,winner_id,created_at,challenge_message")
      .or(`challenger_id.eq.${uid},accepter_id.eq.${uid},target_user_id.eq.${uid}`)
      .not("challenge_message", "in", '("Skill Battle","Pod Skill Battle","Practice Battle")')
      .gte("created_at", since).order("created_at", { ascending: false }).limit(40);
    const cs = (data || []) as any[];
    const spIds = [...new Set(cs.flatMap((c) => [c.challenger_spider_id, c.accepter_spider_id]).filter(Boolean))];
    const bIds = cs.map((c) => c.battle_id).filter(Boolean);
    const [{ data: sp }, { data: bt }] = await Promise.all([
      spIds.length ? supabase.from("spiders").select("id,nickname").in("id", spIds) : Promise.resolve({ data: [] as any[] }),
      bIds.length ? supabase.from("battles").select("id,is_active,awaiting_user_id,turn_deadline" as any).in("id", bIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const nm = new Map((sp || []).map((s: any) => [s.id, s.nickname]));
    const bm = new Map((bt || []).map((b: any) => [b.id, b]));
    const now = Date.now();
    setRows(cs.map((c) => {
      const mine = c.challenger_id === uid;
      const b: any = c.battle_id ? bm.get(c.battle_id) : null;
      let state: ChallengeState;
      if (c.status === "OPEN") state = new Date(c.expires_at).getTime() <= now ? "expired" : mine ? "pending" : "incoming";
      else if (c.status === "DECLINED") state = "declined";
      else if (c.status === "CANCELLED") state = "cancelled";
      else if (c.status === "EXPIRED") state = "expired";
      else if (c.status === "COMPLETED" || (b && !b.is_active)) state = "completed";
      else state = b?.awaiting_user_id === uid ? "your_turn" : "waiting";
      return {
        id: c.id, state, capture: !!c.is_all_or_nothing, mine, created_at: c.created_at,
        mySpider: nm.get(mine ? c.challenger_spider_id : c.accepter_spider_id) ?? (mine ? "Your spider" : "your spider"),
        theirSpider: nm.get(mine ? c.accepter_spider_id : c.challenger_spider_id) ?? null,
        expires_at: c.expires_at, battle_id: c.battle_id, turn_deadline: b?.turn_deadline ?? null,
        won: state === "completed" ? c.winner_id === uid : undefined,
      };
    }));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    const r = () => load();
    window.addEventListener("challenge:created", r);
    window.addEventListener("challenge:accepted", r);
    window.addEventListener("focus", r);
    return () => {
      window.removeEventListener("challenge:created", r);
      window.removeEventListener("challenge:accepted", r);
      window.removeEventListener("focus", r);
    };
  }, [load]);

  return { rows, loading, reload: load };
}
