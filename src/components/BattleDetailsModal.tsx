import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Crown, ArrowRight, Users, Clock, Target } from 'lucide-react';
import { format } from 'date-fns';
import ShareButton from '@/components/ShareButton';

interface BattleDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  battle: any; // Battle data from the recent battles
}

const BattleDetailsModal: React.FC<BattleDetailsModalProps> = ({
  isOpen,
  onClose,
  battle
}) => {
  if (!battle) return null;

  // Helper function to get winner and loser
  const getWinnerLoser = () => {
    if (battle.winner === "TIE") {
      return {
        winner: null,
        loser: null,
        isDraw: true
      };
    }

    const winnerTeam = battle.winner === "A" ? battle.team_a[0] : battle.team_b[0];
    const loserTeam = battle.winner === "A" ? battle.team_b[0] : battle.team_a[0];
    
    return {
      winner: winnerTeam,
      loser: loserTeam,
      isDraw: false
    };
  };

  const { winner, loser, isDraw } = getWinnerLoser();

  // Mock battle rounds data (in a real app, this would come from battle_log)
  const rounds = [
    { round: 1, attacker: battle.team_a[0].nickname, defender: battle.team_b[0].nickname, damage: 15, description: `${battle.team_a[0].nickname} strikes with venom attack!` },
    { round: 2, attacker: battle.team_b[0].nickname, defender: battle.team_a[0].nickname, damage: 12, description: `${battle.team_b[0].nickname} counters with web trap!` },
    { round: 3, attacker: battle.team_a[0].nickname, defender: battle.team_b[0].nickname, damage: 18, description: `${battle.team_a[0].nickname} delivers critical bite!` },
  ];

  const getBattleTypeIcon = (type: string) => {
    switch (type) {
      case 'CHALLENGE':
        return '⚔️';
      case 'SANDBOX':
        return '🏟️';
      default:
        return '🕷️';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold gradient-text">
            <Trophy className="w-6 h-6 inline-block mr-2" />
            Battle Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Battle Info Header */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getBattleTypeIcon(battle.type)}</span>
                    <Badge variant={battle.type === 'CHALLENGE' ? 'destructive' : 'secondary'}>
                      {battle.type}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {format(new Date(battle.created_at), 'PPpp')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Battle Result</p>
                  <p className="text-lg font-bold">
                    {isDraw ? "DRAW" : `${winner?.nickname} WINS`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Combatants */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Team A */}
            <Card className={`${battle.winner === "A" ? "ring-2 ring-green-500 bg-green-50 dark:bg-green-950/20" : battle.winner === "TIE" ? "border-yellow-500" : "border-red-200 dark:border-red-800"}`}>
              <CardContent className="p-4 text-center space-y-3">
                <div className="flex justify-center">
                  {battle.winner === "A" && <Crown className="w-8 h-8 text-yellow-500" />}
                  {battle.winner === "TIE" && <div className="w-8 h-8 text-yellow-500">🤝</div>}
                  {battle.winner === "B" && <div className="w-8 h-8 text-gray-400">💀</div>}
                </div>
                <Badge className={
                  battle.winner === "A" ? "bg-green-600 hover:bg-green-700" : 
                  battle.winner === "TIE" ? "bg-yellow-600 hover:bg-yellow-700" :
                  "bg-red-600 hover:bg-red-700"
                }>
                  {battle.winner === "A" ? "WINNER" : battle.winner === "TIE" ? "DRAW" : "DEFEATED"}
                </Badge>
                <img
                  src={battle.team_a[0].image_url}
                  alt={battle.team_a[0].nickname}
                  className={`w-20 h-20 mx-auto rounded object-cover ${battle.winner === "B" ? "grayscale" : ""}`}
                />
                <div>
                  <h3 className="font-bold text-lg">{battle.team_a[0].nickname}</h3>
                  <p className="text-sm text-muted-foreground">{battle.team_a[0].species}</p>
                </div>
              </CardContent>
            </Card>

            {/* Team B */}
            <Card className={`${battle.winner === "B" ? "ring-2 ring-green-500 bg-green-50 dark:bg-green-950/20" : battle.winner === "TIE" ? "border-yellow-500" : "border-red-200 dark:border-red-800"}`}>
              <CardContent className="p-4 text-center space-y-3">
                <div className="flex justify-center">
                  {battle.winner === "B" && <Crown className="w-8 h-8 text-yellow-500" />}
                  {battle.winner === "TIE" && <div className="w-8 h-8 text-yellow-500">🤝</div>}
                  {battle.winner === "A" && <div className="w-8 h-8 text-gray-400">💀</div>}
                </div>
                <Badge className={
                  battle.winner === "B" ? "bg-green-600 hover:bg-green-700" : 
                  battle.winner === "TIE" ? "bg-yellow-600 hover:bg-yellow-700" :
                  "bg-red-600 hover:bg-red-700"
                }>
                  {battle.winner === "B" ? "WINNER" : battle.winner === "TIE" ? "DRAW" : "DEFEATED"}
                </Badge>
                <img
                  src={battle.team_b[0].image_url}
                  alt={battle.team_b[0].nickname}
                  className={`w-20 h-20 mx-auto rounded object-cover ${battle.winner === "A" ? "grayscale" : ""}`}
                />
                <div>
                  <h3 className="font-bold text-lg">{battle.team_b[0].nickname}</h3>
                  <p className="text-sm text-muted-foreground">{battle.team_b[0].species}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Ownership Transfer (only for Challenge battles with a winner) */}
          {battle.type === 'CHALLENGE' && !isDraw && (
            <Card className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-center gap-4 text-center">
                  <div className="space-y-1">
                    <Users className="w-6 h-6 mx-auto text-muted-foreground" />
                    <p className="font-semibold">{loser?.owner_id === battle.team_a[0].owner_id ? "Team A Owner" : "Team B Owner"}</p>
                    <p className="text-sm text-muted-foreground">Previous Owner</p>
                  </div>
                  
                  <div className="flex flex-col items-center">
                    <ArrowRight className="w-8 h-8 text-primary animate-pulse" />
                    <p className="text-xs font-bold text-primary mt-1">TRANSFER</p>
                  </div>
                  
                  <div className="space-y-1">
                    <Crown className="w-6 h-6 mx-auto text-yellow-500" />
                    <p className="font-semibold">{winner?.owner_id === battle.team_a[0].owner_id ? "Team A Owner" : "Team B Owner"}</p>
                    <p className="text-sm text-muted-foreground">New Owner</p>
                  </div>
                </div>
                
                <div className="mt-4 text-center">
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">
                    🏆 <span className="font-bold">{loser?.nickname}</span> now belongs to the winner!
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Battle Rounds */}
          <Card>
            <CardContent className="p-4">
              <h4 className="font-semibold mb-4 text-center flex items-center justify-center gap-2">
                <Target className="w-5 h-5" />
                Battle Timeline ({rounds.length} Rounds)
              </h4>
              <div className="space-y-3">
                {rounds.map((round, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                      {round.round}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{round.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {round.attacker} → {round.defender} ({round.damage} damage)
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Battle Summary */}
          <Card>
            <CardContent className="p-4">
              <h4 className="font-semibold mb-2 text-center">Battle Summary</h4>
              <div className="text-sm text-muted-foreground text-center space-y-1">
                <p>
                  {isDraw 
                    ? `${battle.team_a[0].nickname} and ${battle.team_b[0].nickname} fought to a stalemate in an intense ${rounds.length}-round battle.`
                    : `${winner?.nickname} emerged victorious against ${loser?.nickname} after ${rounds.length} rounds of fierce combat.`
                  }
                </p>
                {battle.type === 'CHALLENGE' && !isDraw && (
                  <p className="text-yellow-700 dark:text-yellow-300 font-medium">
                    Ownership of {loser?.nickname} has been transferred to the victor.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <ShareButton
              title={`🕷️ Epic Spider Battle${isDraw ? " Draw" : " Victory"}!`}
              text={
                isDraw 
                  ? `${battle.team_a[0].nickname} and ${battle.team_b[0].nickname} just fought to an epic draw in Spider League! ${rounds.length} rounds of pure arachnid combat! 🕷️⚔️ Join the battle and test your spiders!`
                  : `${winner?.nickname} just CRUSHED ${loser?.nickname} in an epic Spider League battle! ${rounds.length} rounds of intense combat! 🕷️⚔️${battle.type === 'CHALLENGE' ? ' Ownership transferred!' : ''} Join the battle!`
              }
              hashtags={["SpiderLeague", "WebWarriors", "EpicBattle", isDraw ? "Draw" : "Victory"]}
              variant="default"
              size="lg"
            />
            <Button size="lg" onClick={onClose} variant="outline" className="min-w-32">
              Close Details
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BattleDetailsModal;