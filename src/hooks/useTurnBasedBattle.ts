import { useState, useEffect, useCallback } from 'react';
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

  // Fetch battle state
  const fetchBattle = useCallback(async () => {
    if (!battleId) return;

    try {
      const { data, error } = await supabase
        .from('battles')
        .select('*')
        .eq('id', battleId)
        .single();

      if (error) throw error;
      setBattle(data as BattleState);
    } catch (error) {
      console.error('Error fetching battle:', error);
      toast.error('Failed to load battle');
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

  // Get current user's HP
  const myHp = battle 
    ? (battle.team_a as any)?.userId === user?.id 
      ? battle.p1_current_hp 
      : battle.p2_current_hp
    : null;

  // Get opponent's HP
  const opponentHp = battle
    ? (battle.team_a as any)?.userId === user?.id
      ? battle.p2_current_hp
      : battle.p1_current_hp
    : null;

  // Get my spider
  const mySpider = battle
    ? (battle.team_a as any)?.userId === user?.id
      ? (battle.team_a as any)?.spider
      : (battle.team_b as any)?.spider
    : null;

  // Get opponent spider
  const opponentSpider = battle
    ? (battle.team_a as any)?.userId === user?.id
      ? (battle.team_b as any)?.spider
      : (battle.team_a as any)?.spider
    : null;

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

    const interval = setInterval(() => {
      fetchTurns();
      fetchBattle();
    }, 1200);

    return () => clearInterval(interval);
  }, [battleId, battle?.is_active, fetchTurns, fetchBattle]);

  return {
    battle,
    turns,
    loading,
    submitting,
    isMyTurn,
    myHp,
    opponentHp,
    mySpider,
    opponentSpider,
    submitTurn,
    refetch: () => {
      fetchBattle();
      fetchTurns();
    },
  };
};
