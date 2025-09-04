import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sword, Timer, AlertCircle, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ChallengeDetailsModal from './ChallengeDetailsModal';

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

  // Fetch recent active challenges (limit to 3)
  const fetchRecentChallenges = async () => {
    try {
      const { data, error } = await supabase
        .from('battle_challenges')
        .select('*')
        .eq('status', 'OPEN')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) {
        console.error('Error fetching challenges:', error);
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
    } catch (error) {
      console.error('Error fetching challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentChallenges();

    // Set up real-time subscription for challenges
    const channel = supabase
      .channel('battle-challenges-preview')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'battle_challenges'
      }, () => {
        fetchRecentChallenges();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-primary" />
            Active Challenges
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Latest battle challenges from other players
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
          <Link to="/battle-mode" className="flex items-center justify-center gap-2">
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">View All Challenges</span>
            <span className="sm:hidden">View All</span>
          </Link>
        </Button>
      </div>
      
      {challenges.length === 0 ? (
        <Card>
          <CardContent className="p-4 sm:p-6 text-center">
            <Sword className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No active challenges</h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-6">
              Be the first to create a challenge and start battling!
            </p>
            <Button asChild className="gradient-button relative z-10">
              <Link to="/battle-mode" className="flex items-center gap-2">
                <Sword className="h-4 w-4" />
                Go to Battle Mode
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {challenges.map((challenge) => {
            const timeLeft = new Date(challenge.expires_at).getTime() - Date.now();
            const hoursLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)));
            const isOwnChallenge = user?.id === challenge.challenger_id;

            return (
              <Card key={challenge.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => {
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
                      {isOwnChallenge && (
                        <Badge variant="secondary" className="text-xs">
                          Your Challenge
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">
                      {challenge.challenger_spider?.species}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      By: {challenge.challenger_profile?.display_name || 'Unknown'}
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
          
          {challenges.length === 3 && (
            <div className="text-center pt-2">
              <Button asChild variant="ghost" size="sm">
                <Link to="/battle-mode" className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  View all active challenges
                </Link>
              </Button>
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
          // Redirect to battle mode to start the battle
          window.location.href = '/battle-mode';
        }}
      />
    </div>
  );
};

export default ActiveChallengesPreview;