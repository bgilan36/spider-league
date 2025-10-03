import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sword, Trophy, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface BattleResult {
  id: string;
  challenger_id: string;
  accepter_id: string;
  challenger_spider: {
    nickname: string;
    species: string;
    image_url: string;
  };
  accepter_spider: {
    nickname: string;
    species: string;
    image_url: string;
  };
  winner_id: string;
  battle_id: string;
  created_at: string;
}

export const BattleRecapAlert = () => {
  const { user } = useAuth();
  const [battleRecaps, setBattleRecaps] = useState<BattleResult[]>([]);
  const [dismissedBattles, setDismissedBattles] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    // Check for completed battles where user was the challenger
    const fetchBattleRecaps = async () => {
      const { data, error } = await supabase
        .from('battle_challenges')
        .select(`
          id,
          challenger_id,
          accepter_id,
          winner_id,
          battle_id,
          created_at
        `)
        .eq('challenger_id', user.id)
        .eq('status', 'COMPLETED')
        .not('battle_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(3);

      if (!error && data) {
        // Fetch battle details to get spider names (battles contain spider data in team_a/team_b)
        const battleRecapsWithSpiders = await Promise.all(
          data.map(async (challenge) => {
            const { data: battleData, error: battleError } = await supabase
              .from('battles')
              .select('team_a, team_b')
              .eq('id', challenge.battle_id)
              .maybeSingle();
            
            if (battleError) {
              console.error('Error fetching battle data:', battleError);
            }
            
            // Extract spider data from battle teams (team_a and team_b are JSONB with spider data)
            const teamA = battleData?.team_a as any;
            const teamB = battleData?.team_b as any;
            
            const challengerSpider = teamA?.spider || { nickname: 'Unknown', species: 'Unknown', image_url: '' };
            const accepterSpider = teamB?.spider || { nickname: 'Unknown', species: 'Unknown', image_url: '' };
            
            return {
              ...challenge,
              challenger_spider: challengerSpider,
              accepter_spider: accepterSpider
            };
          })
        );
        // Filter out dismissed battles
        const stored = localStorage.getItem('dismissedBattleRecaps');
        const dismissed = stored ? new Set<string>(JSON.parse(stored)) : new Set<string>();
        setDismissedBattles(dismissed);
        
        const unDismissedBattles = battleRecapsWithSpiders.filter(battle => !dismissed.has(battle.id));
        setBattleRecaps(unDismissedBattles);
      }
    };

    fetchBattleRecaps();
  }, [user]);

  const dismissRecap = (battleId: string) => {
    const newDismissed = new Set(dismissedBattles);
    newDismissed.add(battleId);
    setDismissedBattles(newDismissed);
    localStorage.setItem('dismissedBattleRecaps', JSON.stringify([...newDismissed]));
    setBattleRecaps(prev => prev.filter(battle => battle.id !== battleId));
  };

  const viewBattleDetails = (battleId: string) => {
    toast({
      title: "Battle Details",
      description: "Battle details feature coming soon!"
    });
  };

  if (battleRecaps.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      {battleRecaps.map((battle) => {
        const isWinner = battle.winner_id === battle.challenger_id;
        const winnerSpider = isWinner ? battle.challenger_spider : battle.accepter_spider;
        const loserSpider = isWinner ? battle.accepter_spider : battle.challenger_spider;

        return (
          <Alert key={battle.id} className={`border-l-4 ${isWinner ? 'border-l-green-500 bg-green-50 dark:bg-green-950/20' : 'border-l-red-500 bg-red-50 dark:bg-red-950/20'}`}>
            <div className="flex items-center gap-2">
              {isWinner ? (
                <Trophy className="h-4 w-4 text-green-600" />
              ) : (
                <Sword className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-sm">
                      <strong>{isWinner ? 'Victory!' : 'Defeat'}</strong> Your challenge was completed.
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={isWinner ? 'default' : 'secondary'} className="text-xs">
                          {winnerSpider?.nickname} defeated {loserSpider?.nickname}
                        </Badge>
                        {isWinner && (
                          <span className="text-xs text-muted-foreground">
                            You claimed {loserSpider?.nickname}!
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => viewBattleDetails(battle.battle_id)}
                      className="text-xs"
                    >
                      View Details
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => dismissRecap(battle.id)}
                      className="text-xs p-1"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </AlertDescription>
            </div>
          </Alert>
        );
      })}
    </div>
  );
};