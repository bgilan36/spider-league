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

export const HowItWorksModal = () => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
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
              <p>3. <strong>Build your roster:</strong> Choose weekly battle-eligible spiders and run skirmishes any time from your collection.</p>
              <p>4. <strong>Compete and progress:</strong> Win battles and skirmishes to grow your account and spiders.</p>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <CircleHelp className="mr-2 h-5 w-5 text-primary" />
              Weekly Eligibility Rules (Battles)
            </h3>
            <div className="space-y-2 text-sm">
              <p>• <strong>3 weekly battle slots:</strong> Your weekly battle roster has three slots.</p>
              <p>• <strong>Upload cap:</strong> You can upload up to three spiders per week (week resets Sunday, PT).</p>
              <p>• <strong>Mix-and-match roster:</strong> You can activate one older spider, then fill remaining slots with new weekly uploads.</p>
              <p>• <strong>Battles use eligible spiders:</strong> Only weekly eligible spiders can be used for battle challenges.</p>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <Sparkles className="mr-2 h-5 w-5 text-primary" />
              Skirmish Rules
            </h3>
            <div className="space-y-2 text-sm">
              <p>• <strong>Any spider can skirmish:</strong> Skirmishes can use any spider in your collection (not just weekly eligible spiders).</p>
              <p>• <strong>Suggested even matchup:</strong> The app suggests a relatively balanced opponent from another user.</p>
              <p>• <strong>Daily limit:</strong> Each user can run up to <strong>3 skirmishes per day</strong>.</p>
              <p>• <strong>Skirmish rewards:</strong> Winning gives XP to the winning user and modest stat boosts to the winning spider.</p>
              <p>• <strong>No ownership transfer:</strong> Skirmishes are scrimmages; spider ownership never changes.</p>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <Sword className="mr-2 h-5 w-5 text-primary" />
              Battle Rules
            </h3>
            <div className="space-y-2 text-sm">
              <p>• <strong>Challenge system:</strong> Create or accept battle challenges with weekly eligible spiders.</p>
              <p>• <strong>High stakes:</strong> In battles, the losing spider transfers to the winning user.</p>
              <p>• <strong>Battle XP:</strong> Completed matchup battles award XP to the winning user.</p>
            </div>
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
            <div className="space-y-2 text-sm">
              <p>• <strong>User XP:</strong> XP is earned from skirmish wins and battle wins.</p>
              <p>• <strong>Spider growth:</strong> Stat boosts apply to the specific spider that wins a skirmish.</p>
              <p>• <strong>Leaderboard score:</strong> Rankings reflect both spider power and earned XP.</p>
              <p>• <strong>Server-authoritative outcomes:</strong> Match results and rewards are validated server-side.</p>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-3">Power Score & Rarity</h3>
            <p className="text-sm text-muted-foreground">
              Power Score summarizes overall combat strength. Rarity tiers (Common to Legendary) indicate overall quality bands, but battles and skirmishes are still decided by full stat interactions and turn-by-turn outcomes.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};
