import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const [showConfirm, setShowConfirm] = useState(false);

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
            onClick={() => setShowConfirm(true)}
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

      {/* Quick Battle Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sword className="h-5 w-5 text-primary" />
              Start Quick Battle?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Your strongest eligible spider will be matched against a similarly-powered opponent in a <strong>Training Battle</strong>.</p>
              <p className="text-xs text-muted-foreground">No spiders will be lost — you'll earn XP and stat boosts regardless of the outcome.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowConfirm(false);
                handleQuickBattle();
              }}
            >
              <Sword className="h-4 w-4 mr-1" />
              Battle!
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="mt-0 px-0">
        <ActiveChallengesPreview embedded />
      </div>
    </Card>
  );
};

export default CombatHub;
