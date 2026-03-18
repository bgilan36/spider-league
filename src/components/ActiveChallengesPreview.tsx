import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Sword, Timer, AlertCircle, X, Trophy, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import ChallengeDetailsModal from './ChallengeDetailsModal';
import ClickableUsername from './ClickableUsername';

interface Spider {
  id: string;
  nickname: string;
  species: string;
  image_url: string;
  power_score: number;
  hit_points: number;
  damage: number;
  speed: number;
  defense: number;
  venom: number;
  webcraft: number;
  created_at: string;
  owner_id: string;
}

interface BattleChallenge {
  id: string;
  challenger_id: string;
  challenger_spider_id: string;
  status: string;
  challenge_message: string;
  created_at: string;
  expires_at: string;
  accepter_id?: string;
  accepter_spider_id?: string;
  battle_id?: string;
  winner_id?: string;
  challenger_spider?: Spider;
  challenger_profile?: { display_name: string };
}

const ActiveChallengesPreview: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [challenges, setChallenges] = useState<BattleChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChallenge, setSelectedChallenge] = useState<BattleChallenge | null>(null);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [isBattleInfoOpen, setIsBattleInfoOpen] = useState(false);

      // Fetch active challenges with balanced coverage:
      // - snapshot from other players
      // - all of this user's own open challenges (so none are silently hidden)
      const fetchRecentChallenges = async () => {
        try {
          setLoading(true);
          const nowIso = new Date().toISOString();

          let challengeRows: any[] = [];

          if (user?.id) {
            const [othersResult, myResult] = await Promise.all([
              supabase
                .from('battle_challenges')
                .select('*')
                .eq('status', 'OPEN')
                .gt('expires_at', nowIso)
                .neq('challenger_id', user.id)
                .order('created_at', { ascending: false })
                .limit(6),
              supabase
                .from('battle_challenges')
                .select('*')
                .eq('status', 'OPEN')
                .eq('challenger_id', user.id)
                .order('created_at', { ascending: false }),
            ]);

        if (othersResult.error) {
          console.error('Error fetching other-user challenges:', othersResult.error);
        }
        if (myResult.error) {
          console.error('Error fetching user challenges:', myResult.error);
        }

        const mergedMap = new Map<string, any>();
        [...(myResult.data || []), ...(othersResult.data || [])].forEach((challenge) => {
          if (!mergedMap.has(challenge.id)) {
            mergedMap.set(challenge.id, challenge);
          }
        });
        challengeRows = Array.from(mergedMap.values());
      } else {
        const { data, error } = await supabase
          .from('battle_challenges')
          .select('*')
          .eq('status', 'OPEN')
          .gt('expires_at', nowIso)
          .order('created_at', { ascending: false })
          .limit(6);

        if (error) {
          console.error('Error fetching challenges:', error);
          return;
        }
        challengeRows = data || [];
      }

      if (challengeRows.length === 0) {
        setChallenges([]);
        return;
      }

      const spiderIds = Array.from(
        new Set(challengeRows.map((challenge) => challenge.challenger_spider_id).filter(Boolean)),
      );
      const challengerIds = Array.from(
        new Set(challengeRows.map((challenge) => challenge.challenger_id).filter(Boolean)),
      );

      const [{ data: spiderRows }, { data: profileRows }] = await Promise.all([
        spiderIds.length > 0
          ? supabase.from('spiders').select('*').in('id', spiderIds)
          : Promise.resolve({ data: [] as any[] } as any),
        challengerIds.length > 0
          ? supabase.from('profiles').select('id, display_name').in('id', challengerIds)
          : Promise.resolve({ data: [] as any[] } as any),
      ]);

      const spiderMap = new Map((spiderRows || []).map((spider: any) => [spider.id, spider]));
      const profileMap = new Map((profileRows || []).map((profile: any) => [profile.id, profile]));

      const challengesWithData = challengeRows.map((challenge: any) => ({
        ...challenge,
        challenger_spider: spiderMap.get(challenge.challenger_spider_id) || null,
        challenger_profile: profileMap.get(challenge.challenger_id) || null,
      }));

      setChallenges(challengesWithData);
    } catch (error) {
      console.error('Error fetching challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelChallenge = async (challengeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Capture info before state changes for instant cross-component updates
    const cancelled = challenges.find(c => c.id === challengeId);
    
    try {
      // Use UPDATE due to RLS: users can update their own rows but cannot delete them
      const { error } = await supabase
        .from('battle_challenges')
        .update({ status: 'CANCELLED' })
        .eq('id', challengeId);

      if (error) throw error;

      // Immediately remove from local state
      setChallenges(prev => prev.filter(c => c.id !== challengeId));

      toast({
        title: "Challenge Cancelled",
        description: "Your challenge has been cancelled and you can create a new one now.",
      });
      // Notify other components immediately with spider context
      window.dispatchEvent(new CustomEvent('challenge:cancelled', { 
        detail: { 
          id: challengeId,
          challenger_spider_id: cancelled?.challenger_spider_id,
          challenger_id: cancelled?.challenger_id
        } 
      }));
    } catch (error) {
      console.error('Error cancelling challenge:', error);
      toast({
        title: "Error",
        description: "Failed to cancel challenge",
        variant: "destructive"
      });
    }
  };
  useEffect(() => {
    fetchRecentChallenges();

    // Set up real-time subscription for challenges
    const channel = supabase
      .channel('battle-challenges-preview-updates')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'battle_challenges'
      }, (payload) => {
        console.log('New challenge created:', payload);
        fetchRecentChallenges();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'battle_challenges'
      }, (payload) => {
        console.log('Challenge updated:', payload);
        fetchRecentChallenges();
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'battle_challenges'
      }, (payload) => {
        console.log('Challenge deleted:', payload);
        fetchRecentChallenges();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Instant local event listeners to refresh without waiting for realtime
  useEffect(() => {
    const refresh = () => fetchRecentChallenges();
    window.addEventListener('challenge:created', refresh as any);
    window.addEventListener('challenge:cancelled', refresh as any);
    window.addEventListener('challenge:accepted', refresh as any);
    return () => {
      window.removeEventListener('challenge:created', refresh as any);
      window.removeEventListener('challenge:cancelled', refresh as any);
      window.removeEventListener('challenge:accepted', refresh as any);
    };
  }, [user?.id]);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-6 bg-muted rounded w-48 mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  // Separate challenges into "from others" and "your own"
  const now = Date.now();
  const challengesFromOthers = challenges
    .filter(c => c.challenger_id !== user?.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const yourChallenges = challenges
    .filter(c => c.challenger_id === user?.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const yourActiveChallenges = yourChallenges.filter((c) => new Date(c.expires_at).getTime() > now);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-primary" />
            Battles
            <button
              type="button"
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Battles info"
              onClick={() => setIsBattleInfoOpen(true)}
            >
              <Info className="h-4 w-4" />
            </button>
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            {challengesFromOthers.length > 0
              ? `${challengesFromOthers.length} challenge${challengesFromOthers.length > 1 ? 's' : ''} from other players`
              : 'No challenges from other players yet'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline">Open to You: {challengesFromOthers.length}</Badge>
            <Badge variant="secondary">Your Active: {yourActiveChallenges.length}</Badge>
          </div>
        </div>
      </div>
      
      {challenges.length === 0 ? (
        <Card>
          <CardContent className="p-4 sm:p-6 text-center">
            <Sword className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No active challenges</h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-6">
              Be the first to create a challenge and start battling!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Challenges from Other Users */}
          {challengesFromOthers.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Sword className="w-5 h-5 text-primary" />
                Challenges from Other Users
              </h3>
              {challengesFromOthers.map((challenge) => {
                const timeLeft = new Date(challenge.expires_at).getTime() - Date.now();
                const hoursLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)));

                return (
                  <Card key={challenge.id} className="hover:shadow-md transition-shadow cursor-pointer border-primary/20" onClick={() => {
                    setSelectedChallenge(challenge);
                    setShowChallengeModal(true);
                  }}>
                    <CardContent className="flex items-center gap-2 sm:gap-4 p-3 sm:p-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-md overflow-hidden flex-shrink-0">
                        <img 
                          src={challenge.challenger_spider?.image_url} 
                          alt={challenge.challenger_spider?.nickname}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-sm sm:text-base truncate">
                            {challenge.challenger_spider?.nickname}
                          </h4>
                          <Badge variant="default" className="text-xs">
                            Open Challenge
                          </Badge>
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">
                          {challenge.challenger_spider?.species}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                           By: <ClickableUsername 
                             userId={challenge.challenger_id}
                             displayName={challenge.challenger_profile?.display_name}
                             variant="link"
                             size="sm"
                             className="text-xs p-0 h-auto"
                           />
                         </p>
                        {challenge.challenge_message && (
                          <p className="text-xs italic text-muted-foreground truncate mt-1">
                            "{challenge.challenge_message}"
                          </p>
                        )}
                      </div>
                      
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <Badge variant="outline" className="flex items-center gap-1 text-xs">
                          <Timer className="w-3 h-3" />
                          {hoursLeft}h left
                        </Badge>
                        <div className="text-right">
                          <div className="text-sm font-bold">{challenge.challenger_spider?.power_score}</div>
                          <div className="text-xs text-muted-foreground">Power</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Your Active Challenges */}
          {yourActiveChallenges.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Trophy className="w-5 h-5 text-muted-foreground" />
                Your Active Challenges
              </h3>
              {yourActiveChallenges.map((challenge) => {
                const timeLeft = new Date(challenge.expires_at).getTime() - Date.now();
                const hoursLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)));

                return (
                  <Card key={challenge.id} className="hover:shadow-md transition-shadow cursor-pointer border-muted" onClick={() => {
                    setSelectedChallenge(challenge);
                    setShowChallengeModal(true);
                  }}>
                    <CardContent className="flex items-center gap-2 sm:gap-4 p-3 sm:p-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-md overflow-hidden flex-shrink-0">
                        <img 
                          src={challenge.challenger_spider?.image_url} 
                          alt={challenge.challenger_spider?.nickname}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-sm sm:text-base truncate">
                            {challenge.challenger_spider?.nickname}
                          </h4>
                          <Badge variant="secondary" className="text-xs">
                            Your Challenge
                          </Badge>
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">
                          {challenge.challenger_spider?.species}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                           By: <ClickableUsername 
                             userId={challenge.challenger_id}
                             displayName={challenge.challenger_profile?.display_name}
                             variant="link"
                             size="sm"
                             className="text-xs p-0 h-auto"
                           />
                         </p>
                        {challenge.challenge_message && (
                          <p className="text-xs italic text-muted-foreground truncate mt-1">
                            "{challenge.challenge_message}"
                          </p>
                        )}
                      </div>
                      
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          onClick={(e) => handleCancelChallenge(challenge.id, e)}
                          title="Cancel challenge"
                        >
                          <X className="h-5 w-5" />
                        </Button>
                        <Badge variant="outline" className="flex items-center gap-1 text-xs">
                          <Timer className="w-3 h-3" />
                          {hoursLeft}h left
                        </Badge>
                        <div className="text-right">
                          <div className="text-sm font-bold">{challenge.challenger_spider?.power_score}</div>
                          <div className="text-xs text-muted-foreground">Power</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* Challenge Details Modal */}
      <ChallengeDetailsModal
        isOpen={showChallengeModal}
        onClose={() => {
          setShowChallengeModal(false);
          setSelectedChallenge(null);
        }}
        challenge={selectedChallenge}
        onChallengeAccepted={(challenge, accepterSpider) => {
          window.location.href = '/';
        }}
      />

      {/* Battle Info Dialog */}
      <Dialog open={isBattleInfoOpen} onOpenChange={setIsBattleInfoOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sword className="h-5 w-5 text-primary" />
              What are Battles?
            </DialogTitle>
            <DialogDescription>
              High-stakes spider combat where ownership is on the line.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Battles are competitive fights between two players' spiders. The winning user
              takes ownership of the losing spider — so choose wisely!
            </p>
            <p>
              <strong className="text-foreground">How it works:</strong> A player creates a challenge
              by selecting one of their spiders. Other players can accept the challenge with one of
              their own spiders. Once accepted, the battle is resolved and the winner claims the
              loser's spider.
            </p>
            <p>
              <strong className="text-foreground">Strategy tip:</strong> Consider your spider's stats
              carefully. Speed, venom, defense, and damage all play a role in determining the outcome.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ActiveChallengesPreview;
