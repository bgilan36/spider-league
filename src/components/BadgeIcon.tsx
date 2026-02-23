import { Trophy } from "lucide-react";

interface BadgeIconProps {
  badgeName: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const badgeImageMap: Record<string, string> = {
  "First Spider": "/images/badges/first-spider.png",
  "First Victory": "/images/badges/first-victory.png",
  "Spider Collector": "/images/badges/spider-collector.png",
  "Power Player": "/images/badges/power-player.png",
  "Battle Veteran": "/images/badges/battle-veteran.png",
  "Spider Master": "/images/badges/spider-master.png",
  "Elite Trainer": "/images/badges/elite-trainer.png",
  "Legendary Fighter": "/images/badges/legendary-fighter.png",
  "Legendary Trainer": "/images/badges/legendary-trainer.png",
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
