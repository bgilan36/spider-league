import React from "react";
import { Button } from "@/components/ui/button";
import { Handshake } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useNavigate } from "react-router-dom";
import { openChallengeComposer } from "@/lib/challenges";

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
  context?: "leaderboard" | "collection";
  onPickerOpen?: () => void;
}

/** Opens the challenge composer. Friendly Challenge is the default; Capture is opt-in inside. */
const BattleButton: React.FC<BattleButtonProps> = ({ targetSpider, size = "sm", variant = "outline", className = "", onPickerOpen }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const own = !!user && targetSpider.owner_id === user.id;
  return (
    <Button
      size={size}
      variant={variant}
      className={`gap-1 ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        if (!user) { navigate("/auth"); return; }
        onPickerOpen?.();
        openChallengeComposer(own ? { mySpiderId: targetSpider.id } : { targetSpider: { ...targetSpider } });
      }}
    >
      <Handshake className="h-4 w-4" />
      {own ? "Challenge with this spider" : "Challenge"}
    </Button>
  );
};

export default BattleButton;
