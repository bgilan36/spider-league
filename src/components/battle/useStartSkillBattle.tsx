import { useState, useCallback } from "react";
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
}

/**
 * Opens a stance picker, then invokes battle-start (interactive battle).
 * If the user clicks "Skip — auto-resolve", invokes the legacy quick-battle.
 * Returns { open, picker } — render `picker` somewhere stable.
 */
export function useStartSkillBattle() {
  const navigate = useNavigate();
  const [args, setArgs] = useState<StartArgs | null>(null);
  const [loading, setLoading] = useState(false);

  const open = useCallback((a: StartArgs) => setArgs(a), []);
  const close = useCallback(() => { if (!loading) setArgs(null); }, [loading]);

  const handleConfirm = async (picks: { attack: AttackStance; defense: DefenseStance }) => {
    if (!args) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("battle-start", {
        body: {
          spiderId: args.spiderId ?? undefined,
          leagueId: args.leagueId ?? undefined,
          opponentSpiderId: args.opponentSpiderId ?? undefined,
          opponentUserId: args.opponentUserId ?? undefined,
          playerStance: picks,
        },
      });
      if (error) throw error;
      const res = data as { battleId?: string; error?: string };
      if (res?.error) { toast.error(res.error); return; }
      if (!res?.battleId) { toast.error("Could not start battle"); return; }
      setArgs(null);
      navigate(`/battle/${res.battleId}`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to start battle");
    } finally {
      setLoading(false);
    }
  };

  const handleAuto = async () => {
    if (!args) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("quick-battle", {
        body: {
          spiderId: args.spiderId ?? undefined,
          leagueId: args.leagueId ?? undefined,
          opponentSpiderId: args.opponentSpiderId ?? undefined,
          opponentUserId: args.opponentUserId ?? undefined,
        },
      });
      if (error) throw error;
      const res = data as { battleId?: string; error?: string };
      if (res?.error) { toast.error(res.error); return; }
      if (!res?.battleId) { toast.error("Could not start battle"); return; }
      setArgs(null);
      navigate(`/battle/${res.battleId}`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to start battle");
    } finally {
      setLoading(false);
    }
  };

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
