import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/auth/AuthProvider';
import { toast } from 'sonner';
import { Bell, Swords, MessageSquare, Trophy, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import UserSnapshotModal from '@/components/UserSnapshotModal';
import ChallengeDetailsModal from '@/components/ChallengeDetailsModal';

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
}

const NotificationListener = () => {
  const { user } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<BattleChallenge | null>(null);

  useEffect(() => {
    if (!user) return;

    // Subscribe to battle challenges
    const challengesChannel = supabase
      .channel('user-challenges')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'battle_challenges',
          filter: `accepter_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log('New challenge received:', payload);
          
          // Fetch challenger details separately
          const { data: challengerProfile } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('id', payload.new.challenger_id)
            .single();

          const { data: challengerSpider } = await supabase
            .from('spiders')
            .select('nickname, species, power_score')
            .eq('id', payload.new.challenger_spider_id)
            .single();

          if (challengerProfile && challengerSpider) {
            toast.custom((t) => (
              <div className="bg-card border border-border rounded-lg p-4 shadow-lg flex items-start gap-3 max-w-md">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Swords className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">Battle Challenge!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {challengerProfile.display_name || 'Someone'} challenged you with their{' '}
                    {challengerSpider.nickname}
                  </p>
                  {payload.new.challenge_message && (
                    <p className="text-xs text-muted-foreground italic mt-1">
                      "{payload.new.challenge_message}"
                    </p>
                  )}
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedChallenge(payload.new as BattleChallenge);
                        toast.dismiss(t);
                      }}
                    >
                      View Challenge
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toast.dismiss(t)}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            ), { duration: 15000 });
          }
        }
      )
      .subscribe();

    // Subscribe to challenge updates (accepted/declined)
    const challengeUpdatesChannel = supabase
      .channel('challenge-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'battle_challenges',
          filter: `challenger_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log('Challenge updated:', payload);
          
          if (payload.new.status === 'ACCEPTED') {
            const { data: accepterProfile } = await supabase
              .from('profiles')
              .select('display_name')
              .eq('id', payload.new.accepter_id)
              .single();

            if (accepterProfile) {
              toast.success(
                `${accepterProfile.display_name || 'Someone'} accepted your battle challenge!`,
                {
                  icon: <Swords className="h-5 w-5" />,
                  duration: 5000,
                }
              );
            }
          } else if (payload.new.status === 'DECLINED') {
            const { data: accepterProfile } = await supabase
              .from('profiles')
              .select('display_name')
              .eq('id', payload.new.accepter_id)
              .single();

            if (accepterProfile) {
              toast.error(
                `${accepterProfile.display_name || 'Someone'} declined your battle challenge`,
                {
                  duration: 5000,
                }
              );
            }
          }
        }
      )
      .subscribe();

    // Subscribe to pokes
    const pokesChannel = supabase
      .channel('user-pokes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pokes',
          filter: `poked_user_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log('New poke received:', payload);
          
          const { data: poker } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('id', payload.new.poker_user_id)
            .single();

          if (poker) {
            toast.custom((t) => (
              <div className="bg-card border border-border rounded-lg p-4 shadow-lg flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-foreground">Poke!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {poker.display_name || 'Someone'} poked you
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2"
                    onClick={() => {
                      setSelectedUserId(payload.new.poker_user_id);
                      toast.dismiss(t);
                    }}
                  >
                    View Profile
                  </Button>
                </div>
              </div>
            ), { duration: 8000 });
          }
        }
      )
      .subscribe();

    // Subscribe to wall posts
    const wallPostsChannel = supabase
      .channel('user-wall-posts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'profile_wall_posts',
          filter: `profile_user_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log('New wall post received:', payload);
          
          const { data: poster } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('id', payload.new.poster_user_id)
            .single();

          if (poster) {
            toast.custom((t) => (
              <div className="bg-card border border-border rounded-lg p-4 shadow-lg flex items-start gap-3 max-w-md">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <MessageSquare className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">New Wall Post</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {poster.display_name || 'Someone'} posted on your wall
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {payload.new.message}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2"
                    onClick={() => {
                      setSelectedUserId(payload.new.poster_user_id);
                      toast.dismiss(t);
                    }}
                  >
                    View Profile
                  </Button>
                </div>
              </div>
            ), { duration: 10000 });
          }
        }
      )
      .subscribe();

    // Subscribe to battle completions where user is involved
    const battlesChannel = supabase
      .channel('user-battles')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'battles',
        },
        async (payload) => {
          console.log('New battle created:', payload);
          
          const battle = payload.new;
          const teamA = battle.team_a as any;
          const teamB = battle.team_b as any;
          
          // Check if current user is involved
          if (teamA?.userId === user.id || teamB?.userId === user.id) {
            const isWinner = battle.winner === 'TEAM_A' 
              ? teamA?.userId === user.id 
              : battle.winner === 'TEAM_B' 
                ? teamB?.userId === user.id 
                : false;

            if (battle.winner && battle.winner !== 'TIE') {
              toast.custom((t) => (
                <div className="bg-card border border-border rounded-lg p-4 shadow-lg flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      isWinner ? 'bg-green-500/10' : 'bg-red-500/10'
                    }`}>
                      <Trophy className={`h-5 w-5 ${isWinner ? 'text-green-500' : 'text-red-500'}`} />
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-foreground">
                      {isWinner ? 'Victory!' : 'Defeat'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your battle has concluded
                    </p>
                  </div>
                </div>
              ), { duration: 8000 });
            }
          }
        }
      )
      .subscribe();

    // Cleanup
    return () => {
      supabase.removeChannel(challengesChannel);
      supabase.removeChannel(challengeUpdatesChannel);
      supabase.removeChannel(pokesChannel);
      supabase.removeChannel(wallPostsChannel);
      supabase.removeChannel(battlesChannel);
    };
  }, [user]);

  return (
    <>
      <UserSnapshotModal
        isOpen={selectedUserId !== null}
        onClose={() => setSelectedUserId(null)}
        userId={selectedUserId || ''}
      />
      
      <ChallengeDetailsModal
        challenge={selectedChallenge}
        isOpen={selectedChallenge !== null}
        onClose={() => setSelectedChallenge(null)}
      />
    </>
  );
};

export default NotificationListener;
