import { Trophy } from "lucide-react";

// Import all badge graphics
import firstSpiderBadge from "@/assets/badges/first-spider.png";
import firstVictoryBadge from "@/assets/badges/first-victory.png";
import spiderCollectorBadge from "@/assets/badges/spider-collector.png";
import powerPlayerBadge from "@/assets/badges/power-player.png";
import battleVeteranBadge from "@/assets/badges/battle-veteran.png";
import spiderMasterBadge from "@/assets/badges/spider-master.png";
import eliteTrainerBadge from "@/assets/badges/elite-trainer.png";
import legendaryFighterBadge from "@/assets/badges/legendary-fighter.png";
import legendaryTrainerBadge from "@/assets/badges/legendary-trainer.png";

interface BadgeIconProps {
  badgeName: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const badgeImageMap: Record<string, string> = {
  "First Spider": firstSpiderBadge,
  "First Victory": firstVictoryBadge,
  "Spider Collector": spiderCollectorBadge,
  "Power Player": powerPlayerBadge,
  "Battle Veteran": battleVeteranBadge,
  "Spider Master": spiderMasterBadge,
  "Elite Trainer": eliteTrainerBadge,
  "Legendary Fighter": legendaryFighterBadge,
  "Legendary Trainer": legendaryTrainerBadge,
};

const sizeClasses = {
  sm: "h-6 w-6",
  md: "h-8 w-8", 
  lg: "h-12 w-12"
};

export const BadgeIcon = ({ badgeName, size = "md", className = "" }: BadgeIconProps) => {
  const badgeImage = badgeImageMap[badgeName];
  
  if (badgeImage) {
    return (
      <img
        src={badgeImage}
        alt={`${badgeName} badge`}
        className={`${sizeClasses[size]} object-contain ${className}`}
      />
    );
  }
  
  // Fallback to Trophy icon for unknown badges
  return <Trophy className={`${sizeClasses[size]} ${className}`} />;
};