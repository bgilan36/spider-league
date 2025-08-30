import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, Zap, Heart, Shield, Skull } from 'lucide-react';
import BattleRecapModal from './BattleRecapModal';

interface Spider {
  id: string;
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
  owner_id: string;
}

interface BattleArenaProps {
  spider1: Spider;
  spider2: Spider;
  challenger: string;
  accepter: string;
  onBattleComplete: (winner: Spider, loser: Spider, battleId: string) => void;
}

const DiceIcon = ({ value }: { value: number }) => {
  const icons = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];
  const Icon = icons[value - 1] || Dice1;
  return <Icon className="w-8 h-8" />;
};

const BattleArena: React.FC<BattleArenaProps> = ({
  spider1,
  spider2,
  challenger,
  accepter,
  onBattleComplete
}) => {
  const { toast } = useToast();
  const [battleState, setBattleState] = useState<'starting' | 'rolling' | 'calculating' | 'complete'>('starting');
  const [currentRound, setCurrentRound] = useState(1);
  const [spider1Health, setSpider1Health] = useState(spider1.hit_points);
  const [spider2Health, setSpider2Health] = useState(spider2.hit_points);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [diceRolls, setDiceRolls] = useState<{ spider1: number[]; spider2: number[] }>({
    spider1: [],
    spider2: []
  });
  const [winner, setWinner] = useState<Spider | null>(null);
  const [animatingDice, setAnimatingDice] = useState(false);
  const [showRecapModal, setShowRecapModal] = useState(false);
  const [battleId, setBattleId] = useState<string>('');

  // Battle calculation function
  const calculateBattleRound = () => {
    // Roll dice for both spiders (3 dice each)
    const spider1Rolls = [
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1
    ];
    
    const spider2Rolls = [
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1
    ];

    setDiceRolls({ spider1: spider1Rolls, spider2: spider2Rolls });

    // Calculate attack values with dice modifiers
    const spider1Attack = calculateAttack(spider1, spider1Rolls);
    const spider2Attack = calculateAttack(spider2, spider2Rolls);

    // Calculate defense with dice
    const spider1Defense = calculateDefense(spider1, spider1Rolls);
    const spider2Defense = calculateDefense(spider2, spider2Rolls);

    // Calculate damage dealt
    const damageToSpider2 = Math.max(1, spider1Attack - spider2Defense);
    const damageToSpider1 = Math.max(1, spider2Attack - spider1Defense);

    // Apply damage
    const newSpider1Health = Math.max(0, spider1Health - damageToSpider1);
    const newSpider2Health = Math.max(0, spider2Health - damageToSpider2);

    setSpider1Health(newSpider1Health);
    setSpider2Health(newSpider2Health);

    // Add to battle log
    const logEntry = `Round ${currentRound}: ${spider1.nickname} dealt ${damageToSpider2} damage, ${spider2.nickname} dealt ${damageToSpider1} damage`;
    setBattleLog(prev => [...prev, logEntry]);

    // Check for winner
    if (newSpider1Health <= 0 && newSpider2Health <= 0) {
      // Tie - highest power score wins
      const battleWinner = spider1.power_score >= spider2.power_score ? spider1 : spider2;
      setWinner(battleWinner);
    } else if (newSpider1Health <= 0) {
      setWinner(spider2);
    } else if (newSpider2Health <= 0) {
      setWinner(spider1);
    } else {
      setCurrentRound(prev => prev + 1);
    }
  };

  const calculateAttack = (spider: Spider, rolls: number[]) => {
    const baseAttack = (spider.damage + spider.venom + spider.speed) / 3;
    const diceBonus = rolls.reduce((sum, roll) => sum + roll, 0);
    return Math.floor(baseAttack + diceBonus);
  };

  const calculateDefense = (spider: Spider, rolls: number[]) => {
    const baseDefense = (spider.defense + spider.webcraft) / 2;
    const diceBonus = rolls.reduce((sum, roll) => sum + roll, 0) / 2;
    return Math.floor(baseDefense + diceBonus);
  };

  // Auto-progress battle
  useEffect(() => {
    if (battleState === 'starting') {
      const timer = setTimeout(() => setBattleState('rolling'), 2000);
      return () => clearTimeout(timer);
    }
    
    if (battleState === 'rolling' && !winner) {
      setAnimatingDice(true);
      
      // Animate dice for 2 seconds
      const diceTimer = setTimeout(() => {
        setAnimatingDice(false);
        setBattleState('calculating');
        calculateBattleRound();
      }, 2000);
      
      return () => clearTimeout(diceTimer);
    }
    
    if (battleState === 'calculating' && !winner) {
      const timer = setTimeout(() => setBattleState('rolling'), 1500);
      return () => clearTimeout(timer);
    }
    
    if (winner) {
      setBattleState('complete');
      saveBattleResult();
    }
  }, [battleState, winner, currentRound]);

  const saveBattleResult = async () => {
    if (!winner) return;

    try {
      // Create battle record
      const { data: battleData, error: battleError } = await supabase
        .from('battles')
        .insert({
          team_a: [spider1.id],
          team_b: [spider2.id],
          winner: winner.id === spider1.id ? 'A' : 'B',
          battle_log: {
            rounds: battleLog,
            final_health: {
              spider1: spider1Health,
              spider2: spider2Health
            }
          },
          rng_seed: Math.random().toString()
        })
        .select()
        .single();

      if (battleData) {
        setBattleId(battleData.id);
        setShowRecapModal(true);
      }
    } catch (error) {
      console.error('Error saving battle:', error);
      toast({
        title: "Error",
        description: "Failed to save battle results",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Battle Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold gradient-text">BATTLE ARENA</h1>
          <p className="text-xl text-muted-foreground">
            {challenger} vs {accepter} • Round {currentRound}
          </p>
        </div>

        {/* Battle Display */}
        <div className="grid md:grid-cols-3 gap-6 items-center">
          {/* Spider 1 */}
          <SpiderBattleCard
            spider={spider1}
            health={spider1Health}
            maxHealth={spider1.hit_points}
            diceRolls={diceRolls.spider1}
            animating={animatingDice}
            isWinner={winner?.id === spider1.id}
            ownerName={challenger}
          />

          {/* VS Section */}
          <div className="text-center space-y-4">
            <div className="text-6xl font-bold text-primary">VS</div>
            
            {battleState === 'rolling' && (
              <div className="flex justify-center items-center gap-2">
                <Zap className="w-6 h-6 animate-pulse text-yellow-500" />
                <span className="text-lg font-medium">Rolling dice...</span>
                <Zap className="w-6 h-6 animate-pulse text-yellow-500" />
              </div>
            )}
            
            {battleState === 'calculating' && (
              <div className="text-lg font-medium text-orange-500">
                Calculating damage...
              </div>
            )}

            {winner && (
              <div className="text-2xl font-bold text-green-500 animate-pulse">
                {winner.nickname} WINS!
              </div>
            )}
          </div>

          {/* Spider 2 */}
          <SpiderBattleCard
            spider={spider2}
            health={spider2Health}
            maxHealth={spider2.hit_points}
            diceRolls={diceRolls.spider2}
            animating={animatingDice}
            isWinner={winner?.id === spider2.id}
            ownerName={accepter}
          />
        </div>

        {/* Battle Log */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Skull className="w-5 h-5" />
              Battle Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {battleLog.length === 0 ? (
                <p className="text-muted-foreground italic">Battle beginning...</p>
              ) : (
                battleLog.map((entry, index) => (
                  <p key={index} className="text-sm">{entry}</p>
                ))
              )}
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Battle Recap Modal */}
      {winner && (
        <BattleRecapModal
          isOpen={showRecapModal}
          onClose={() => {
            const loser = winner.id === spider1.id ? spider2 : spider1;
            onBattleComplete(winner, loser, battleId);
            setShowRecapModal(false);
          }}
          winner={winner}
          loser={winner.id === spider1.id ? spider2 : spider1}
          winnerOwner={winner.id === spider1.id ? challenger : accepter}
          loserOwner={winner.id === spider1.id ? accepter : challenger}
          battleLog={battleLog}
        />
      )}
    </div>
  );
};

// Spider Battle Card Component
const SpiderBattleCard: React.FC<{
  spider: Spider;
  health: number;
  maxHealth: number;
  diceRolls: number[];
  animating: boolean;
  isWinner?: boolean;
  ownerName: string;
}> = ({ spider, health, maxHealth, diceRolls, animating, isWinner, ownerName }) => {
  const healthPercentage = (health / maxHealth) * 100;

  return (
    <Card className={`${isWinner ? 'ring-2 ring-green-500 bg-green-50 dark:bg-green-950' : ''} transition-all`}>
      <CardHeader>
        <div className="text-center space-y-2">
          <h3 className="text-xl font-bold">{spider.nickname}</h3>
          <p className="text-sm text-muted-foreground">Owner: {ownerName}</p>
          <img
            src={spider.image_url}
            alt={spider.nickname}
            className="w-24 h-24 mx-auto rounded object-cover"
          />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Health Bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1 text-sm font-medium">
              <Heart className="w-4 h-4 text-red-500" />
              Health
            </span>
            <span className="text-sm">{health}/{maxHealth}</span>
          </div>
          <Progress value={healthPercentage} className="h-2" />
        </div>

        {/* Dice Display */}
        <div className="space-y-2">
          <span className="text-sm font-medium">Battle Dice</span>
          <div className="flex justify-center gap-2">
            {diceRolls.length > 0 ? (
              diceRolls.map((roll, index) => (
                <div
                  key={index}
                  className={`${animating ? 'animate-spin' : ''} transition-transform`}
                >
                  <DiceIcon value={roll} />
                </div>
              ))
            ) : (
              [1, 2, 3].map((_, index) => (
                <div
                  key={index}
                  className={`${animating ? 'animate-spin' : ''} opacity-50`}
                >
                  <DiceIcon value={1} />
                </div>
              ))
            )}
          </div>
          {diceRolls.length > 0 && (
            <p className="text-center text-sm font-bold">
              Total: {diceRolls.reduce((sum, roll) => sum + roll, 0)}
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3" />
            <span>DMG: {spider.damage}</span>
          </div>
          <div className="flex items-center gap-1">
            <Shield className="w-3 h-3" />
            <span>DEF: {spider.defense}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>SPD: {spider.speed}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>VNM: {spider.venom}</span>
          </div>
        </div>

        {isWinner && (
          <div className="text-center text-green-600 font-bold animate-pulse">
            🏆 WINNER! 🏆
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BattleArena;