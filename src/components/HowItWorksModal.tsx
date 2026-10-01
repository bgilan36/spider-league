import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { HelpCircle, Upload, Sword, Trophy, Target, Shield, Zap, Sparkles, CircleHelp } from "lucide-react";
import { ModeRulesList, RosterRulesList, RankingRulesList } from "@/components/RulesSummary";

export const HowItWorksModal = () => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Rules and guide">
          <HelpCircle className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl sm:max-w-2xl w-[95vw] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Spider League Rules & Guide</DialogTitle>
          <DialogDescription>
            Current gameplay rules for uploads, skirmishes, battles, and rewards.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <section>
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <Upload className="mr-2 h-5 w-5 text-primary" />
              Core Loop
            </h3>
            <div className="space-y-2 text-sm">
              <p>1. <strong>Start with a spider:</strong> New accounts receive a starter spider so you can play immediately.</p>
              <p>2. <strong>Upload real spiders:</strong> Take photos of spiders you find and upload them to generate playable fighters.</p>
              <p>3. <strong>Set your Starting 5:</strong> Your active roster battles in Training, Friendly Challenges and Capture Battles.</p>
              <p>4. <strong>Compete and progress:</strong> Win battles and Wild Skirmishes to earn XP, level up and climb the rankings.</p>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <CircleHelp className="mr-2 h-5 w-5 text-primary" />
              Starting 5 & Eligibility
            </h3>
            <RosterRulesList />
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <Sword className="mr-2 h-5 w-5 text-primary" />
              Battle Modes
            </h3>
            <ModeRulesList />
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <Target className="mr-2 h-5 w-5 text-primary" />
              Combat Stats
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center">
                <Trophy className="mr-2 h-4 w-4" />
                <div>
                  <strong>Hit Points:</strong> Health/endurance
                </div>
              </div>
              <div className="flex items-center">
                <Target className="mr-2 h-4 w-4" />
                <div>
                  <strong>Damage:</strong> Attack power
                </div>
              </div>
              <div className="flex items-center">
                <Zap className="mr-2 h-4 w-4" />
                <div>
                  <strong>Speed:</strong> Initiative & agility
                </div>
              </div>
              <div className="flex items-center">
                <Shield className="mr-2 h-4 w-4" />
                <div>
                  <strong>Defense:</strong> Damage resistance
                </div>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 mr-2 bg-purple-500 rounded-full" />
                <div>
                  <strong>Venom:</strong> Special poison attacks
                </div>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 mr-2 bg-blue-500 rounded-full" />
                <div>
                  <strong>Webcraft:</strong> Web-based abilities
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <Trophy className="mr-2 h-5 w-5 text-primary" />
              Progression & Ranking
            </h3>
            <RankingRulesList />
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-3">Power & Rarity</h3>
            <p className="text-sm text-muted-foreground">
              Power (⚡) summarizes overall combat strength. Rarity tiers (Common to Legendary) indicate overall quality bands, but battles and skirmishes are still decided by full stat interactions and turn-by-turn outcomes.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};
