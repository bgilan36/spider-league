import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/auth/AuthProvider";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Sword } from "lucide-react";

interface Spider {
  id: string;
  nickname: string;
  species: string;
  image_url: string;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY" | "UNCOMMON";
  power_score: number;
  hit_points: number;
  damage: number;
  speed: number;
  defense: number;
  venom: number;
  webcraft: number;
  is_approved: boolean;
  owner_id?: string;
  created_at?: string;
}

interface BattleButtonProps {
  targetSpider: Spider;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "ghost";
  className?: string;
}

const BattleButton: React.FC<BattleButtonProps> = ({ 
  targetSpider, 
  size = "sm", 
  variant = "outline",
  className = ""
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [userSpiders, setUserSpiders] = useState<Spider[]>([]);
  const [loading, setLoading] = useState(false);

  // Check if spider is eligible for battle (created within 7 days)
  const isEligibleForBattle = (spiderCreatedAt?: string): boolean => {
    if (!spiderCreatedAt) return false;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return new Date(spiderCreatedAt) >= sevenDaysAgo;
  };

  // Check if user can challenge this spider
  const canChallenge = user && 
    targetSpider.owner_id !== user.id && 
    targetSpider.is_approved && 
    isEligibleForBattle(targetSpider.created_at);

  // Fetch user's eligible spiders for battle
  const fetchEligibleSpiders = async () => {
    if (!user) return;
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data, error } = await supabase
      .from('spiders')
      .select('*')
      .eq('owner_id', user.id)
      .eq('is_approved', true)
      .gte('created_at', sevenDaysAgo.toISOString());

    if (data && !error) {
      setUserSpiders(data);
    }
  };

  // Create battle challenge
  const createBattleChallenge = async (challengerSpider: Spider) => {
    if (!targetSpider || !user) return;

    setLoading(true);
    const { error } = await supabase
      .from('battle_challenges')
      .insert({
        challenger_id: user.id,
        challenger_spider_id: challengerSpider.id,
        challenge_message: `${challengerSpider.nickname} challenges ${targetSpider.nickname} to battle!`
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create challenge",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Challenge Created!",
        description: `${challengerSpider.nickname} has challenged ${targetSpider.nickname}`,
      });
      setShowDialog(false);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (showDialog && user) {
      fetchEligibleSpiders();
    }
  }, [showDialog, user]);

  if (!canChallenge) {
    return null;
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={(e) => {
          e.stopPropagation();
          setShowDialog(true);
        }}
      >
        <Sword className="h-4 w-4" />
        <span className="hidden sm:inline ml-1">Battle</span>
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Challenge {targetSpider.nickname}</DialogTitle>
            <DialogDescription>
              Select one of your spiders to challenge {targetSpider.nickname} to battle
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {userSpiders.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Choose your fighter:
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {userSpiders.map((userSpider) => (
                    <Button
                      key={userSpider.id}
                      variant="outline"
                      className="w-full justify-between h-auto p-3"
                      onClick={() => createBattleChallenge(userSpider)}
                      disabled={loading}
                    >
                      <div className="flex items-center gap-3">
                        <img 
                          src={userSpider.image_url} 
                          alt={userSpider.nickname}
                          className="w-8 h-8 rounded object-cover"
                        />
                        <div className="text-left">
                          <div className="font-medium">{userSpider.nickname}</div>
                          <div className="text-xs text-muted-foreground">{userSpider.species}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{userSpider.power_score}</div>
                        <div className="text-xs text-muted-foreground">Power</div>
                      </div>
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <Sword className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium mb-2">No Eligible Spiders</h3>
                <p className="text-sm text-muted-foreground">
                  You need approved spiders created in the last 7 days to battle
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BattleButton;