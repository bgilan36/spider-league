import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Sword, Target, Zap } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface BattleStatsProps {
  userId: string;
}

interface UserStats {
  totalBattles: number;
  wins: number;
  losses: number;
  activeBattles: number;
  winRate: number;
}

const BattleStats = ({ userId }: BattleStatsProps) => {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Get completed battles
        const { data: battles, error: battlesError } = await supabase
          .from('battles')
          .select('winner, team_a, team_b')
          .or(`team_a->>userId.eq.${userId},team_b->>userId.eq.${userId}`)
          .eq('is_active', false);

        if (battlesError) throw battlesError;

        // Get active battles
        const { data: activeBattles, error: activeError } = await supabase
          .from('battles')
          .select('id')
          .or(`team_a->>userId.eq.${userId},team_b->>userId.eq.${userId}`)
          .eq('is_active', true);

        if (activeError) throw activeError;

        // Calculate stats
        let wins = 0;
        let losses = 0;

        battles?.forEach((battle) => {
          const isTeamA = (battle.team_a as any)?.userId === userId;
          const isWinner = 
            (battle.winner === 'A' && isTeamA) ||
            (battle.winner === 'B' && !isTeamA);

          if (isWinner) {
            wins++;
          } else if (battle.winner !== 'TIE') {
            losses++;
          }
        });

        const totalBattles = battles?.length || 0;
        const winRate = totalBattles > 0 ? (wins / totalBattles) * 100 : 0;

        setStats({
          totalBattles,
          wins,
          losses,
          activeBattles: activeBattles?.length || 0,
          winRate
        });
      } catch (error) {
        console.error('Error fetching battle stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [userId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Battle Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Battle Statistics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <div className="flex justify-center mb-2">
              <Sword className="w-6 h-6 text-primary" />
            </div>
            <div className="text-2xl font-bold">{stats.totalBattles}</div>
            <div className="text-xs text-muted-foreground">Total Battles</div>
          </div>

          <div className="text-center p-4 bg-green-500/10 rounded-lg">
            <div className="flex justify-center mb-2">
              <Trophy className="w-6 h-6 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-green-500">{stats.wins}</div>
            <div className="text-xs text-muted-foreground">Victories</div>
          </div>

          <div className="text-center p-4 bg-red-500/10 rounded-lg">
            <div className="flex justify-center mb-2">
              <Target className="w-6 h-6 text-red-500" />
            </div>
            <div className="text-2xl font-bold text-red-500">{stats.losses}</div>
            <div className="text-xs text-muted-foreground">Defeats</div>
          </div>

          <div className="text-center p-4 bg-yellow-500/10 rounded-lg">
            <div className="flex justify-center mb-2">
              <Zap className="w-6 h-6 text-yellow-500" />
            </div>
            <div className="text-2xl font-bold text-yellow-500">
              {stats.winRate.toFixed(0)}%
            </div>
            <div className="text-xs text-muted-foreground">Win Rate</div>
          </div>
        </div>

        {stats.activeBattles > 0 && (
          <div className="mt-4 p-3 bg-primary/10 border border-primary/20 rounded-lg text-center">
            <p className="text-sm font-medium">
              🎮 {stats.activeBattles} Active Battle{stats.activeBattles > 1 ? 's' : ''}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BattleStats;
