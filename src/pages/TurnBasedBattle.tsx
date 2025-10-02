import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Loader2, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useTurnBasedBattle } from '@/hooks/useTurnBasedBattle';
import { useAuth } from '@/auth/AuthProvider';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const TurnBasedBattle = () => {
  const { battleId } = useParams<{ battleId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    battle,
    turns,
    loading,
    myHp,
    opponentHp,
    mySpider,
    opponentSpider,
  } = useTurnBasedBattle(battleId || null);

  useEffect(() => {
    if (!battleId) {
      toast.error('No battle ID provided');
      navigate('/battle-mode');
    }
  }, [battleId, navigate]);

  useEffect(() => {
    // Battle ended, redirect after a delay
    if (battle && !battle.is_active) {
      const timer = setTimeout(() => {
        navigate('/battle-mode');
      }, 8000);
      
      return () => clearTimeout(timer);
    }
  }, [battle, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-lg font-medium">Running automated battle...</p>
          <p className="text-sm text-muted-foreground">This may take a few moments</p>
        </div>
      </div>
    );
  }

  if (!battle || !mySpider || !opponentSpider) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Battle not found</p>
            <Button asChild className="mt-4">
              <Link to="/battle-mode">Back to Battle Mode</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const battleEnded = !battle.is_active;
  const iWon = battle.winner === 'A' 
    ? (battle.team_a as any)?.userId === user?.id 
    : (battle.team_b as any)?.userId === user?.id;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Battle Results — Spider League</title>
        <meta name="description" content="View your automated spider battle results" />
      </Helmet>

      {/* Header */}
      <header className="glass-card border-b border-border/30 sticky top-0 z-40 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <img 
                  src="/lovable-uploads/12c04e49-1f4c-4ed1-b840-514c07b83c24.png" 
                  alt="Spider League Logo" 
                  className="h-12 w-auto"
                />
              </Link>
              <div>
                <h1 className="text-2xl font-bold gradient-text">Battle Results</h1>
                <p className="text-sm text-muted-foreground">
                  {battleEnded ? `Completed in ${battle.turn_count} turns` : 'Battle in progress...'}
                </p>
              </div>
            </div>
            
            <Button variant="ghost" asChild>
              <Link to="/battle-mode">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <AnimatePresence>
          {battleEnded && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <Card className={`mb-6 ${iWon ? 'border-yellow-500 bg-yellow-500/10' : 'border-destructive bg-destructive/10'}`}>
                <CardContent className="p-8 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", duration: 0.5 }}
                  >
                    <div className="text-6xl mb-4">{iWon ? '🏆' : '💀'}</div>
                    <h2 className="text-4xl font-bold mb-2 gradient-text">
                      {iWon ? 'Victory!' : 'Defeat'}
                    </h2>
                  </motion.div>
                  <p className="text-lg mb-2">
                    {iWon ? `${mySpider.nickname} has won the battle!` : `${opponentSpider.nickname} has won the battle!`}
                  </p>
                  {iWon && (
                    <Badge variant="outline" className="mt-2">
                      <Trophy className="w-3 h-3 mr-1" />
                      Spider Claimed
                    </Badge>
                  )}
                  <p className="text-sm text-muted-foreground mt-4">Redirecting to Battle Mode...</p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {!battleEnded && (
            <Card className="mb-6 border-primary bg-primary/5">
              <CardContent className="p-6 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                <p className="font-medium">Battle running automatically...</p>
                <p className="text-sm text-muted-foreground mt-1">No manual actions required</p>
              </CardContent>
            </Card>
          )}
        </AnimatePresence>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* My Spider */}
          <Card className={battleEnded && iWon ? 'border-yellow-500 shadow-lg' : ''}>
            <CardContent className="p-6">
              <div className="text-center mb-4">
                <h3 className="text-xl font-bold">{mySpider.nickname}</h3>
                <p className="text-sm text-muted-foreground">{mySpider.species}</p>
                {battleEnded && iWon && (
                  <Badge variant="default" className="mt-2">
                    <Trophy className="w-3 h-3 mr-1" />
                    Winner!
                  </Badge>
                )}
              </div>
            
              <img 
                src={mySpider.image_url} 
                alt={mySpider.nickname}
                className="w-full h-48 object-cover rounded-lg mb-4"
              />
            
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">HP</span>
                  <span className="font-bold">{myHp} / {mySpider.hit_points}</span>
                </div>
                <Progress 
                  value={((myHp || 0) / mySpider.hit_points) * 100}
                  className="h-3"
                />
                
                <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
                  <div>
                    <div className="text-muted-foreground">ATK</div>
                    <div className="font-bold">{mySpider.damage}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">DEF</div>
                    <div className="font-bold">{mySpider.defense}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">SPD</div>
                    <div className="font-bold">{mySpider.speed}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Opponent Spider */}
          <Card className={battleEnded && !iWon ? 'border-yellow-500 shadow-lg' : ''}>
            <CardContent className="p-6">
              <div className="text-center mb-4">
                <h3 className="text-xl font-bold">{opponentSpider.nickname}</h3>
                <p className="text-sm text-muted-foreground">{opponentSpider.species}</p>
                {battleEnded && !iWon && (
                  <Badge variant="default" className="mt-2">
                    <Trophy className="w-3 h-3 mr-1" />
                    Winner!
                  </Badge>
                )}
              </div>
            
              <img 
                src={opponentSpider.image_url} 
                alt={opponentSpider.nickname}
                className="w-full h-48 object-cover rounded-lg mb-4"
              />
            
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">HP</span>
                  <span className="font-bold">{opponentHp} / {opponentSpider.hit_points}</span>
                </div>
                <Progress 
                  value={((opponentHp || 0) / opponentSpider.hit_points) * 100}
                  className="h-3"
                />
                
                <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
                  <div>
                    <div className="text-muted-foreground">ATK</div>
                    <div className="font-bold">{opponentSpider.damage}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">DEF</div>
                    <div className="font-bold">{opponentSpider.defense}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">SPD</div>
                    <div className="font-bold">{opponentSpider.speed}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Battle Log */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-bold mb-4">Battle Log</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {turns.length === 0 ? (
                <div className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Battle simulation running...
                  </p>
                </div>
              ) : (
                <AnimatePresence>
                  {turns.slice().reverse().map((turn, index) => {
                    const result = turn.result_payload as any;
                    const isAttack = turn.action_type === 'attack';
                    const isSpecial = turn.action_type === 'special';
                    
                    return (
                      <motion.div
                        key={turn.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ delay: index * 0.02 }}
                        className={`text-sm p-4 bg-muted/50 rounded-lg border ${
                          result?.is_critical ? 'border-yellow-500 bg-yellow-500/10' : 'border-border'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-primary">Turn {turn.turn_index}</span>
                          <div className="flex items-center gap-2">
                            {result?.is_critical && (
                              <Badge variant="default" className="text-xs bg-yellow-500">
                                CRITICAL!
                              </Badge>
                            )}
                            <Badge 
                              variant={isSpecial ? "default" : "outline"} 
                              className="text-xs"
                            >
                              {turn.action_type.toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                        
                        {result && (
                          <div className="space-y-1">
                            <div className="font-medium">
                              {result.attacker_name} 
                              {isAttack && ' attacks '}
                              {isSpecial && ` uses ${result.special_move || 'Special Attack'} on `}
                              {result.defender_name}!
                            </div>
                            
                            {/* Dice rolls */}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                🎲 Attack: <span className={`font-bold ${result.attacker_dice === 20 ? 'text-yellow-500' : result.attacker_dice >= 15 ? 'text-green-500' : ''}`}>{result.attacker_dice}</span>
                              </span>
                              <span className="flex items-center gap-1">
                                🎲 Defense: <span className={`font-bold ${result.defender_dice >= 18 ? 'text-blue-500' : ''}`}>{result.defender_dice}</span>
                              </span>
                            </div>
                            
                            {result.damage > 0 && (
                              <div className="text-muted-foreground flex items-center gap-2">
                                <span className={`${result.is_critical ? 'text-yellow-500 font-bold' : 'text-destructive'}`}>
                                  💥 {result.damage} damage dealt{result.is_critical ? ' (CRITICAL!)' : ''}
                                </span>
                                <span className="text-xs">
                                  ({result.old_defender_hp} → {result.new_defender_hp} HP)
                                </span>
                              </div>
                            )}
                            
                            {result.new_defender_hp === 0 && (
                              <div className="text-yellow-500 font-bold mt-1">
                                ⚰️ {result.defender_name} has been defeated!
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default TurnBasedBattle;
