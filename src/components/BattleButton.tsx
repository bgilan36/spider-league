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
  context?: "leaderboard" | "collection"; // Add context prop
}

const BattleButton: React.FC<BattleButtonProps> = ({ 
  targetSpider, 
  size = "sm", 
  variant = "outline",
  className = "",
  context = "collection"
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [userSpiders, setUserSpiders] = useState<Spider[]>([]);
  const [loading, setLoading] = useState(false);

  // Check if user can interact with this spider (own or others')
  const canInteract = user && targetSpider.is_approved;

  // Check if this is the user's own spider
  const isOwnSpider = user && targetSpider.owner_id === user.id;
  
  // Hide battle button for own spiders on leaderboards (use Battle Mode instead)
  if (context === "leaderboard" && isOwnSpider) {
    return null;
  }
  
  // Determine button text and action
  const buttonText = "Challenge";
  const actionDescription = isOwnSpider 
    ? "Offer this spider for battle challenges" 
    : `Challenge ${targetSpider.nickname} to battle`;

  // Fetch user's eligible spiders for battle (all approved spiders)
  const fetchEligibleSpiders = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('spiders')
      .select('*')
      .eq('owner_id', user.id)
      .eq('is_approved', true);

    if (data && !error) {
      setUserSpiders(data);
    }
  };
  // Create direct challenge with the current spider (for collection context)
  const handleDirectChallenge = async () => {
    if (!targetSpider || !user || !isOwnSpider) return;

    setLoading(true);

    // Create an open challenge with this spider
    const { error } = await supabase
      .from('battle_challenges')
      .insert({
        challenger_id: user.id,
        challenger_spider_id: targetSpider.id,
        challenge_message: `${targetSpider.nickname} seeks a worthy opponent!`
      })
      .select('id')
      .single();

      if (error) {
        console.error('Failed to create challenge (direct):', error);
        toast({
          title: "Error",
          description: `Failed to create challenge: ${error.message}`,
          variant: "destructive"
        });
      } else {
      toast({
        title: "Challenge Created!",
        description: `${targetSpider.nickname} is now looking for opponents`,
      });
    }
    
    setLoading(false);
  };

  // Create battle challenge or offer spider for battle
  const handleBattleAction = async (challengerSpider: Spider) => {
    if (!targetSpider || !user) return;

    setLoading(true);
    
    if (isOwnSpider) {
      // Offer own spider for battle (this could be extended to create an "open challenge")
      toast({
        title: "Battle Offer Created!",
        description: `${targetSpider.nickname} is now available for battle challenges`,
      });
    } else {
      // Challenge another user's spider
      const { error } = await supabase
        .from('battle_challenges')
        .insert({
          challenger_id: user.id,
          challenger_spider_id: challengerSpider.id,
          accepter_id: targetSpider.owner_id,
          accepter_spider_id: targetSpider.id,
          challenge_message: `${challengerSpider.nickname} challenges ${targetSpider.nickname} to battle!`
        })
        .select('id')
        .single();

      if (error) {
        console.error('Failed to create challenge (targeted):', error);
        toast({
          title: "Error",
          description: `Failed to create challenge: ${error.message}`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Challenge Created!",
          description: `${challengerSpider.nickname} has challenged ${targetSpider.nickname}`,
        });
      }
    }
    
    setShowDialog(false);
    setLoading(false);
  };

  useEffect(() => {
    if (showDialog && user) {
      fetchEligibleSpiders();
    }
  }, [showDialog, user]);

  if (!canInteract) {
    return null;
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        disabled={loading}
        onClick={(e) => {
          e.stopPropagation();
          // For collection context with own spiders, auto-create challenge
          if (context === "collection" && isOwnSpider) {
            handleDirectChallenge();
          } else {
            setShowDialog(true);
          }
        }}
      >
        <Sword className="h-4 w-4" />
        <span className="hidden sm:inline ml-1">{buttonText}</span>
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isOwnSpider ? `Offer ${targetSpider.nickname} for Battle` : `Challenge ${targetSpider.nickname}`}
            </DialogTitle>
            <DialogDescription>
              {isOwnSpider 
                ? `Select one of your other spiders to pair with ${targetSpider.nickname} for battle offers`
                : `Select one of your spiders to challenge ${targetSpider.nickname} to battle`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {userSpiders.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {isOwnSpider ? "Choose your other fighter:" : "Choose your fighter:"}
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {userSpiders.filter(spider => spider.id !== targetSpider.id).map((userSpider) => (
                    <Button
                      key={userSpider.id}
                      variant="outline"
                      className="w-full justify-between h-auto p-3"
                      onClick={() => handleBattleAction(userSpider)}
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
                    You need approved spiders to create battle challenges
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