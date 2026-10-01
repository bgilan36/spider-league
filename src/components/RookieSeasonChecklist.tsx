import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Camera, Swords, Users, Send, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { toast } from "sonner";
import { usePracticeBattle } from "@/components/battle/usePracticeBattle";

type StepKey = "trained" | "caught" | "friendly" | "podded";
type Progress = Record<StepKey, boolean> & { completed: boolean; dismissed: boolean; claimed?: string[] };

const STEPS: { key: StepKey; title: string; hint: string; cta: string; icon: any; route: string | null; xp: number }[] = [
  { key: "trained", title: "Complete a training battle", hint: "Win or lose — vs an AI practice opponent", cta: "Start", icon: Swords, route: null, xp: 25 },
  { key: "caught", title: "Discover & upload a spider", hint: "Snap any spider you find", cta: "Upload", icon: Camera, route: "/upload", xp: 25 },
  { key: "friendly", title: "Play a Friendly Challenge", hint: "Post one, or accept someone else's", cta: "Challenge", icon: Send, route: "/collection", xp: 25 },
  { key: "podded", title: "Join or create a pod", hint: "Battle with friends", cta: "Browse pods", icon: Users, route: "/pods", xp: 25 },
];

const RookieSeasonChecklist = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);
  const [awarding, setAwarding] = useState(false);
  const { start: startPractice, picker: practicePicker } = usePracticeBattle();

  const fetchProgress = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.rpc("get_rookie_season_progress");
    if (!error && data) setProgress(data as unknown as Progress);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchProgress();
    const onFocus = () => fetchProgress();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchProgress]);

  // Pay each finished milestone once (server checks completion and dedupes).
  useEffect(() => {
    if (!progress) return;
    const unclaimed = STEPS.filter((st) => progress[st.key] && !(progress.claimed || []).includes(st.key));
    if (unclaimed.length === 0) return;
    Promise.all(unclaimed.map((st) => supabase.rpc("claim_rookie_milestone" as any, { p_step: st.key })))
      .then((results) => {
        const xp = results.reduce((sum, r: any) => sum + (r.data?.awarded ? Number(r.data.xp) || 0 : 0), 0);
        if (xp > 0) toast.success(`Rookie Season: +${xp} XP`, { id: "rookie-xp" });
        fetchProgress();
      });
  }, [progress, fetchProgress]);

  // Auto-award when all four steps are complete.
  useEffect(() => {
    if (!progress || awarding) return;
    const allDone = STEPS.every((st) => progress[st.key]);
    if (allDone && !progress.completed) {
      setAwarding(true);
      supabase.rpc("complete_rookie_season").then(({ data }) => {
        if (data && (data as any).awarded) {
          toast.success("Rookie Season Champion!", {
            description: "+100 XP and a permanent badge added to your profile.",
            icon: <Sparkles className="h-4 w-4" />,
          });
        }
        fetchProgress();
      });
    }
  }, [progress, awarding, fetchProgress]);

  const dismiss = async () => {
    if (!user) return;
    await supabase
      .from("profile_settings")
      .upsert({ id: user.id, rookie_season_dismissed: true }, { onConflict: "id" });
    setProgress((p) => (p ? { ...p, dismissed: true } : p));
  };

  if (!user || loading || !progress) return null;
  if (progress.dismissed || progress.completed) return null;

  const doneCount = STEPS.filter((st) => progress[st.key]).length;
  const totalXp = STEPS.reduce((sum, s) => sum + s.xp, 0) + 100;

  return (
    <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background p-4 sm:p-5">
      <button
        onClick={dismiss}
        aria-label="Dismiss Rookie Season"
        className="absolute top-2 right-2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 mb-4 pr-6">
        <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-bold text-base sm:text-lg">Rookie Season</h2>
            <Badge variant="secondary" className="text-[10px]">
              {doneCount}/{STEPS.length}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Finish all four to unlock the <span className="font-semibold text-foreground">Rookie Season Champion</span> badge and {totalXp} XP.
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {STEPS.map((step) => {
          const done = !!progress[step.key];
          const Icon = step.icon;
          return (
            <li
              key={step.key}
              className={`flex items-center gap-3 rounded-lg border p-2.5 transition-colors ${
                done ? "border-primary/30 bg-primary/5" : "border-border bg-card"
              }`}
            >
              <div
                className={`h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                  done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${done ? "text-muted-foreground line-through" : ""}`}>
                  {step.title}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">{step.hint} · <span className="text-primary font-semibold">+{step.xp} XP</span></p>
              </div>
              {!done && (
                <Button size="sm" variant="default" onClick={() => (step.route ? navigate(step.route) : startPractice())} className="flex-shrink-0">
                  {step.cta}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {practicePicker}
    </Card>
  );
};

export default RookieSeasonChecklist;