import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Timer, Sword, Trophy, Shield, Zap, Clock, Heart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PowerScoreArc from './PowerScoreArc';

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

interface ChallengeDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  challenge: BattleChallenge | null;
  onChallengeAccepted?: (challenge: BattleChallenge, accepterSpider: Spider) => void;
}

const ChallengeDetailsModal: React.FC<ChallengeDetailsModalProps> = ({
  isOpen,
  onClose,
  challenge,
  onChallengeAccepted
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [userSpiders, setUserSpiders] = useState<Spider[]>([]);
  const [selectedSpider, setSelectedSpider] = useState<Spider | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);

  // Fetch user's eligible spiders
  const fetchUserSpiders = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('spiders')
        .select('*')
        .eq('owner_id', user.id)
        .eq('is_approved', true)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user spiders:', error);
        return;
      }

      setUserSpiders(data || []);
    } catch (error) {
      console.error('Error fetching spiders:', error);
    }
  };

  // Accept challenge
  const acceptChallenge = async () => {
    if (!user || !challenge || !selectedSpider) return;

    setLoading(true);
    
    try {
      // Update challenge to accepted
      const { error: updateError } = await supabase
        .from('battle_challenges')
        .update({
          status: 'ACCEPTED',
          accepter_id: user.id,
          accepter_spider_id: selectedSpider.id
        })
        .eq('id', challenge.id);

      if (updateError) {
        console.error('Error accepting challenge:', updateError);
        toast({
          title: "Error",
          description: "Failed to accept challenge. Please try again.",
          variant: "destructive"
        });
        return;
      }

      // Start battle immediately
      onChallengeAccepted?.(challenge, selectedSpider);
      
      toast({
        title: "Challenge Accepted!",
        description: `Battle starting now! ${selectedSpider.nickname} vs ${challenge.challenger_spider?.nickname}!`
      });

      onClose();
    } catch (error) {
      console.error('Error accepting challenge:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while accepting the challenge",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && user) {
      fetchUserSpiders();
    }
  }, [isOpen, user]);

  if (!challenge) return null;

  const timeLeft = new Date(challenge.expires_at).getTime() - Date.now();
  const hoursLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)));
  const canAccept = user && user.id !== challenge.challenger_id && userSpiders.length > 0;
  const isOwnChallenge = user?.id === challenge.challenger_id;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sword className="w-5 h-5 text-primary" />
              Battle Challenge Details
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Challenge Status */}
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="flex items-center gap-1">
                <Timer className="w-3 h-3" />
                {hoursLeft}h remaining
              </Badge>
              {isOwnChallenge && (
                <Badge variant="secondary">Your Challenge</Badge>
              )}
            </div>

            {/* Challenger Spider Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Challenger Spider</h3>
              
              <div className="flex items-start gap-4">
                <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                  <img 
                    src={challenge.challenger_spider?.image_url} 
                    alt={challenge.challenger_spider?.nickname}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                <div className="flex-1 space-y-2">
                  <div>
                    <h4 className="text-xl font-bold">{challenge.challenger_spider?.nickname}</h4>
                    <p className="text-muted-foreground">{challenge.challenger_spider?.species}</p>
                    <p className="text-sm text-muted-foreground">
                      Challenged by: {challenge.challenger_profile?.display_name || 'Unknown'}
                    </p>
                  </div>
                  
                  {challenge.challenger_spider && (
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <PowerScoreArc score={challenge.challenger_spider.power_score} size="small" />
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{challenge.challenger_spider.power_score}</div>
                        <div className="text-xs text-muted-foreground">Power Score</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Spider Stats */}
              {challenge.challenger_spider && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4 text-red-500" />
                    <div>
                      <div className="text-sm font-medium">{challenge.challenger_spider.hit_points}</div>
                      <div className="text-xs text-muted-foreground">HP</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Sword className="w-4 h-4 text-orange-500" />
                    <div>
                      <div className="text-sm font-medium">{challenge.challenger_spider.damage}</div>
                      <div className="text-xs text-muted-foreground">Damage</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-500" />
                    <div>
                      <div className="text-sm font-medium">{challenge.challenger_spider.speed}</div>
                      <div className="text-xs text-muted-foreground">Speed</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-500" />
                    <div>
                      <div className="text-sm font-medium">{challenge.challenger_spider.defense}</div>
                      <div className="text-xs text-muted-foreground">Defense</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-purple-500" />
                    <div>
                      <div className="text-sm font-medium">{challenge.challenger_spider.venom}</div>
                      <div className="text-xs text-muted-foreground">Venom</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 text-green-500">🕸️</div>
                    <div>
                      <div className="text-sm font-medium">{challenge.challenger_spider.webcraft}</div>
                      <div className="text-xs text-muted-foreground">Webcraft</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Challenge Message */}
            {challenge.challenge_message && (
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Challenge Message</h3>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="italic">"{challenge.challenge_message}"</p>
                </div>
              </div>
            )}

            <Separator />

            {/* Action Buttons */}
            <div className="flex gap-2">
              {canAccept && (
                <Button
                  onClick={() => setShowAcceptDialog(true)}
                  disabled={loading}
                  className="flex-1 flex items-center gap-2"
                >
                  <Sword className="w-4 h-4" />
                  Accept Challenge
                </Button>
              )}
              
              {!canAccept && !isOwnChallenge && (
                <div className="flex-1 text-center text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg">
                  You need eligible spiders from this week to accept challenges
                </div>
              )}
              
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Accept Challenge Dialog */}
      <Dialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept Challenge</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm font-medium text-destructive">
                ⚠️ Warning: The losing spider will be transferred to the winner!
              </p>
            </div>
            
            <div>
              <label className="text-sm font-medium">Select Your Spider</label>
              <div className="grid gap-2 mt-2 max-h-60 overflow-y-auto">
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
                onClick={acceptChallenge}
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

export default ChallengeDetailsModal;