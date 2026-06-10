import { Button } from "@/components/ui/button";
import { Sword } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useStartSkillBattle } from "@/components/battle/useStartSkillBattle";

interface InstantBattleButtonProps {
  opponentSpiderId: string;
  opponentUserId: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "ghost";
  className?: string;
  label?: string;
}

/**
 * Starts an actual battle (with stance picker) immediately, instead of
 * creating a pending challenge. Uses the user's best eligible spider.
 */
const InstantBattleButton: React.FC<InstantBattleButtonProps> = ({
  opponentSpiderId,
  opponentUserId,
  size = "sm",
  variant = "default",
  className = "",
  label = "Battle",
}) => {
  const { user } = useAuth();
  const { open, picker } = useStartSkillBattle();

  if (!user || user.id === opponentUserId) return null;

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          open({ opponentSpiderId, opponentUserId });
        }}
      >
        <Sword className="h-4 w-4" />
        <span className="ml-1">{label}</span>
      </Button>
      {picker}
    </>
  );
};

export default InstantBattleButton;