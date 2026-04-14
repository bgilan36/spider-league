import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, Sword, Skull, Zap, Shield, ChevronLeft, ChevronRight, Loader2, Target, Clock, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { useNavigate } from "react-router-dom";
import PowerScoreArc from "@/components/PowerScoreArc";

interface StarterSpider {
  id: string;
  nickname: string;
  species: string;
  image_url: string;
  power_score: number;
  rarity: string;
  hit_points: number;
  damage: number;
  speed: number;
  defense: number;
  venom: number;
  webcraft: number;
}

interface OnboardingModalProps {
  open: boolean;
  onComplete: () => void;
}

const TOTAL_SLIDES = 5;

const OnboardingModal = ({ open, onComplete }: OnboardingModalProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [starterSpider, setStarterSpider] = useState<StarterSpider | null>(null);
  const [creatingSpider, setCreatingSpider] = useState(false);
  const [spiderCreated, setSpiderCreated] = useState(false);

  // Create starter spider when reaching slide 3 (reveal slide)
  useEffect(() => {
    if (open && user && currentSlide === 3 && !starterSpider && !creatingSpider) {
      createStarterSpider();
    }
  }, [open, user, currentSlide]);

  const createStarterSpider = async () => {
    if (!user) return;
    setCreatingSpider(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-starter-spider');
      if (error) throw error;
      if (data?.spider) {
        setStarterSpider(data.spider);
        setSpiderCreated(!data.alreadyExists);
      }
    } catch (err) {
      console.error('Failed to create starter spider:', err);
    } finally {
      setCreatingSpider(false);
    }
  };

  const markComplete = async () => {
    if (user) {
      await supabase
        .from("profile_settings")
        .upsert({ id: user.id, has_completed_onboarding: true }, { onConflict: "id" });
    }
    onComplete();
  };

  const handleStartFirstBattle = async () => {
    await markComplete();
    // Navigate to home where the Starting 5 has the Battle Now button
    navigate('/', { replace: true });
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
    // Slide 0: Welcome
    <div key="welcome" className="flex flex-col items-center text-center gap-4 py-4">
      <img
        src="/lovable-uploads/12c04e49-1f4c-4ed1-b840-514c07b83c24.png"
        alt="Spider League Logo"
        className="h-24 w-auto drop-shadow-lg"
      />
      <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
        Welcome to Spider League!
      </h2>
      <p className="text-muted-foreground max-w-sm">
        Collect real spiders, build your roster, and battle for glory. Let's show you the ropes.
      </p>
    </div>,

    // Slide 1: Your Starting 5
    <div key="starting5" className="flex flex-col items-center text-center gap-4 py-4">
      <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Target className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-xl font-bold">Your Starting 5</h2>
      <div className="text-left max-w-sm space-y-3">
        <div className="flex gap-2">
          <Camera className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Upload real spiders</span>
            <span className="text-muted-foreground text-sm"> — Find spiders in the wild, snap a photo, and we'll create a unique fighter.</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">5 active at a time</span>
            <span className="text-muted-foreground text-sm"> — Each spider stays active for 30 days. Max 5 in your roster.</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div>
            <span className="text-muted-foreground text-sm">Expired spiders can be re-enlisted for another 30 days.</span>
          </div>
        </div>
      </div>
    </div>,

    // Slide 2: Two ways to fight
    <div key="combat" className="flex flex-col items-center text-center gap-4 py-4">
      <div className="flex gap-3">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Sword className="h-7 w-7 text-primary" />
        </div>
        <div className="h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <Skull className="h-7 w-7 text-destructive" />
        </div>
      </div>
      <h2 className="text-xl font-bold">Two Ways to Fight</h2>
      <div className="text-left max-w-sm space-y-3">
        <div className="flex gap-2">
          <Sword className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-primary">Battle Now</span>
            <span className="text-muted-foreground text-sm"> — Training battles. Earn XP and stat boosts with zero risk. 1 hour cooldown per spider.</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Skull className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-destructive">Battle to the Death</span>
            <span className="text-muted-foreground text-sm"> — Winner takes the loser's spider forever. Both players must agree before it starts.</span>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground/70 max-w-sm mt-1">
        All battles are run from your Starting 5 roster — just click the button on any active spider card.
      </p>
    </div>,

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
              src={starterSpider.image_url}
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
            {spiderCreated
              ? "This spider has been added to your Starting 5!"
              : "Your starter spider is ready in your Starting 5!"}
          </p>
        </>
      ) : (
        <p className="text-muted-foreground text-sm py-8">
          Something went wrong. You can upload your first spider after onboarding.
        </p>
      )}
    </div>,

    // Slide 4: Go battle!
    <div key="battle" className="flex flex-col items-center text-center gap-4 py-4">
      <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Zap className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-xl font-bold">Time for Your First Battle!</h2>
      <p className="text-muted-foreground max-w-sm">
        Your starter spider is ready. Hit the button below to jump to your Starting 5 roster and start your first training battle.
      </p>
      <div className="bg-muted/50 rounded-lg p-3 max-w-sm text-left text-xs text-muted-foreground space-y-1">
        <p>💡 <strong>Tip:</strong> Click <strong>"Battle Now"</strong> on your spider card to preview a matchup and fight!</p>
        <p>💡 Win battles to earn XP and power up your spider's stats.</p>
        <p>💡 Upload more spiders from the wild to fill your 5 roster slots.</p>
      </div>
      <Button onClick={handleStartFirstBattle} className="mt-2 w-full max-w-[260px]" size="lg">
        <Sword className="h-4 w-4 mr-2" />
        Go to My Starting 5
      </Button>
    </div>,
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) markComplete(); }}>
      <DialogContent className="max-w-md p-6 gap-0 [&>button]:hidden">
        <div className="min-h-[380px] flex items-center justify-center">
          {slides[currentSlide]}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={prev}
            disabled={currentSlide === 0}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>

          {/* Dots */}
          <div className="flex gap-1.5">
            {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`h-2 rounded-full transition-all ${
                  i === currentSlide ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>

          {currentSlide < TOTAL_SLIDES - 1 ? (
            <Button variant="ghost" size="sm" onClick={next} className="gap-1">
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={markComplete} className="gap-1 text-primary">
              Skip
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingModal;
