import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/auth/AuthProvider';
import { toast } from 'sonner';

interface BattleTurn {
  id: string;
  battle_id: string;
  turn_index: number;
  actor_user_id: string;
  action_type: 'attack' | 'defend' | 'special' | 'pass';
  action_payload: any;
  result_payload: any;
  created_at: string;
}

interface BattleState {
  id: string;
  current_turn_user_id: string | null;
  turn_count: number;
  p1_current_hp: number | null;
  p2_current_hp: number | null;
  is_active: boolean;
  winner: string | null;
  team_a: any;
  team_b: any;
}

export const useTurnBasedBattle = (battleId: string | null) => {
  const { user } = useAuth();
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [turns, setTurns] = useState<BattleTurn[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // 'session_expired' and 'not_found' are terminal: polling stops and the page shows a recovery card.
  const [loadError, setLoadError] = useState<null | 'session_expired' | 'not_found' | 'network'>(null);
  const failCountRef = useRef(0);

  // Fetch battle state
  const fetchBattle = useCallback(async () => {
    if (!battleId) return;

    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        setLoadError('session_expired');
        toast.error('Your session expired. Sign in again to continue this battle.', { id: `battle-load-${battleId}` });
        return;
      }
      const { data, error } = await supabase
        .from('battles')
        .select('*')
        .eq('id', battleId)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setLoadError('not_found');
        toast.error('This battle could not be found.', { id: `battle-load-${battleId}` });
        return;
      }
      failCountRef.current = 0;
      setLoadError(null);
      toast.dismiss(`battle-load-${battleId}`);
      setBattle(data as BattleState);
    } catch (error) {
      console.error('Error fetching battle:', error);
      failCountRef.current += 1;
      // Transient blips are retried silently by the poller; one deduped toast after repeated failures.
      if (failCountRef.current >= 3) {
        setLoadError('network');
        toast.error('Connection trouble loading this battle — retrying…', { id: `battle-load-${battleId}` });
      }
    } finally {
      setLoading(false);
    }
  }, [battleId]);

  // Fetch battle turns
  const fetchTurns = useCallback(async () => {
    if (!battleId) return;

    try {
      const { data, error } = await supabase
        .from('battle_turns')
        .select('*')
        .eq('battle_id', battleId)
        .order('turn_index', { ascending: true });

      if (error) throw error;
      setTurns((data || []) as BattleTurn[]);
    } catch (error) {
      console.error('Error fetching turns:', error);
    }
  }, [battleId]);

  // Submit a turn
  const submitTurn = async (actionType: 'attack' | 'defend' | 'special' | 'pass', actionPayload = {}) => {
    if (!battleId || !user) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('process_battle_turn', {
        p_battle_id: battleId,
        p_action_type: actionType,
        p_action_payload: actionPayload
      });

      if (error) {
        console.error('RPC error:', error);
        throw new Error(error.message || 'Failed to process turn');
      }

      console.log('Turn processed:', data);
      
      // Refresh battle state
      await fetchBattle();
      await fetchTurns();

      return data;
    } catch (error: any) {
      console.error('Error submitting turn:', error);
      toast.error(error.message || 'Failed to submit turn');
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  // Check if it's current user's turn
  const isMyTurn = battle?.current_turn_user_id === user?.id;

  // Get my spider/opponent spider first so we can fall back to max HP before turns start
  const isTeamA = battle ? (battle.team_a as any)?.userId === user?.id : false;
  const mySpiderRaw = battle ? (isTeamA ? (battle.team_a as any)?.spider : (battle.team_b as any)?.spider) : null;
  const opponentSpiderRaw = battle ? (isTeamA ? (battle.team_b as any)?.spider : (battle.team_a as any)?.spider) : null;

  // Current HP — fall back to spider's max HP when battle hasn't started yet
  // (p1_current_hp / p2_current_hp are null until the first turn is processed).
  const myHp = battle
    ? (isTeamA ? battle.p1_current_hp : battle.p2_current_hp) ?? mySpiderRaw?.hit_points ?? null
    : null;

  const opponentHp = battle
    ? (isTeamA ? battle.p2_current_hp : battle.p1_current_hp) ?? opponentSpiderRaw?.hit_points ?? null
    : null;

  const mySpider = mySpiderRaw;
  const opponentSpider = opponentSpiderRaw;

  useEffect(() => {
    if (!battleId) return;

    fetchBattle();
    fetchTurns();

    // Subscribe to battle updates
    const battleChannel = supabase
      .channel(`battle-${battleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'battles',
          filter: `id=eq.${battleId}`,
        },
        () => {
          fetchBattle();
        }
      )
      .subscribe();

    // Subscribe to turn updates
    const turnsChannel = supabase
      .channel(`battle-turns-${battleId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'battle_turns',
          filter: `battle_id=eq.${battleId}`,
        },
        () => {
          fetchTurns();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(battleChannel);
      supabase.removeChannel(turnsChannel);
    };
  }, [battleId, fetchBattle, fetchTurns]);

  // Realtime fallback: poll while battle is active to ensure fast updates
  useEffect(() => {
    if (!battleId) return;
    if (battle?.is_active === false) return;
    if (loadError === 'session_expired' || loadError === 'not_found') return;

    const interval = setInterval(() => {
      fetchTurns();
      fetchBattle();
    }, 1200);

    return () => clearInterval(interval);
  }, [battleId, battle?.is_active, loadError, fetchTurns, fetchBattle]);

  return {
    battle,
    turns,
    loading,
    loadError,
    submitting,
    isMyTurn,
    myHp,
    opponentHp,
    mySpider,
    opponentSpider,
    submitTurn,
    refetch: () => {
      failCountRef.current = 0;
      setLoadError(null);
      fetchBattle();
      fetchTurns();
    },
  };
};
