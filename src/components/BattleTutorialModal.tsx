import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sword, Shield, Zap, SkipForward, Trophy, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface BattleTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BattleTutorialModal = ({ isOpen, onClose }: BattleTutorialModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Sword className="w-6 h-6 text-primary" />
            Turn-Based Battle Guide
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Overview */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-bold mb-3">How Battles Work</h3>
              <p className="text-muted-foreground mb-4">
                Battle challenges are turn-based strategic combat between spiders. Players take turns choosing actions, 
                and the battle continues until one spider's HP reaches 0. The winner claims ownership of the losing spider!
              </p>
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">
                  <strong>Warning:</strong> The losing spider will be permanently transferred to the winner's collection.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-bold mb-4">Battle Actions</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Sword className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Attack</h4>
                    <p className="text-sm text-muted-foreground">
                      Deal damage based on your spider's <strong>Damage</strong> stat, reduced by opponent's <strong>Defense</strong>. 
                      Adds random variance (0-10) for unpredictability.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Defend</h4>
                    <p className="text-sm text-muted-foreground">
                      Take a defensive stance. This action doesn't deal damage but can be used strategically. 
                      Future updates may enhance defensive capabilities.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-5 h-5 text-yellow-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Special Attack</h4>
                    <p className="text-sm text-muted-foreground">
                      Unleash a powerful venom attack! Deals damage based on your spider's <strong>Venom</strong> stat 
                      with increased variance (0-15) and reduced defense mitigation for higher damage potential.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <SkipForward className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Pass</h4>
                    <p className="text-sm text-muted-foreground">
                      Skip your turn without taking any action. Use this if you want to observe or conserve strategy.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Strategy Tips */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-bold mb-4">Strategy Tips</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Trophy className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <span><strong>Know Your Spider:</strong> High damage spiders excel with attacks, while venomous spiders benefit from special attacks.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Trophy className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <span><strong>Watch HP:</strong> Keep an eye on both spider's hit points to plan your finishing moves.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Trophy className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <span><strong>Defense Matters:</strong> High defense reduces incoming damage, so adjust your strategy accordingly.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Trophy className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <span><strong>Special vs Regular:</strong> Special attacks can bypass more defense but depend on your venom stat.</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Victory Conditions */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-bold mb-3">Victory & Rewards</h3>
              <p className="text-muted-foreground mb-3">
                The battle ends when one spider's HP reaches 0. The winner:
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                <li>Claims ownership of the losing spider</li>
                <li>Gains battle victory stats</li>
                <li>May unlock achievement badges</li>
                <li>Increases their power score with the new spider</li>
              </ul>
            </CardContent>
          </Card>

          <Button onClick={onClose} className="w-full">
            Got it! Let's Battle
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BattleTutorialModal;
