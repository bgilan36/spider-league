import { useState, useEffect } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Sword, Trophy, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BattleRecap {
  id: string;
  created_at: string;
  winner: 'A' | 'B' | 'TIE';
  team_a: {
    userId: string;
    spider: {
      id: string;
      nickname: string;
      species: string;
      image_url: string;
      power_score: number;
      rarity: string;
    };
  };
  team_b: {
    userId: string;
    spider: {
      id: string;
      nickname: string;
      species: string;
      image_url: string;
      power_score: number;
      rarity: string;
    };
  };
}

export const BattleRecapBanner = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [battleRecaps, setBattleRecaps] = useState<BattleRecap[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (user) {
      fetchBattleRecaps();
    }
  }, [user]);

  const fetchBattleRecaps = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get the last viewed timestamp from localStorage
      const lastViewedKey = `last-viewed-battles-${user.id}`;
      const lastViewed = localStorage.getItem(lastViewedKey);
      const lastViewedDate = lastViewed ? new Date(lastViewed) : new Date(0);

      // Fetch completed battles where user's spiders participated
      const { data: battles, error } = await supabase
        .from('battles')
        .select('*')
        .eq('is_active', false)
        .not('winner', 'is', null)
        .or(`team_a->>userId.eq.${user.id},team_b->>userId.eq.${user.id}`)
        .gt('created_at', lastViewedDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      if (battles && battles.length > 0) {
        const formattedBattles = battles.map((battle) => ({
          id: battle.id,
          created_at: battle.created_at,
          winner: battle.winner,
          team_a: battle.team_a as any,
          team_b: battle.team_b as any,
        }));

        setBattleRecaps(formattedBattles);
      } else {
        setBattleRecaps([]);
      }
    } catch (error) {
      console.error('Error fetching battle recaps:', error);
      setBattleRecaps([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    if (!user) return;

    // Mark all current battles as viewed
    const lastViewedKey = `last-viewed-battles-${user.id}`;
    localStorage.setItem(lastViewedKey, new Date().toISOString());
    setDismissed(true);
  };

  const handleWatchBattle = (battleId: string) => {
    navigate(`/battle/${battleId}`);
  };

  if (loading || !user || battleRecaps.length === 0 || dismissed) {
    return null;
  }

  const totalBattles = battleRecaps.length;
  const wonBattles = battleRecaps.filter(
    (b) =>
      (b.winner === 'A' && b.team_a.userId === user.id) ||
      (b.winner === 'B' && b.team_b.userId === user.id)
  ).length;
  const lostBattles = battleRecaps.filter(
    (b) =>
      (b.winner === 'A' && b.team_b.userId === user.id) ||
      (b.winner === 'B' && b.team_a.userId === user.id)
  ).length;

  return (
    <Card className="border-2 border-primary bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 relative overflow-hidden mb-8 animate-[slideDown_0.5s_ease-out]">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-50" />
      
      <CardContent className="p-6 relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-8 w-8"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>

        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="bg-primary/20 p-3 rounded-lg">
              <Sword className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold mb-1 flex items-center gap-2">
                New Spider Battles!
                <Badge variant="destructive" className="animate-pulse">
                  {totalBattles}
                </Badge>
              </h3>
              <p className="text-muted-foreground">
                Your spiders have been in {totalBattles} {totalBattles === 1 ? 'battle' : 'battles'} since your last visit
              </p>
            </div>
          </div>

          {/* Battle Summary */}
          <div className="grid grid-cols-2 gap-4 py-4 border-y border-border/50">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-500 mb-1">{wonBattles}</div>
              <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                <Trophy className="h-4 w-4" />
                Victories
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-500 mb-1">{lostBattles}</div>
              <div className="text-sm text-muted-foreground">Defeats</div>
            </div>
          </div>

          {/* Battle Preview Grid */}
          <div className="space-y-3">
            {battleRecaps.slice(0, 3).map((battle) => {
              const userIsTeamA = battle.team_a.userId === user.id;
              const userSpider = userIsTeamA ? battle.team_a.spider : battle.team_b.spider;
              const opponentSpider = userIsTeamA ? battle.team_b.spider : battle.team_a.spider;
              const userWon =
                (userIsTeamA && battle.winner === 'A') ||
                (!userIsTeamA && battle.winner === 'B');
              const isTie = battle.winner === 'TIE';

              return (
                <div
                  key={battle.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-background/50 hover:bg-background/80 transition-colors cursor-pointer"
                  onClick={() => handleWatchBattle(battle.id)}
                >
                  {/* User Spider */}
                  <div className="flex items-center gap-2 flex-1">
                    <img
                      src={userSpider.image_url}
                      alt={userSpider.nickname}
                      className="w-12 h-12 rounded-md object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{userSpider.nickname}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        Your Spider
                      </div>
                    </div>
                  </div>

                  {/* VS Badge */}
                  <div className="flex-shrink-0">
                    {isTie ? (
                      <Badge variant="outline">TIE</Badge>
                    ) : userWon ? (
                      <Badge className="bg-green-500 text-white">WON</Badge>
                    ) : (
                      <Badge variant="destructive">LOST</Badge>
                    )}
                  </div>

                  {/* Opponent Spider */}
                  <div className="flex items-center gap-2 flex-1">
                    <div className="flex-1 min-w-0 text-right">
                      <div className="font-semibold truncate">{opponentSpider.nickname}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        Opponent
                      </div>
                    </div>
                    <img
                      src={opponentSpider.image_url}
                      alt={opponentSpider.nickname}
                      className="w-12 h-12 rounded-md object-cover"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              className="flex-1 gradient-button"
              size="lg"
              onClick={() => handleWatchBattle(battleRecaps[0].id)}
            >
              <Play className="h-5 w-5 mr-2" />
              Watch First Battle Replay
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate('/battle-history')}
            >
              View All
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
