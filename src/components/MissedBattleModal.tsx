import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, Clock, Play, Swords } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useStartSkillBattle } from '@/components/battle/useStartSkillBattle';

interface MissedBattle {
  id: string;
  created_at: string;
  team_a: any;
  team_b: any;
  winner: string;
}

interface MissedBattleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWatchBattle: (battleId: string) => void;
}

const MissedBattleModal: React.FC<MissedBattleModalProps> = ({
  isOpen,
  onClose,
  onWatchBattle,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [missedBattles, setMissedBattles] = useState<MissedBattle[]>([]);
  const [loading, setLoading] = useState(true);
  const { open: openRematch, picker: rematchPicker } = useStartSkillBattle();

  useEffect(() => {
    if (!isOpen || !user) return;

    const fetchMissedBattles = async () => {
      setLoading(true);
      try {
        // Get battles from the last 24 hours where user was involved
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { data: battles, error } = await supabase
          .from('battles')
          .select('*')
          .gte('created_at', oneDayAgo)
          .eq('is_active', false)
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) throw error;

        // Filter battles where current user was involved
        const userBattles = (battles || []).filter((battle: any) => {
          const teamA = battle.team_a as any;
          const teamB = battle.team_b as any;
          return teamA?.userId === user.id || teamB?.userId === user.id;
        });

        // Check which battles haven't been viewed
        const viewedBattles = JSON.parse(
          localStorage.getItem(`viewed-battles-${user.id}`) || '[]'
        );

        const unviewedBattles = userBattles.filter(
          (battle: any) => !viewedBattles.includes(battle.id)
        );

        // Sort: losses first (so a rematch is the obvious next action), then most recent.
        unviewedBattles.sort((a: any, b: any) => {
          const userLost = (battle: any) => {
            const userIsTeamA = (battle.team_a as any)?.userId === user.id;
            const won = (battle.winner === 'TEAM_A' && userIsTeamA) ||
                        (battle.winner === 'TEAM_B' && !userIsTeamA);
            return !won;
          };
          const al = userLost(a) ? 0 : 1;
          const bl = userLost(b) ? 0 : 1;
          if (al !== bl) return al - bl;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        setMissedBattles(unviewedBattles);
      } catch (error) {
        console.error('Error fetching missed battles:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMissedBattles();
  }, [isOpen, user]);

  const handleWatchNow = (battleId: string) => {
    if (!user) return;

    // Mark as viewed
    const viewedBattles = JSON.parse(
      localStorage.getItem(`viewed-battles-${user.id}`) || '[]'
    );
    viewedBattles.push(battleId);
    localStorage.setItem(`viewed-battles-${user.id}`, JSON.stringify(viewedBattles));

    onWatchBattle(battleId);
    navigate(`/battle/${battleId}`);
  };

  const markViewed = (battleId: string) => {
    if (!user) return;
    const viewed = JSON.parse(
      localStorage.getItem(`viewed-battles-${user.id}`) || '[]'
    );
    if (!viewed.includes(battleId)) {
      viewed.push(battleId);
      localStorage.setItem(`viewed-battles-${user.id}`, JSON.stringify(viewed));
    }
  };

  const handleRematch = (battle: MissedBattle) => {
    if (!user) return;
    const teamA = battle.team_a as any;
    const teamB = battle.team_b as any;
    const userIsTeamA = teamA?.userId === user.id;
    const mySpider = userIsTeamA ? teamA?.spider : teamB?.spider;
    const oppTeam = userIsTeamA ? teamB : teamA;
    if (!oppTeam?.userId || !oppTeam?.spider?.id) return;
    markViewed(battle.id);
    onClose();
    openRematch({
      spiderId: mySpider?.id ?? null,
      opponentSpiderId: oppTeam.spider.id,
      opponentUserId: oppTeam.userId,
    });
  };

  const handleDismiss = () => {
    if (!user) return;

    // Mark all as viewed
    const viewedBattles = JSON.parse(
      localStorage.getItem(`viewed-battles-${user.id}`) || '[]'
    );
    missedBattles.forEach(battle => {
      if (!viewedBattles.includes(battle.id)) {
        viewedBattles.push(battle.id);
      }
    });
    localStorage.setItem(`viewed-battles-${user.id}`, JSON.stringify(viewedBattles));

    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleDismiss}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="flex justify-center mb-4"
          >
            <div className="h-16 w-16 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <Trophy className="h-8 w-8 text-yellow-500 animate-pulse" />
            </div>
          </motion.div>
          <DialogTitle className="text-2xl text-center gradient-text">
            You Missed {missedBattles.length > 1 ? 'Epic Battles' : 'an Epic Battle'}
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            {missedBattles.length === 0 && !loading
              ? "You're all caught up! No missed battles."
              : loading
              ? 'Checking for missed battles...'
              : `${missedBattles.length} ${
                  missedBattles.length === 1 ? 'battle' : 'battles'
                } took place while you were away. Want to watch the full sequence?`}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          </div>
        ) : missedBattles.length > 0 ? (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {missedBattles.map((battle, index) => {
              const teamA = battle.team_a as any;
              const teamB = battle.team_b as any;
              const userIsTeamA = teamA?.userId === user?.id;
              const userWon =
                (battle.winner === 'TEAM_A' && userIsTeamA) ||
                (battle.winner === 'TEAM_B' && !userIsTeamA);

              return (
                <motion.div
                  key={battle.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card
                    className={`cursor-pointer hover:ring-2 transition-all ${
                      userWon
                        ? 'hover:ring-green-500 border-green-500/50'
                        : 'hover:ring-red-500 border-red-500/50'
                    }`}
                    onClick={() => handleWatchNow(battle.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={userWon ? 'text-green-500' : 'text-red-500'}>
                              {userWon ? '🏆' : '💀'}
                            </span>
                            <span className="font-semibold text-sm">
                              {userWon ? 'Victory' : 'Defeat'}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            {format(new Date(battle.created_at), 'MMM d, h:mm a')}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 items-stretch">
                          {!userWon && (
                            <Button
                              size="sm"
                              variant="default"
                              className="bg-red-500 hover:bg-red-600 text-white"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRematch(battle);
                              }}
                            >
                              <Swords className="h-3 w-3 mr-1" />
                              Rematch
                            </Button>
                          )}
                          {userWon && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRematch(battle);
                              }}
                            >
                              <Swords className="h-3 w-3 mr-1" />
                              Rematch
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleWatchNow(battle.id);
                            }}
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Watch
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            <Trophy className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No missed battles found</p>
          </div>
        )}

        <DialogFooter className="sm:justify-center">
          <Button onClick={handleDismiss} variant="outline" className="min-w-32">
            {missedBattles.length > 0 ? 'Not Now' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {rematchPicker}
    </>
  );
};

export default MissedBattleModal;
