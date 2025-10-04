import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { HelpCircle, Upload, Sword, Trophy, Target, Shield, Zap } from "lucide-react";

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
            Everything you need to know about competing in Spider League
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 mt-4">
          {/* Getting Started */}
          <section>
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <Upload className="mr-2 h-5 w-5 text-primary" />
              Getting Started
            </h3>
            <div className="space-y-2 text-sm">
              <p>1. <strong>Starter Spider:</strong> New players automatically receive a starter spider (300 Power Score) ready for battles</p>
              <p>2. <strong>Upload Your Spider:</strong> Take a clear photo of any spider you find</p>
              <p>3. <strong>Weekly Limit:</strong> Each user can upload up to THREE spiders per week that are eligible for battles and challenges</p>
              <p>4. <strong>Week Reset:</strong> New upload window starts every Sunday at 12am PT</p>
              <p>5. <strong>AI Analysis:</strong> Our system identifies the species and generates battle stats</p>
              <p>6. <strong>Ranking:</strong> Your spiders get ranked on leaderboards based on Power Score</p>
              <p>7. <strong>Collection:</strong> Your spiders join your fighter roster with unique abilities</p>
            </div>
          </section>

          {/* Stats System */}
          <section>
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <Target className="mr-2 h-5 w-5 text-primary" />
              Combat Stats System
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

          {/* Rarity System */}
          <section>
            <h3 className="text-lg font-semibold mb-3">Spider Rarity</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center">
                <div className="w-4 h-4 mr-2 bg-gray-500 rounded" />
                <strong>Common:</strong> Basic spiders with standard stats
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 mr-2 bg-green-500 rounded" />
                <strong>Uncommon:</strong> Slightly enhanced abilities
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 mr-2 bg-blue-500 rounded" />
                <strong>Rare:</strong> Strong fighters with good stats
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 mr-2 bg-purple-500 rounded" />
                <strong>Epic:</strong> Powerful spiders with high stats
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 mr-2 bg-amber-500 rounded" />
                <strong>Legendary:</strong> Elite fighters with maximum potential
              </div>
            </div>
          </section>

          {/* Battle System (Coming Soon) */}
          <section>
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <Sword className="mr-2 h-5 w-5 text-primary" />
              Battle System (Coming Soon)
            </h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• <strong>Weekly Matchups:</strong> Compete against other players</p>
              <p>• <strong>Team Strategy:</strong> Build balanced teams of 3 spiders</p>
              <p>• <strong>Turn-Based Combat:</strong> Speed determines turn order</p>
              <p>• <strong>Special Abilities:</strong> Venom and web attacks provide tactical advantages</p>
              <p>• <strong>Seasonal Rankings:</strong> Climb the leaderboard for glory</p>
            </div>
          </section>

          {/* Power Score */}
          <section>
            <h3 className="text-lg font-semibold mb-3">Power Score</h3>
            <p className="text-sm">
              Your spider's overall combat effectiveness, calculated from all stats. Higher power scores indicate stronger fighters capable of competing at elite levels.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};