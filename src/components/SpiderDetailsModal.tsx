import * as React from "react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/auth/AuthProvider";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Sword } from "lucide-react";
import PowerScoreArc from "@/components/PowerScoreArc";

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

interface SpiderDetailsModalProps {
  spider: Spider | null;
  isOpen: boolean;
  onClose: () => void;
}

const SpiderDetailsModal: React.FC<SpiderDetailsModalProps> = ({
  spider,
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [userSpiders, setUserSpiders] = useState<Spider[]>([]);
  const [loading, setLoading] = useState(false);

  // Check if spider is eligible for battle (created within 7 days)
  const isEligibleForBattle = (spiderCreatedAt?: string): boolean => {
    if (!spiderCreatedAt) return false;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return new Date(spiderCreatedAt) >= sevenDaysAgo;
  };

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
    if (!spider || !user) return;

    setLoading(true);
    const { error } = await supabase
      .from('battle_challenges')
      .insert({
        challenger_id: user.id,
        challenger_spider_id: challengerSpider.id,
        challenge_message: `${challengerSpider.nickname} challenges ${spider.nickname} to battle!`
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
        description: `${challengerSpider.nickname} has challenged ${spider.nickname}`,
      });
      onClose();
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen && user) {
      fetchEligibleSpiders();
    }
  }, [isOpen, user]);

  if (!spider) return null;

  const rarityColors = {
    COMMON: "bg-gray-500",
    UNCOMMON: "bg-green-500", 
    RARE: "bg-blue-500",
    EPIC: "bg-purple-500",
    LEGENDARY: "bg-amber-500"
  };

  const attributes = [
    { name: "Hit Points", value: spider.hit_points, max: 100 },
    { name: "Damage", value: spider.damage, max: 100 },
    { name: "Speed", value: spider.speed, max: 100 },
    { name: "Defense", value: spider.defense, max: 100 },
    { name: "Venom", value: spider.venom, max: 100 },
    { name: "Webcraft", value: spider.webcraft, max: 100 },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-2xl font-bold">{spider.nickname}</span>
            <Badge 
              className={`${rarityColors[spider.rarity]} text-white`}
            >
              {spider.rarity}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-lg">
            {spider.species}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Spider Image */}
          <div className="space-y-4">
            <div className="aspect-square rounded-lg overflow-hidden bg-muted">
              <img 
                src={spider.image_url} 
                alt={spider.nickname}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-center">
              <PowerScoreArc score={spider.power_score} size="large" />
              <div className="mt-2">
                <div className="text-3xl font-bold">{spider.power_score}</div>
                <div className="text-sm text-muted-foreground">Total Power Score</div>
              </div>
            </div>
          </div>

          {/* Attributes */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Battle Statistics</h3>
            <div className="space-y-4">
              {attributes.map((attr) => (
                <div key={attr.name} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{attr.name}</span>
                    <span className="text-muted-foreground">{attr.value}/{attr.max}</span>
                  </div>
                  <Progress 
                    value={(attr.value / attr.max) * 100} 
                    className="h-2"
                  />
                </div>
              ))}
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Status</span>
                <Badge variant={spider.is_approved ? "default" : "secondary"}>
                  {spider.is_approved ? "Approved" : "Pending"}
                </Badge>
              </div>
            </div>

            {/* Battle Section */}
            {user && spider.owner_id !== user.id && spider.is_approved && isEligibleForBattle(spider.created_at) && (
              <div className="pt-4 border-t">
                <h4 className="font-medium mb-3">Challenge to Battle</h4>
                {userSpiders.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground mb-3">
                      Select one of your spiders to challenge {spider.nickname}:
                    </p>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {userSpiders.map((userSpider) => (
                        <Button
                          key={userSpider.id}
                          variant="outline"
                          size="sm"
                          className="w-full justify-between"
                          onClick={() => createBattleChallenge(userSpider)}
                          disabled={loading}
                        >
                          <span>{userSpider.nickname}</span>
                          <Sword className="h-4 w-4" />
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Sword className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      You need approved spiders created in the last 7 days to battle
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SpiderDetailsModal;