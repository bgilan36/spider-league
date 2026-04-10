import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Zap, CircleHelp, Sword, Loader2 } from "lucide-react";
import ActiveChallengesPreview from "@/components/ActiveChallengesPreview";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

const CombatHub = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [quickBattleLoading, setQuickBattleLoading] = useState(false);

  const handleQuickBattle = async () => {
    if (!user) return;
    setQuickBattleLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('quick-battle', {
        body: {}
      });

      if (error) throw error;

      if (data?.error) {
        toast({
          title: "Can't start battle",
          description: data.error,
          variant: "destructive"
        });
        return;
      }

      if (data?.battleId) {
        toast({
          title: "Battle Complete!",
          description: "Viewing results...",
        });
        navigate(`/battle/${data.battleId}`);
      }
    } catch (error: any) {
      console.error('Quick battle error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to start quick battle",
        variant: "destructive"
      });
    } finally {
      setQuickBattleLoading(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Combat Hub
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Combat Hub info"
                >
                  <CircleHelp className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
                <p className="font-semibold mb-1">Unified Battle System</p>
                <p><strong>Training Battles</strong> are the default — earn XP and stat boosts with no risk of losing your spider.</p>
                <p className="mt-1"><strong>All-or-Nothing</strong> battles are opt-in — the winner takes the loser's spider. Both players must agree to the stakes.</p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </div>

        {/* Quick Battle button */}
        {user && (
          <Button
            onClick={handleQuickBattle}
            disabled={quickBattleLoading}
            className="w-full mt-3 gap-2"
            size="lg"
          >
            {quickBattleLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Finding opponent...
              </>
            ) : (
              <>
                <Sword className="h-4 w-4" />
                Quick Battle
                <Badge variant="secondary" className="ml-1 text-[10px]">Training</Badge>
              </>
            )}
          </Button>
        )}
      </CardHeader>

      <div className="mt-0 px-0">
        <ActiveChallengesPreview embedded />
      </div>
    </Card>
  );
};

export default CombatHub;
