import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import StancePicker from "./StancePicker";
import type { AttackStance, DefenseStance } from "@/lib/battle/stances";

export interface StartArgs {
  spiderId?: string | null;
  leagueId?: string | null;
  opponentSpiderId?: string | null;
  opponentUserId?: string | null;
  /** When true, the server must use exactly opponentSpiderId or refuse (no substitution). */
  bindOpponent?: boolean;
  /** Called instead of substituting when a confirmed matchup is no longer valid. */
  onMatchupInvalid?: (reason: string) => void;
}

type StartResponse = { battleId?: string; error?: string; code?: string; reason?: string; resumed?: boolean };

const newKey = () =>
  (crypto as any).randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

/**
 * Opens a stance picker, then invokes battle-start (interactive battle).
 * "Skip — auto-resolve" invokes quick-battle with the same bound participants.
 * One idempotency key per opened picker: double taps or retries return the same battle.
 */
export function useStartSkillBattle() {
  const navigate = useNavigate();
  const [args, setArgs] = useState<StartArgs | null>(null);
  const [loading, setLoading] = useState(false);
  const keyRef = useRef<string>(newKey());
  const busyRef = useRef(false);

  const open = useCallback((a: StartArgs) => {
    keyRef.current = newKey();
    setArgs(a);
  }, []);
  const close = useCallback(() => { if (!busyRef.current) setArgs(null); }, []);

  const run = async (fn: "battle-start" | "quick-battle", extra: Record<string, unknown>) => {
    if (!args || busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        toast.error("Your session expired. Sign in again to battle.", { id: "battle-start-error" });
        return;
      }
      const { data, error } = await supabase.functions.invoke(fn, {
        body: {
          spiderId: args.spiderId ?? undefined,
          leagueId: args.leagueId ?? undefined,
          opponentSpiderId: args.opponentSpiderId ?? undefined,
          opponentUserId: args.opponentUserId ?? undefined,
          bindOpponent: args.bindOpponent === true,
          idempotencyKey: keyRef.current,
          ...extra,
        },
      });
      if (error) {
        const status = (error as any)?.context?.status;
        if (status === 401) {
          toast.error("Your session expired. Sign in again to battle.", { id: "battle-start-error" });
          return;
        }
        throw error;
      }
      const res = data as StartResponse;
      if (res?.code === "MATCHUP_INVALID") {
        const reason = res.reason || "This matchup is no longer available.";
        setArgs(null);
        if (args.onMatchupInvalid) args.onMatchupInvalid(reason);
        else toast.error(`${reason} Please pick a new opponent.`, { id: "battle-start-error" });
        return;
      }
      if (res?.error) { toast.error(res.error, { id: "battle-start-error" }); return; }
      if (!res?.battleId) { toast.error("Could not start battle", { id: "battle-start-error" }); return; }
      if (res.resumed) toast.message("Resuming your battle in progress", { id: "battle-resume" });
      setArgs(null);
      navigate(`/battle/${res.battleId}`);
    } catch (e: any) {
      // Same key on retry, so a retry after a network blip can't create a second battle.
      toast.error(e?.message || "Failed to start battle. Tap again to retry.", { id: "battle-start-error" });
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  };

  const handleConfirm = (picks: { attack: AttackStance; defense: DefenseStance }) =>
    run("battle-start", { playerStance: picks });
  const handleAuto = () => run("quick-battle", {});

  const picker = (
    <StancePicker
      open={!!args}
      onOpenChange={(v) => { if (!v) close(); }}
      onConfirm={handleConfirm}
      onAutoResolve={handleAuto}
      loading={loading}
    />
  );

  return { open, picker, isOpen: !!args };
}
