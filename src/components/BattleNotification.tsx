import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/auth/AuthProvider';
import { toast } from 'sonner';
import { Sword } from 'lucide-react';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';

const BattleNotification = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [checkedBattles, setCheckedBattles] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    // Check for active battles where it's the user's turn
    const checkActiveBattles = async () => {
      const { data: battles } = await supabase
        .from('battles')
        .select('id, current_turn_user_id, team_a, team_b')
        .eq('is_active', true)
        .eq('current_turn_user_id', user.id);

      if (battles && battles.length > 0) {
        battles.forEach((battle) => {
          // Only notify once per battle
          if (!checkedBattles.has(battle.id)) {
            const opponent = 
              ((battle.team_a as any)?.userId === user.id)
                ? (battle.team_b as any)?.spider?.nickname
                : (battle.team_a as any)?.spider?.nickname;

            toast.info("Your turn in battle!", {
              description: `Battle against ${opponent || 'opponent'}`,
              action: {
                label: "View Battle",
                onClick: () => navigate(`/battle/${battle.id}`)
              },
              icon: <Sword className="h-4 w-4" />
            });

            setCheckedBattles(prev => new Set(prev).add(battle.id));
          }
        });
      }
    };

    // Check on mount
    checkActiveBattles();

    // Subscribe to battle updates
    const channel = supabase
      .channel('battle-notifications')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'battles',
        filter: `current_turn_user_id=eq.${user.id}`
      }, (payload) => {
        const battle = payload.new;
        if (battle.is_active && !checkedBattles.has(battle.id)) {
          const opponent = 
            ((battle.team_a as any)?.userId === user.id)
              ? (battle.team_b as any)?.spider?.nickname
              : (battle.team_a as any)?.spider?.nickname;

          toast.info("Your turn!", {
            description: `Battle against ${opponent || 'opponent'}`,
            action: {
              label: "View Battle",
              onClick: () => navigate(`/battle/${battle.id}`)
            },
            icon: <Sword className="h-4 w-4" />
          });

          setCheckedBattles(prev => new Set(prev).add(battle.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, navigate, checkedBattles]);

  return null;
};

export default BattleNotification;
