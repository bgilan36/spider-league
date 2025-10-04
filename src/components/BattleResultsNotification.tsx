import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import BattleRecapModal from './BattleRecapModal';

interface BattleResult {
  battle_id: string;
  winner_spider: any;
  loser_spider: any;
  winner_owner: string;
  loser_owner: string;
  battle_log: string[];
  user_won: boolean;
  spider_gained?: any;
}

const BattleResultsNotification: React.FC = () => {
  const [battleResults, setBattleResults] = useState<BattleResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchUnseenBattles();
  }, []);

  const fetchUnseenBattles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get seen battle IDs from localStorage
      const seenBattlesKey = `seen_battles_${user.id}`;
      const seenBattles = JSON.parse(localStorage.getItem(seenBattlesKey) || '[]');

      // Fetch user's spiders
      const { data: userSpiders } = await supabase
        .from('spiders')
        .select('id')
        .eq('owner_id', user.id);

      if (!userSpiders || userSpiders.length === 0) {
        setIsLoading(false);
        return;
      }

      const spiderIds = userSpiders.map(s => s.id);

      // Fetch completed battles involving user's spiders
      const { data: battles } = await supabase
        .from('battles')
        .select('*')
        .eq('is_active', false)
        .not('winner', 'is', null)
        .or(`team_a->>spiderId.in.(${spiderIds.join(',')}),team_b->>spiderId.in.(${spiderIds.join(',')})`)
        .order('created_at', { ascending: false });

      if (!battles || battles.length === 0) {
        setIsLoading(false);
        return;
      }

      // Filter out already seen battles and get details
      const unseenBattles = battles.filter(b => !seenBattles.includes(b.id));
      const results: BattleResult[] = [];

      for (const battle of unseenBattles) {
        const teamAData = battle.team_a as any;
        const teamBData = battle.team_b as any;
        const teamASpider = teamAData.spider;
        const teamBSpider = teamBData.spider;
        const teamAUserId = teamAData.userId;
        const teamBUserId = teamBData.userId;

        const isWinner = battle.winner === 'A' 
          ? teamAUserId === user.id 
          : teamBUserId === user.id;

        const winnerSpider = battle.winner === 'A' ? teamASpider : teamBSpider;
        const loserSpider = battle.winner === 'A' ? teamBSpider : teamASpider;
        const winnerUserId = battle.winner === 'A' ? teamAUserId : teamBUserId;
        const loserUserId = battle.winner === 'A' ? teamBUserId : teamAUserId;

        // Fetch user profiles
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', [winnerUserId, loserUserId]);

        const winnerProfile = profiles?.find(p => p.id === winnerUserId);
        const loserProfile = profiles?.find(p => p.id === loserUserId);

        // Check if user gained a spider (if they won)
        let spiderGained = null;
        if (isWinner && battle.challenge_id) {
          const { data: challenge } = await supabase
            .from('battle_challenges')
            .select('loser_spider_id')
            .eq('id', battle.challenge_id)
            .single();

          if (challenge?.loser_spider_id) {
            const { data: gainedSpider } = await supabase
              .from('spiders')
              .select('*')
              .eq('id', challenge.loser_spider_id)
              .single();
            
            spiderGained = gainedSpider;
          }
        }

        results.push({
          battle_id: battle.id,
          winner_spider: winnerSpider,
          loser_spider: loserSpider,
          winner_owner: winnerProfile?.display_name || 'Unknown',
          loser_owner: loserProfile?.display_name || 'Unknown',
          battle_log: Array.isArray(battle.battle_log) ? (battle.battle_log as string[]) : [],
          user_won: isWinner,
          spider_gained: spiderGained
        });
      }

      setBattleResults(results);
    } catch (error) {
      console.error('Error fetching unseen battles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Mark current battle as seen
    const seenBattlesKey = `seen_battles_${user.id}`;
    const seenBattles = JSON.parse(localStorage.getItem(seenBattlesKey) || '[]');
    const currentBattle = battleResults[currentIndex];
    
    if (currentBattle && !seenBattles.includes(currentBattle.battle_id)) {
      seenBattles.push(currentBattle.battle_id);
      localStorage.setItem(seenBattlesKey, JSON.stringify(seenBattles));
    }

    // Move to next battle or close
    if (currentIndex < battleResults.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setBattleResults([]);
      setCurrentIndex(0);
    }
  };

  if (isLoading || battleResults.length === 0) {
    return null;
  }

  const currentResult = battleResults[currentIndex];
  const hasMore = currentIndex < battleResults.length - 1;

  return (
    <BattleRecapModal
      isOpen={true}
      onClose={handleClose}
      winner={currentResult.winner_spider}
      loser={currentResult.loser_spider}
      winnerOwner={currentResult.winner_owner}
      loserOwner={currentResult.loser_owner}
      battleLog={currentResult.battle_log}
    />
  );
};

export default BattleResultsNotification;
