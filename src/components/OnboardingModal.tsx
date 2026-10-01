import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, Sword, Skull, Zap, Shield, ChevronLeft, ChevronRight, Loader2, Target, Clock, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { useNavigate } from "react-router-dom";
import PowerScoreArc from "@/components/PowerScoreArc";
import { ensureStarterSpider, type StarterSpider } from "@/lib/starterSpider";
import { RULES, MODES, ROSTER_COPY } from "@/lib/gameRules";
import { usePracticeBattle } from "@/components/battle/usePracticeBattle";

interface OnboardingModalProps {
  open: boolean;
  onComplete: () => void;
}

const TOTAL_SLIDES = 3; // 0 = starter + first battle, 1-2 = optional rules

const OnboardingModal = ({ open, onComplete }: OnboardingModalProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { start: startPractice, picker: practicePicker } = usePracticeBattle();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [starterSpider, setStarterSpider] = useState<StarterSpider | null>(null);
  const [starterState, setStarterState] =
    useState<"idle" | "loading" | "ready" | "inactive" | "session_expired" | "failed">("idle");
  const [spiderCreated, setSpiderCreated] = useState(false);
  const creatingSpider = starterState === "loading";

  // Provision as soon as onboarding opens — independent of which slide is viewed,
  // so skipping or jumping ahead can never leave an empty roster.
  useEffect(() => {
    if (open && user && starterState === "idle") createStarterSpider();
  }, [open, user, starterState]);

  const createStarterSpider = async () => {
    if (!user) return;
    setStarterState("loading");
    const res = await ensureStarterSpider(user.id);
    if (res.status === "ready") {
      setStarterSpider(res.spider);
      setSpiderCreated(res.created);
      setStarterState(res.active ? "ready" : "inactive");
    } else {
      setStarterState(res.status);
    }
  };

  const markComplete = async () => {
    // Skipping still waits for the starter so the roster isn't empty when the modal closes.
    let spiderId = starterSpider?.id;
    if (user && !spiderId) {
      const res = await ensureStarterSpider(user.id);
      if (res.status === "ready") { setStarterSpider(res.spider); spiderId = res.spider.id; }
    }
    if (user) {
      await supabase
        .from("profile_settings")
        .upsert({ id: user.id, has_completed_onboarding: true }, { onConflict: "id" });
    }
    onComplete();
    // Nudge the Starting 5 to reload now that the starter exists.
    if (spiderId) navigate('/', { replace: true, state: { newSpiderId: spiderId } });
  };

  const handleStartFirstBattle = async () => {
    if (!user || !starterSpider) return;
    await supabase
      .from("profile_settings")
      .upsert({ id: user.id, has_completed_onboarding: true }, { onConflict: "id" });
    onComplete();
    startPractice(starterSpider.id);
  };

  const next = () => {
    if (currentSlide < TOTAL_SLIDES - 1) setCurrentSlide((s) => s + 1);
  };
  const prev = () => {
    if (currentSlide > 0) setCurrentSlide((s) => s - 1);
  };

  const statBar = (label: string, icon: string, value: number) => (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-4">{icon}</span>
      <span className="w-14 text-muted-foreground">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${value}%` }} />
      </div>
      <span className="w-6 text-right font-mono text-muted-foreground">{value}</span>
    </div>
  );

  const slides = [
    // Slide 3: Starter Spider Reveal
    <div key="starter" className="flex flex-col items-center text-center gap-3 py-2">
      <Sparkles className="h-6 w-6 text-primary animate-pulse" />
      <h2 className="text-xl font-bold">Your Starter Spider!</h2>
      {creatingSpider ? (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Hatching your starter spider...</p>
        </div>
      ) : starterSpider ? (
        <>
           <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-primary/30 bg-muted">
            <img
              src="/images/starter-spider.png"
              alt={starterSpider.nickname}
              className="w-full h-full object-cover"
            />
          </div>
          <p className="font-bold text-lg">{starterSpider.nickname}</p>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">{starterSpider.species}</p>
            <Badge variant="secondary" className="text-[10px]">{starterSpider.rarity}</Badge>
          </div>
          <div className="w-20">
            <PowerScoreArc score={starterSpider.power_score} />
          </div>
          <div className="w-full max-w-[260px] space-y-1.5">
            {statBar("HP", "❤️", starterSpider.hit_points)}
            {statBar("Damage", "⚔️", starterSpider.damage)}
            {statBar("Speed", "💨", starterSpider.speed)}
            {statBar("Defense", "🛡️", starterSpider.defense)}
            {statBar("Venom", "☠️", starterSpider.venom)}
            {statBar("Webcraft", "🕸️", starterSpider.webcraft)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {starterState === "inactive"
              ? "This spider is retired — re-enlist it from your collection to battle."
              : spiderCreated
                ? "This spider has been added to your Starting 5!"
                : "Your starter spider is ready in your Starting 5!"}
          </p>
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 py-6">
          <p className="text-muted-foreground text-sm max-w-xs">
            {starterState === "session_expired"
              ? "Your session ended before we could hatch your starter. Sign in again to get it."
              : "We couldn't hatch your starter spider yet."}
          </p>
          {starterState !== "session_expired" && (
            <Button size="sm" variant="outline" onClick={createStarterSpider}>Try again</Button>
          )}
        </div>
      )}
    </div>,

  ];

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { if (!o) markComplete(); }}>
      <DialogContent className="max-w-md p-6 gap-0 [&>button]:hidden">
        <div className="min-h-[380px] flex items-center justify-center">
          {slides[currentSlide]}
        </div>

        {/* Navigation */}
        {currentSlide === 0 ? (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <Button variant="ghost" size="sm" onClick={next} className="gap-1">
              How it works <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={markComplete}>Skip for now</Button>
          </div>
        ) : (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <Button variant="ghost" size="sm" onClick={prev} className="gap-1">
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            {currentSlide < TOTAL_SLIDES - 1 ? (
              <Button variant="ghost" size="sm" onClick={next} className="gap-1">
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setCurrentSlide(0)} className="gap-1 text-primary">
                Back to my spider
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
    {practicePicker}
    </>
  );
};

export default OnboardingModal;
