import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import PowerScoreArc from "@/components/PowerScoreArc";
import BattleButton from "@/components/BattleButton";
import ShareButton from "@/components/ShareButton";
import { generateSpiderShareImage } from "@/lib/spiderShareImage";
import { ensureShareCard } from "@/lib/ensureShareCard";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ChevronRight, Star } from "lucide-react";
import { format } from "date-fns";
import BattleDetailsModal from "@/components/BattleDetailsModal";
import SpiderPhoto from "@/components/visual/SpiderPhoto";
import RarityBadge from "@/components/visual/RarityBadge";
import StatBar, { type StatKey } from "@/components/visual/StatBar";
import PowerLabel from "@/components/visual/PowerLabel";
import LocationBackfill from "@/components/LocationBackfill";
import { useAuth } from "@/auth/AuthProvider";

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
  xp?: number;
  level?: number;
  share_image_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_name?: string | null;
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
  const [battles, setBattles] = React.useState<any[]>([]);
  const [loadingBattles, setLoadingBattles] = React.useState(false);
  const [selectedBattle, setSelectedBattle] = React.useState<any | null>(null);
  const [isBattleModalOpen, setIsBattleModalOpen] = React.useState(false);
  const [locInfo, setLocInfo] = React.useState<{ latitude: number | null; location_name: string | null } | null>(null);

  const handleBattleClick = (battle: any) => {
    setSelectedBattle(battle);
    setIsBattleModalOpen(true);
  };

  const handleCloseBattleModal = () => {
    setIsBattleModalOpen(false);
    setSelectedBattle(null);
  };

  React.useEffect(() => {
    if (isOpen && spider) {
      fetchBattleHistory();
      (async () => {
        const { data } = await supabase
          .from("spiders")
          .select("latitude, location_name")
          .eq("id", spider.id)
          .maybeSingle();
        setLocInfo({
          latitude: (data?.latitude as number | null) ?? null,
          location_name: (data?.location_name as string | null) ?? null,
        });
      })();
    }
  }, [isOpen, spider?.id]);

  const fetchBattleHistory = async () => {
    if (!spider) return;
    
    setLoadingBattles(true);
    try {
      // Fetch all completed battles and filter client-side due to JSONB nesting
      const { data, error } = await supabase
        .from('battles')
        .select('*')
        .eq('is_active', false)
        .not('winner', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Filter battles where this spider participated
      const spiderBattles = (data || []).filter((battle) => {
        const teamA = battle.team_a as any;
        const teamB = battle.team_b as any;
        const teamASpiderId = teamA?.spider?.id;
        const teamBSpiderId = teamB?.spider?.id;
        return teamASpiderId === spider.id || teamBSpiderId === spider.id;
      }).slice(0, 10);
      
      setBattles(spiderBattles);
    } catch (error) {
      console.error('Error fetching battle history:', error);
    } finally {
      setLoadingBattles(false);
    }
  };

  if (!spider) return null;

  const attributes: { stat: StatKey; value: number }[] = [
    { stat: "hp",       value: spider.hit_points },
    { stat: "damage",   value: spider.damage },
    { stat: "speed",    value: spider.speed },
    { stat: "defense",  value: spider.defense },
    { stat: "venom",    value: spider.venom },
    { stat: "webcraft", value: spider.webcraft },
  ];

  const spiderLevel = spider.level ?? 1;
  const spiderXp = spider.xp ?? 0;
  const XP_THRESHOLDS = [0, 50, 120, 250, 450, 700];
  const MAX_LEVEL = 6;
  const currentLevelXp = XP_THRESHOLDS[spiderLevel - 1] ?? 0;
  const nextLevelXp = spiderLevel < MAX_LEVEL ? XP_THRESHOLDS[spiderLevel] : XP_THRESHOLDS[MAX_LEVEL - 1];
  const xpInLevel = spiderXp - currentLevelXp;
  const xpNeeded = Math.max(1, nextLevelXp - currentLevelXp);
  const xpProgress = spiderLevel >= MAX_LEVEL ? 100 : (xpInLevel / xpNeeded) * 100;
  const levelPowerBonus = (spider as any).level_power_bonus ?? Math.max(0, (spiderLevel - 1) * 5);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl sm:max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="font-display text-3xl uppercase tracking-wide">
              {spider.nickname}
            </span>
            <RarityBadge rarity={spider.rarity} />
            {spiderLevel > 1 && (
              <Badge variant="outline" className="gap-1">
                <Star className="h-3 w-3" />
                Lv.{spiderLevel}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="species-name text-sm">
            {spider.species}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Spider Image */}
          <div className="space-y-4">
            <SpiderPhoto
              src={spider.image_url}
              alt={spider.nickname}
              rarity={spider.rarity}
            />
            <div className="text-center">
              <PowerScoreArc score={spider.power_score} size="large" />
              <div className="mt-2 flex flex-col items-center gap-1">
                <PowerLabel value={spider.power_score} size="xl" />
                {levelPowerBonus > 0 && (
                  <div className="text-xs text-primary font-medium">
                    +{levelPowerBonus} from Level {spiderLevel}
                  </div>
                )}
              </div>
            </div>

            {/* XP & Level Progress */}
            <div className="rounded-lg border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-1">
                  <Star className="h-4 w-4 text-yellow-500" />
                  Level {spiderLevel}
                </span>
                <span className="text-muted-foreground">
                  {spiderLevel >= MAX_LEVEL ? 'MAX' : `${spiderXp} / ${nextLevelXp} XP`}
                </span>
              </div>
              <Progress value={xpProgress} className="h-2" />
              {spiderLevel < MAX_LEVEL && (
                <p className="text-xs text-muted-foreground text-center">
                  {nextLevelXp - spiderXp} XP to next level
                </p>
              )}
            </div>
          </div>

          {/* Attributes */}
          <div className="space-y-4">
            <h3 className="font-display text-xl uppercase tracking-wide">
              Battle Stats
            </h3>
            <div className="space-y-3">
              {attributes.map((attr, i) => (
                <StatBar
                  key={attr.stat}
                  stat={attr.stat}
                  value={attr.value}
                  delay={i * 70}
                />
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

            {/* Location / backfill */}
            <div className="pt-4 border-t space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Location</span>
                {locInfo?.location_name && (
                  <span className="text-xs text-muted-foreground truncate max-w-[60%]" title={locInfo.location_name}>
                    📍 {locInfo.location_name}
                  </span>
                )}
              </div>
              {locInfo && locInfo.latitude === null && user?.id && spider.owner_id === user.id && (
                <LocationBackfill
                  spiderId={spider.id}
                  ownerId={spider.owner_id}
                  onSaved={(info) => setLocInfo({ latitude: info.lat, location_name: info.name })}
                />
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t space-y-3">
              <BattleButton 
                targetSpider={spider} 
                size="default" 
                variant="default"
                className="w-full"
                onPickerOpen={onClose}
              />
              <div className="flex justify-center">
                <ShareButton
                  title={`🕷️ Meet ${spider.nickname} - ${spider.rarity} Spider`}
                  text={`Check out my ${spider.rarity.toLowerCase()} spider "${spider.nickname}" (${spider.species}) with a massive ${spider.power_score} power score! 💪 This web warrior is ready for battle in Spider League! Think your spider can win? 🏆`}
                  hashtags={["SpiderLeague", "WebWarriors", spider.rarity, "SpiderCollection"]}
                  variant="outline"
                  size="default"
                  imageFileName={`spider-league-${spider.nickname.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`}
                  getShareImage={() =>
                    generateSpiderShareImage({
                      nickname: spider.nickname,
                      species: spider.species,
                      rarity: spider.rarity,
                      powerScore: spider.power_score,
                      imageUrl: spider.image_url,
                    })
                  }
                  prepareShareUrl={async () => {
                    const { shareUrl } = await ensureShareCard({
                      kind: "spider",
                      id: spider.id,
                      existingImageUrl: spider.share_image_url ?? null,
                      generate: () =>
                        generateSpiderShareImage({
                          nickname: spider.nickname,
                          species: spider.species,
                          rarity: spider.rarity,
                          powerScore: spider.power_score,
                          imageUrl: spider.image_url,
                        }),
                    });
                    return shareUrl;
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Battle History Section */}
        <div className="mt-6 border-t pt-6">
          <h3 className="text-lg font-semibold mb-4">Battle History</h3>
          {loadingBattles ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : battles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No battle history yet
            </p>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {battles.map((battle) => {
                const teamA = battle.team_a as any;
                const teamB = battle.team_b as any;
                const isTeamA = teamA?.spider?.id === spider.id;
                const wasWinner = (isTeamA && battle.winner === 'A') || (!isTeamA && battle.winner === 'B');
                const opponentSpider = isTeamA ? teamB?.spider : teamA?.spider;

                return (
                  <div
                    key={battle.id}
                    onClick={() => handleBattleClick(battle)}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <img
                        src={opponentSpider?.image_url}
                        alt={opponentSpider?.nickname}
                        className="w-10 h-10 rounded object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          vs {opponentSpider?.nickname}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(battle.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={wasWinner ? "default" : "destructive"}>
                        {wasWinner ? "Won" : "Lost"}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>

      <BattleDetailsModal
        isOpen={isBattleModalOpen}
        onClose={handleCloseBattleModal}
        battle={selectedBattle}
      />
    </Dialog>
  );
};

export default SpiderDetailsModal;