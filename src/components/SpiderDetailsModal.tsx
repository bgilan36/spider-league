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

            {/* Action Buttons */}
            <div className="pt-4 border-t space-y-3">
              <BattleButton 
                targetSpider={spider} 
                size="default" 
                variant="default"
                className="w-full"
              />
              <div className="flex justify-center">
                <ShareButton
                  title={`🕷️ Meet ${spider.nickname} - ${spider.rarity} Spider`}
                  text={`Check out my ${spider.rarity.toLowerCase()} spider "${spider.nickname}" (${spider.species}) with a massive ${spider.power_score} power score! 💪 This web warrior is ready for battle in Spider League! Think your spider can win? 🏆`}
                  hashtags={["SpiderLeague", "WebWarriors", spider.rarity, "SpiderCollection"]}
                  variant="outline"
                  size="default"
                />
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SpiderDetailsModal;