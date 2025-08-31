import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Crown, ArrowRight, Users } from 'lucide-react';
import ShareButton from '@/components/ShareButton';

interface Spider {
  id: string;
  nickname: string;
  species: string;
  image_url: string;
  power_score: number;
  owner_id: string;
}

interface BattleRecapModalProps {
  isOpen: boolean;
  onClose: () => void;
  winner: Spider;
  loser: Spider;
  winnerOwner: string;
  loserOwner: string;
  battleLog: string[];
}

const BattleRecapModal: React.FC<BattleRecapModalProps> = ({
  isOpen,
  onClose,
  winner,
  loser,
  winnerOwner,
  loserOwner,
  battleLog
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold gradient-text">
            <Trophy className="w-6 h-6 inline-block mr-2" />
            Battle Results
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Winner Announcement */}
          <div className="text-center space-y-2">
            <div className="text-3xl font-bold text-primary animate-pulse">
              🏆 {winner.nickname} WINS! 🏆
            </div>
            <p className="text-lg text-muted-foreground">
              Owned by <span className="font-semibold text-foreground">{winnerOwner}</span>
            </p>
          </div>

          {/* Battle Summary Cards */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Winner Card */}
            <Card className="ring-2 ring-green-500 bg-green-50 dark:bg-green-950/20">
              <CardContent className="p-4 text-center space-y-3">
                <div className="flex justify-center">
                  <Crown className="w-8 h-8 text-yellow-500" />
                </div>
                <Badge className="bg-green-600 hover:bg-green-700">WINNER</Badge>
                <img
                  src={winner.image_url}
                  alt={winner.nickname}
                  className="w-20 h-20 mx-auto rounded object-cover"
                />
                <div>
                  <h3 className="font-bold text-lg">{winner.nickname}</h3>
                  <p className="text-sm text-muted-foreground">{winner.species}</p>
                  <p className="text-xs">Power: {winner.power_score}</p>
                </div>
              </CardContent>
            </Card>

            {/* Loser Card */}
            <Card className="ring-2 ring-red-500 bg-red-50 dark:bg-red-950/20">
              <CardContent className="p-4 text-center space-y-3">
                <div className="flex justify-center">
                  <div className="w-8 h-8 text-gray-400">💀</div>
                </div>
                <Badge variant="destructive">DEFEATED</Badge>
                <img
                  src={loser.image_url}
                  alt={loser.nickname}
                  className="w-20 h-20 mx-auto rounded object-cover grayscale"
                />
                <div>
                  <h3 className="font-bold text-lg">{loser.nickname}</h3>
                  <p className="text-sm text-muted-foreground">{loser.species}</p>
                  <p className="text-xs">Power: {loser.power_score}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Ownership Transfer */}
          <Card className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-center gap-4 text-center">
                <div className="space-y-1">
                  <Users className="w-6 h-6 mx-auto text-muted-foreground" />
                  <p className="font-semibold">{loserOwner}</p>
                  <p className="text-sm text-muted-foreground">Previous Owner</p>
                </div>
                
                <div className="flex flex-col items-center">
                  <ArrowRight className="w-8 h-8 text-primary animate-pulse" />
                  <p className="text-xs font-bold text-primary mt-1">TRANSFER</p>
                </div>
                
                <div className="space-y-1">
                  <Crown className="w-6 h-6 mx-auto text-yellow-500" />
                  <p className="font-semibold">{winnerOwner}</p>
                  <p className="text-sm text-muted-foreground">New Owner</p>
                </div>
              </div>
              
              <div className="mt-4 text-center">
                <p className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">
                  🏆 <span className="font-bold">{loser.nickname}</span> now belongs to <span className="font-bold">{winnerOwner}</span>!
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Battle Summary */}
          {battleLog.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h4 className="font-semibold mb-2 text-center">Battle Summary</h4>
                <div className="max-h-32 overflow-y-auto space-y-1 text-sm">
                  {battleLog.map((entry, index) => (
                    <p key={index} className="text-muted-foreground text-center">{entry}</p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <ShareButton
              title={`🏆 Epic Spider Battle Victory!`}
              text={`${winner.nickname} (Power: ${winner.power_score}) just CRUSHED ${loser.nickname} (Power: ${loser.power_score}) in an epic Spider League battle! 🕷️⚔️ The ownership has transferred to ${winnerOwner}! Join the battle and claim your victory!`}
              hashtags={["SpiderLeague", "WebWarriors", "EpicBattle", "Victory"]}
              variant="default"
              size="lg"
            />
            <Button size="lg" onClick={onClose} variant="outline" className="min-w-32">
              Close Battle Recap
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BattleRecapModal;