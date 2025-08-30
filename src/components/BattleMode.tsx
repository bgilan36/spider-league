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
import BattleArena from './BattleArena';

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

const BattleMode: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
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
      .select(`
        *,
        challenger_spider:spiders!challenger_spider_id(
          id, nickname, species, image_url, power_score, hit_points, damage, speed, defense, venom, webcraft, created_at, owner_id
        ),
        challenger_profile:profiles!challenger_id(display_name)
      `)
      .eq('status', 'OPEN')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (data && !error) {
      setChallenges(data as unknown as BattleChallenge[]);
    }
  };

  // Fetch user's eligible spiders (uploaded in last 7 days)
  const fetchUserSpiders = async () => {
    if (!user) return;
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data, error } = await supabase
      .from('spiders')
      .select('*')
      .eq('owner_id', user.id)
      .eq('is_approved', true)
      .gte('created_at', sevenDaysAgo.toISOString());

    if (data) {
      setUserSpiders(data);
    }
  };

  // Create battle challenge
  const createChallenge = async () => {
    if (!selectedSpider || !user) return;

    setLoading(true);
    const { error } = await supabase
      .from('battle_challenges')
      .insert({
        challenger_id: user.id,
        challenger_spider_id: selectedSpider.id,
        challenge_message: challengeMessage || `${selectedSpider.nickname} seeks a worthy opponent!`
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create challenge",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Challenge Posted!",
        description: "Your battle challenge is now live",
      });
      setShowChallengeForm(false);
      setSelectedSpider(null);
      setChallengeMessage('');
      fetchChallenges();
    }
    setLoading(false);
  };

  // Accept battle challenge
  const acceptChallenge = async (challenge: BattleChallenge, accepterSpider: Spider) => {
    if (!user) return;

    setLoading(true);
    
    // Update challenge to accepted
    const { error: updateError } = await supabase
      .from('battle_challenges')
      .update({
        status: 'ACCEPTED',
        accepter_id: user.id,
        accepter_spider_id: accepterSpider.id
      })
      .eq('id', challenge.id);

    if (updateError) {
      toast({
        title: "Error",
        description: "Failed to accept challenge",
        variant: "destructive"
      });
      setLoading(false);
      return;
    }

    // Start battle
    setActiveBattle({
      challengeId: challenge.id,
      spider1: challenge.challenger_spider,
      spider2: accepterSpider,
      challenger: challenge.challenger_profile?.display_name || 'Unknown',
      accepter: user.email?.split('@')[0] || 'Unknown'
    });
    
    setLoading(false);
  };

  // Handle battle completion
  const handleBattleComplete = async (winner: Spider, loser: Spider, battleId: string) => {
    if (!activeBattle) return;

    // Resolve battle and transfer ownership
    const winnerId = winner.id === activeBattle.spider1.id ? activeBattle.spider1.owner_id : activeBattle.spider2.owner_id;
    const loserId = loser.id === activeBattle.spider1.id ? activeBattle.spider1.owner_id : activeBattle.spider2.owner_id;

    const { error } = await supabase.rpc('resolve_battle_challenge', {
      challenge_id: activeBattle.challengeId,
      winner_user_id: winnerId,
      loser_user_id: loserId,
      battle_id_param: battleId
    });

    if (!error) {
      toast({
        title: "Battle Complete!",
        description: `${winner.nickname} has claimed victory and ownership of ${loser.nickname}!`,
      });
    }

    setActiveBattle(null);
    fetchChallenges();
    fetchUserSpiders();
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

  return (
    <div className="space-y-6">
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

      {/* Active Challenges */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            Active Challenges
          </h3>
          <Button variant="outline" size="sm" asChild>
            <Link to="/battle-history" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Battle History</span>
              <span className="sm:hidden">History</span>
            </Link>
          </Button>
        </div>
        
        {challenges.length === 0 ? (
          <Card>
            <CardContent className="p-4 sm:p-6 text-center">
              <p className="text-sm sm:text-base text-muted-foreground">No active challenges at the moment</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {challenges.map((challenge) => (
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
        )}
      </div>

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
  loading: boolean;
  currentUserId?: string;
}> = ({ challenge, userSpiders, onAccept, loading, currentUserId }) => {
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
                By: {challenge.challenger_profile?.display_name || 'Unknown'}
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
          
          {currentUserId === challenge.challenger_id && (
            <Badge variant="secondary" className="w-full justify-center text-xs">
              Your Challenge
            </Badge>
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