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

interface OnboardingModalProps {
  open: boolean;
  onComplete: () => void;
}

const TOTAL_SLIDES = 3; // 0 = starter + first battle, 1-2 = optional rules

const OnboardingModal = ({ open, onComplete }: OnboardingModalProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
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

  const handleCatch = async () => {
    if (user) {
      await supabase.from("profile_settings").upsert({ id: user.id, has_completed_onboarding: true }, { onConflict: "id" });
    }
    onComplete();
    navigate("/upload");
  };

  const beats = [
    { icon: Camera, title: "Catch spiders all week", body: "Photograph real spiders you find. Each becomes a fighter with real stats." },
    { icon: Clock, title: "Entries lock Sunday at 5pm PT", body: "Your top 3 catches of the week enter the Global Cup and your friend pods." },
    { icon: Sparkles, title: "Results are revealed Sunday night", body: "Watch your brackets play out round by round, then meet the champion." },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) markComplete(); }}>
      <DialogContent className="max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
        <div className="flex flex-col items-center text-center gap-4 py-2">
          <h2 className="text-2xl font-black">Welcome to Spider League</h2>
          <p className="text-sm text-muted-foreground">One tournament a week. Here's how it works:</p>
          <ol className="w-full space-y-3 text-left">
            {beats.map((b, i) => (
              <li key={b.title} className="flex gap-3 rounded-lg border border-border bg-card/60 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary font-black">{i + 1}</div>
                <div>
                  <div className="font-bold flex items-center gap-1.5"><b.icon className="h-4 w-4 text-primary" />{b.title}</div>
                  <div className="text-sm text-muted-foreground">{b.body}</div>
                </div>
              </li>
            ))}
          </ol>
          {starterSpider && (
            <p className="text-xs text-muted-foreground">We've added a starter spider, <b className="text-foreground">{starterSpider.nickname}</b>, to your collection. It can fight in your pods as a veteran.</p>
          )}
          <Button size="lg" className="w-full h-14 text-lg font-bold" onClick={handleCatch}>
            <Camera className="mr-2 h-5 w-5" /> Catch your first spider
          </Button>
          <Button variant="ghost" className="w-full" onClick={markComplete} disabled={creatingSpider}>
            {creatingSpider ? <Loader2 className="h-4 w-4 animate-spin" /> : "Look around first"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingModal;
