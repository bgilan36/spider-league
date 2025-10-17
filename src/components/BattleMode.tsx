import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Sword, Timer, Trophy, AlertCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useBadgeSystem } from "@/hooks/useBadgeSystem";
import BattleArena from './BattleArena';
import ClickableUsername from './ClickableUsername';
import BattleStats from './BattleStats';

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

const BattleMode: React.FC<{ showChallenges?: boolean }> = ({ showChallenges = true }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { checkAndAwardBadges } = useBadgeSystem();
  const [challenges, setChallenges] = useState<BattleChallenge[]>([]);
  const [userSpiders, setUserSpiders] = useState<Spider[]>([]);
  const [showChallengeForm, setShowChallengeForm] = useState(false);
  const [selectedSpider, setSelectedSpider] = useState<Spider | null>(null);
  const [challengeMessage, setChallengeMessage] = useState('');
  const [activeBattle, setActiveBattle] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Fetch active challenges
  const fetchChallenges = async () => {
    const { data, error } = await supabase
      .from('battle_challenges')
      .select('*')
      .eq('status', 'OPEN')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching challenges:', error);
      toast({ title: "Error fetching challenges", description: error.message, variant: "destructive" });
      return;
    }

    // Fetch related data separately
    const challengesWithData = await Promise.all((data || []).map(async (challenge) => {
      // Fetch challenger spider
      const { data: spider } = await supabase
        .from('spiders')
        .select('*')
        .eq('id', challenge.challenger_spider_id)
        .single();

      // Fetch challenger profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', challenge.challenger_id)
        .single();

      return {
        ...challenge,
        challenger_spider: spider,
        challenger_profile: profile
      };
    }));

    setChallenges(challengesWithData);
  };

  // Fetch user's eligible spiders (excluding those with active challenges)
  const fetchUserSpiders = async () => {
    if (!user) return;

    // Get current week's uploads for this user
    const { data: weeklyData, error: weeklyError } = await supabase
      .from('weekly_uploads')
      .select('first_spider_id, second_spider_id, third_spider_id')
      .eq('user_id', user.id)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (weeklyError) {
      console.error('Error fetching weekly uploads:', weeklyError);
      return;
    }

    // Collect eligible spider IDs for this week
    const eligibleSpiderIds = [
      weeklyData?.first_spider_id,
      weeklyData?.second_spider_id,
      weeklyData?.third_spider_id
    ].filter(Boolean);

    if (eligibleSpiderIds.length === 0) {
      setUserSpiders([]);
      return;
    }

    // Fetch only spiders that are in this week's uploads
    const { data, error } = await supabase
      .from('spiders')
      .select('*')
      .in('id', eligibleSpiderIds)
      .eq('is_approved', true);

    if (error) {
      console.error('Error fetching eligible spiders:', error);
      return;
    }

    // Get all open challenges for this user's spiders
    const { data: openChallenges } = await supabase
      .from('battle_challenges')
      .select('challenger_spider_id')
      .eq('challenger_id', user.id)
      .eq('status', 'OPEN')
      .gt('expires_at', new Date().toISOString());

    const spidersWithChallenges = new Set(openChallenges?.map(c => c.challenger_spider_id) || []);
    
    // Filter out spiders that already have active challenges
    const eligibleSpiders = (data || []).filter(spider => !spidersWithChallenges.has(spider.id));
    setUserSpiders(eligibleSpiders);
  };

  // Create battle challenge
  const createChallenge = async () => {
    if (!selectedSpider || !user) return;

    setLoading(true);
    try {
      console.log('Creating challenge with:', {
        challenger_id: user.id,
        challenger_spider_id: selectedSpider.id,
        challenge_message: challengeMessage || `${selectedSpider.nickname} seeks a worthy opponent!`
      });

      const { data, error } = await supabase
        .from('battle_challenges')
        .insert({
          challenger_id: user.id,
          challenger_spider_id: selectedSpider.id,
          challenge_message: challengeMessage || `${selectedSpider.nickname} seeks a worthy opponent!`
        })
        .select('*')
        .single();

      if (error) {
        console.error('Challenge creation error:', error);
        toast({
          title: "Error",
          description: `Failed to create challenge: ${error.message}`,
          variant: "destructive"
        });
        return;
      }

      console.log('Challenge created successfully:', data);
      
      toast({
        title: "Challenge Posted!",
        description: "Your battle challenge is now live",
      });
      
      // Refresh challenges to show the new one
      fetchChallenges();
      
      // Reset form
      setShowChallengeForm(false);
      setSelectedSpider(null);
      setChallengeMessage('');
      
    } catch (err) {
      console.error('Unexpected error creating challenge:', err);
      toast({
        title: "Error",
        description: "An unexpected error occurred while creating the challenge",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Accept battle challenge
  const acceptChallenge = async (challenge: BattleChallenge, accepterSpider: Spider) => {
    if (!user || !challenge.challenger_spider) return;

    setLoading(true);
    
    try {
      // Update challenge to accepted
      const { error: updateError } = await supabase
        .from('battle_challenges')
        .update({
          status: 'ACCEPTED',
          accepter_id: user.id,
          accepter_spider_id: accepterSpider.id
        })
        .eq('id', challenge.id);

      if (updateError) throw updateError;

      // Create automated battle
      const battleInsert = {
        challenge_id: challenge.id,
        team_a: {
          userId: challenge.challenger_id,
          spider: challenge.challenger_spider
        },
        team_b: {
          userId: user.id,
          spider: accepterSpider
        },
        current_turn_user_id: challenge.challenger_id,
        p1_current_hp: challenge.challenger_spider.hit_points,
        p2_current_hp: accepterSpider.hit_points,
        is_active: true,
        rng_seed: Math.random().toString(36).substring(7)
      };

      const { data: battleData, error: battleError } = await supabase
        .from('battles')
        .insert(battleInsert as any)
        .select()
        .single();

      if (battleError) throw battleError;

      // Update challenge with battle_id
      await supabase
        .from('battle_challenges')
        .update({ battle_id: battleData.id })
        .eq('id', challenge.id);

      toast({
        title: "Challenge Accepted!",
        description: "Running automated battle...",
      });

      // Trigger automated battle
      const { data: battleResult, error: autoBattleError } = await supabase.functions.invoke('auto-battle', {
        body: { battleId: battleData.id }
      });

      if (autoBattleError) throw autoBattleError;

      toast({
        title: "Battle Complete!",
        description: "Viewing results...",
      });

      // Navigate to battle results
      window.location.href = `/battle/${battleData.id}`;
    } catch (error: any) {
      console.error('Error accepting challenge:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to accept challenge",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Cancel battle challenge
  const cancelChallenge = async (challengeId: string) => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('battle_challenges')
        .update({ status: 'CANCELLED' })
        .eq('id', challengeId)
        .eq('challenger_id', user.id);

      if (error) throw error;

      toast({
        title: "Challenge Cancelled",
        description: "Your challenge has been withdrawn",
      });

      fetchChallenges();
      fetchUserSpiders(); // Refresh to show spider is available again
    } catch (error: any) {
      console.error('Error cancelling challenge:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to cancel challenge",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle battle completion
  const handleBattleComplete = async (winner: Spider, loser: Spider, battleId: string) => {
    if (!activeBattle) return;

    try {
      // Resolve battle and transfer ownership
      const winnerId = winner.id === activeBattle.spider1.id ? activeBattle.spider1.owner_id : activeBattle.spider2.owner_id;
      const loserId = loser.id === activeBattle.spider1.id ? activeBattle.spider1.owner_id : activeBattle.spider2.owner_id;

      console.log('Resolving battle challenge:', {
        challenge_id: activeBattle.challengeId,
        winner_user_id: winnerId,
        loser_user_id: loserId,
        battle_id_param: battleId
      });

      const { data, error } = await supabase.rpc('resolve_battle_challenge', {
        challenge_id: activeBattle.challengeId,
        winner_user_id: winnerId,
        loser_user_id: loserId,
        battle_id_param: battleId
      });

      if (error) {
        console.error('Error resolving battle:', error);
        toast({
          title: "Error",
          description: `Failed to complete battle: ${error.message}`,
          variant: "destructive"
        });
        return;
      }

      console.log('Battle resolved successfully:', data);

      toast({
        title: "Battle Complete!",
        description: `${winner.nickname} has claimed victory and ownership of ${loser.nickname}!`,
      });

      // Check for new badges for the winner
      if (user && winnerId === user.id) {
        checkAndAwardBadges(user.id);
      }

    } catch (err) {
      console.error('Unexpected error in battle completion:', err);
      toast({
        title: "Error",
        description: "An unexpected error occurred while completing the battle",
        variant: "destructive"
      });
    } finally {
      setActiveBattle(null);
      fetchChallenges();
      fetchUserSpiders();
    }
  };

  useEffect(() => {
    fetchChallenges();
    if (user) {
      fetchUserSpiders();
    }

    // Set up real-time subscription for challenges
    const channel = supabase
      .channel('battle-challenges')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'battle_challenges'
      }, () => {
        fetchChallenges();
        fetchUserSpiders(); // Refresh eligible spiders when challenges change
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (activeBattle) {
    return (
      <BattleArena
        spider1={activeBattle.spider1}
        spider2={activeBattle.spider2}
        challenger={activeBattle.challenger}
        accepter={activeBattle.accepter}
        onBattleComplete={handleBattleComplete}
      />
    );
  }

  // Separate user's challenges from others' challenges
  const userChallenges = challenges.filter(c => c.challenger_id === user?.id);
  const othersChallenges = challenges.filter(c => c.challenger_id !== user?.id);

  return (
    <div className="space-y-6">
      {/* Battle Statistics */}
      {user && <BattleStats userId={user.id} />}
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold gradient-text">Battle Mode</h2>
          <p className="text-sm sm:text-base text-muted-foreground">Challenge other players and claim their spiders!</p>
        </div>
        
        {user && userSpiders.length > 0 && (
          <Button 
            onClick={() => setShowChallengeForm(true)} 
            className="flex items-center gap-2 w-full sm:w-auto"
            size="sm"
          >
            <Sword className="w-4 h-4" />
            <span className="hidden sm:inline">Create Challenge</span>
            <span className="sm:hidden">Challenge</span>
          </Button>
        )}
      </div>

      {/* Challenges from Other Users */}
      {showChallenges && othersChallenges.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              Challenges from Other Users
            </h3>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {othersChallenges.map((challenge) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                userSpiders={userSpiders}
                onAccept={acceptChallenge}
                loading={loading}
                currentUserId={user?.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Your Active Challenges */}
      {showChallenges && userChallenges.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
              <Sword className="w-4 h-4 sm:w-5 sm:h-5" />
              Your Active Challenges
            </h3>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {userChallenges.map((challenge) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                userSpiders={userSpiders}
                onAccept={acceptChallenge}
                onCancel={cancelChallenge}
                loading={loading}
                currentUserId={user?.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* No Challenges Message */}
      {showChallenges && challenges.length === 0 && (
        <Card>
          <CardContent className="p-4 sm:p-6 text-center space-y-2">
            <p className="text-sm sm:text-base text-muted-foreground">No active challenges at the moment</p>
            <Button variant="outline" size="sm" asChild>
              <Link to="/battle-history" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                View Battle History
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Challenge Creation Dialog */}
      <Dialog open={showChallengeForm} onOpenChange={setShowChallengeForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Battle Challenge</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select Your Spider</label>
              <div className="grid gap-2 mt-2 max-h-60 overflow-y-auto">
                {userSpiders.map((spider) => (
                  <div
                    key={spider.id}
                    className={`p-2 sm:p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedSpider?.id === spider.id ? 'border-primary bg-primary/10' : 'hover:bg-muted'
                    }`}
                    onClick={() => setSelectedSpider(spider)}
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <img
                        src={spider.image_url}
                        alt={spider.nickname}
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded object-cover flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{spider.nickname}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">{spider.species}</p>
                        <p className="text-xs sm:text-sm font-bold">Power: {spider.power_score}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Challenge Message (Optional)</label>
              <Textarea
                value={challengeMessage}
                onChange={(e) => setChallengeMessage(e.target.value)}
                placeholder="Taunt your opponents..."
                className="mt-2"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={createChallenge}
                disabled={!selectedSpider || loading}
                className="flex-1"
              >
                {loading ? 'Creating...' : 'Post Challenge'}
              </Button>
              <Button variant="outline" onClick={() => setShowChallengeForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Challenge Card Component
const ChallengeCard: React.FC<{
  challenge: BattleChallenge;
  userSpiders: Spider[];
  onAccept: (challenge: BattleChallenge, spider: Spider) => void;
  onCancel?: (challengeId: string) => void;
  loading: boolean;
  currentUserId?: string;
}> = ({ challenge, userSpiders, onAccept, onCancel, loading, currentUserId }) => {
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [selectedSpider, setSelectedSpider] = useState<Spider | null>(null);

  const timeLeft = new Date(challenge.expires_at).getTime() - Date.now();
  const hoursLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)));

  const canAccept = currentUserId && currentUserId !== challenge.challenger_id && userSpiders.length > 0;

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{challenge.challenger_spider?.nickname}</CardTitle>
            <Badge variant="outline" className="flex items-center gap-1">
              <Timer className="w-3 h-3" />
              {hoursLeft}h left
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4 p-3 sm:p-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <img
              src={challenge.challenger_spider?.image_url}
              alt={challenge.challenger_spider?.nickname}
              className="w-12 h-12 sm:w-16 sm:h-16 rounded object-cover flex-shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm sm:text-base truncate">{challenge.challenger_spider?.species}</p>
                     <p className="text-xs sm:text-sm text-muted-foreground truncate">
                 By: <ClickableUsername 
                   userId={challenge.challenger_id}
                   displayName={challenge.challenger_profile?.display_name}
                   variant="link"
                   size="sm"
                   className="text-xs p-0 h-auto"
                 />
               </p>
              <p className="text-xs sm:text-sm font-bold">Power: {challenge.challenger_spider?.power_score}</p>
            </div>
          </div>

          {challenge.challenge_message && (
            <p className="text-xs sm:text-sm italic text-muted-foreground line-clamp-2">
              "{challenge.challenge_message}"
            </p>
          )}

          {canAccept && (
            <Button
              onClick={() => setShowAcceptDialog(true)}
              disabled={loading}
              className="w-full flex items-center gap-2"
              size="sm"
            >
              <Sword className="w-4 h-4" />
              Battle
            </Button>
          )}
          
          {currentUserId === challenge.challenger_id && onCancel && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onCancel(challenge.id)}
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Cancelling...' : 'Cancel Challenge'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Accept Challenge Dialog */}
      <Dialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept Challenge</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              ⚠️ Warning: The losing spider will be transferred to the winner!
            </p>
            
            <div>
              <label className="text-sm font-medium">Select Your Spider</label>
              <div className="grid gap-2 mt-2">
                {userSpiders.map((spider) => (
                  <div
                    key={spider.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedSpider?.id === spider.id ? 'border-primary bg-primary/10' : 'hover:bg-muted'
                    }`}
                    onClick={() => setSelectedSpider(spider)}
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={spider.image_url}
                        alt={spider.nickname}
                        className="w-12 h-12 rounded object-cover"
                      />
                      <div>
                        <p className="font-medium">{spider.nickname}</p>
                        <p className="text-sm text-muted-foreground">{spider.species}</p>
                        <p className="text-sm font-bold">Power: {spider.power_score}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  if (selectedSpider) {
                    onAccept(challenge, selectedSpider);
                    setShowAcceptDialog(false);
                  }
                }}
                disabled={!selectedSpider || loading}
                className="flex-1"
                variant="destructive"
              >
                {loading ? 'Accepting...' : 'Accept & Battle'}
              </Button>
              <Button variant="outline" onClick={() => setShowAcceptDialog(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BattleMode;
