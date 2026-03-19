import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Sword, Bug, Zap, Shield, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import PowerScoreArc from "@/components/PowerScoreArc";

interface StarterSpider {
  nickname: string;
  species: string;
  image_url: string;
  power_score: number;
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

const TOTAL_SLIDES = 4;

const OnboardingModal = ({ open, onComplete }: OnboardingModalProps) => {
  const { user } = useAuth();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [starterSpider, setStarterSpider] = useState<StarterSpider | null>(null);

  useEffect(() => {
    if (open && user) {
      supabase
        .from("spiders")
        .select("nickname, species, image_url, power_score, hit_points, damage, speed, defense, venom, webcraft")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .single()
        .then(({ data }) => {
          if (data) setStarterSpider(data);
        });
    }
  }, [open, user]);

  const markComplete = async () => {
    if (user) {
      await supabase
        .from("profile_settings")
        .upsert({ id: user.id, has_completed_onboarding: true }, { onConflict: "id" });
    }
    onComplete();
  };

  const next = () => {
    if (currentSlide < TOTAL_SLIDES - 1) setCurrentSlide((s) => s + 1);
  };
  const prev = () => {
    if (currentSlide > 0) setCurrentSlide((s) => s - 1);
  };

  const statBar = (label: string, value: number) => (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-muted-foreground">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
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
        Collect real spiders, generate unique fighters, and battle other players for glory and loot.
      </p>
    </div>,

    // Slide 1: Upload & Collect
    <div key="upload" className="flex flex-col items-center text-center gap-4 py-4">
      <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Camera className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-xl font-bold">Upload & Collect</h2>
      <p className="text-muted-foreground max-w-sm">
        Find real spiders in the wild, snap a photo, and upload it. We'll identify the species and generate a unique fighter with randomized stats and rarity.
      </p>
      <p className="text-xs text-muted-foreground/70">You can upload up to 3 new spiders per week.</p>
    </div>,

    // Slide 2: Combat
    <div key="combat" className="flex flex-col items-center text-center gap-4 py-4">
      <div className="flex gap-3">
        <div className="h-14 w-14 rounded-2xl bg-blue-500/10 flex items-center justify-center">
          <Bug className="h-7 w-7 text-blue-400" />
        </div>
        <div className="h-14 w-14 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <Sword className="h-7 w-7 text-red-400" />
        </div>
      </div>
      <h2 className="text-xl font-bold">Two Ways to Fight</h2>
      <div className="text-left max-w-sm space-y-3">
        <div className="flex gap-2">
          <Bug className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-blue-400">Skirmishes</span>
            <span className="text-muted-foreground text-sm"> — Daily practice battles. Earn XP with no risk. 3 per day.</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Sword className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-red-400">Battles</span>
            <span className="text-muted-foreground text-sm"> — High stakes! The winner takes the loser's spider.</span>
          </div>
        </div>
      </div>
    </div>,

    // Slide 3: Get Started + Starter Spider
    <div key="getstarted" className="flex flex-col items-center text-center gap-3 py-2">
      <h2 className="text-xl font-bold">You're Ready!</h2>
      {starterSpider ? (
        <>
          <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-primary/30 bg-muted">
            <img
              src={starterSpider.image_url}
              alt={starterSpider.nickname}
              className="w-full h-full object-cover"
            />
          </div>
          <p className="font-semibold text-sm">{starterSpider.nickname}</p>
          <p className="text-xs text-muted-foreground">{starterSpider.species}</p>
          <div className="w-20">
            <PowerScoreArc score={starterSpider.power_score} />
          </div>
          <div className="w-full max-w-[240px] space-y-1">
            {statBar("HP", starterSpider.hit_points)}
            {statBar("Damage", starterSpider.damage)}
            {statBar("Speed", starterSpider.speed)}
            {statBar("Defense", starterSpider.defense)}
            {statBar("Venom", starterSpider.venom)}
            {statBar("Webcraft", starterSpider.webcraft)}
          </div>
          <p className="text-muted-foreground text-sm max-w-sm mt-1">
            You already have your first spider — jump into a Skirmish right now!
          </p>
        </>
      ) : (
        <p className="text-muted-foreground text-sm">
          Your starter spider is being prepared...
        </p>
      )}
      <Button onClick={markComplete} className="mt-2 w-full max-w-[240px]" size="lg">
        <Zap className="h-4 w-4 mr-2" />
        Enter the Arena
      </Button>
    </div>,
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) markComplete(); }}>
      <DialogContent className="max-w-md p-6 gap-0 [&>button]:hidden">
        <div className="min-h-[340px] flex items-center justify-center">
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
