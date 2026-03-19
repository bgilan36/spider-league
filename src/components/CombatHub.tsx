import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Bug, Sword, Zap } from "lucide-react";
import { SpiderSkirmishCard } from "@/components/SpiderSkirmishCard";
import ActiveChallengesPreview from "@/components/ActiveChallengesPreview";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";

const CombatHub = () => {
  const { user } = useAuth();
  const [acceptableChallengeCount, setAcceptableChallengeCount] = useState(0);

  const fetchAcceptableChallenges = useCallback(async () => {
    if (!user) {
      setAcceptableChallengeCount(0);
      return;
    }
    const now = new Date().toISOString();
    const { count } = await supabase
      .from("battle_challenges")
      .select("id", { count: "exact", head: true })
      .eq("status", "OPEN")
      .neq("challenger_id", user.id)
      .gt("expires_at", now);
    setAcceptableChallengeCount(count ?? 0);
  }, [user]);

  useEffect(() => {
    fetchAcceptableChallenges();

    const channel = supabase
      .channel("combat-hub-challenges")
      .on("postgres_changes", { event: "*", schema: "public", table: "battle_challenges" }, () => {
        fetchAcceptableChallenges();
      })
      .subscribe();

    const handleChallengeEvent = () => fetchAcceptableChallenges();
    window.addEventListener("challenge:created", handleChallengeEvent);
    window.addEventListener("challenge:cancelled", handleChallengeEvent);
    window.addEventListener("challenge:accepted", handleChallengeEvent);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("challenge:created", handleChallengeEvent);
      window.removeEventListener("challenge:cancelled", handleChallengeEvent);
      window.removeEventListener("challenge:accepted", handleChallengeEvent);
    };
  }, [fetchAcceptableChallenges]);

  // Default to battles tab when there are challenges to accept, otherwise skirmish
  const defaultTab = acceptableChallengeCount > 0 ? "battles" : "skirmish";

  return (
    <Card className="overflow-hidden">
      <Tabs defaultValue={defaultTab} key={defaultTab}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Combat Hub
            </CardTitle>
          </div>
          <TabsList className="w-full mt-2">
            <TabsTrigger value="skirmish" className="flex-1 gap-1.5 data-[state=active]:text-primary">
              <Bug className="h-3.5 w-3.5" />
              Skirmish
            </TabsTrigger>
            <TabsTrigger value="battles" className="flex-1 gap-1.5 data-[state=active]:text-destructive relative">
              <Sword className="h-3.5 w-3.5" />
              Battles
              {acceptableChallengeCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground px-1 animate-pulse">
                  {acceptableChallengeCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </CardHeader>

        <TabsContent value="skirmish" className="mt-0 px-0">
          <SpiderSkirmishCard embedded />
        </TabsContent>

        <TabsContent value="battles" className="mt-0 px-0">
          <ActiveChallengesPreview embedded />
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default CombatHub;
