import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Loader2, Sword, Shield, Zap, SkipForward, Trophy } from 'lucide-react';
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
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const {
    battle,
    turns,
    loading,
    submitting,
    isMyTurn,
    myHp,
    opponentHp,
    mySpider,
    opponentSpider,
    submitTurn,
  } = useTurnBasedBattle(battleId || null);

  useEffect(() => {
    if (!battleId) {
      toast.error('No battle ID provided');
      navigate('/battle-mode');
    }
  }, [battleId, navigate]);

  // Show notification when it becomes your turn
  useEffect(() => {
    if (isMyTurn && !loading && battle?.is_active) {
      toast.info("It's your turn!", {
        description: "Choose your action wisely",
      });
    }
  }, [isMyTurn, loading, battle?.is_active]);

  useEffect(() => {
    // Battle ended, redirect after a delay
    if (battle && !battle.is_active) {
      const timer = setTimeout(() => {
        navigate('/battle-mode');
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [battle, navigate]);

  const handleAction = async (actionType: 'attack' | 'defend' | 'special' | 'pass') => {
    if (submitting) return;
    
    try {
      const actionEmojis = {
        attack: '⚔️',
        defend: '🛡️',
        special: '💥',
        pass: '⏭️'
      };
      
      setActionFeedback(`${actionEmojis[actionType]} ${actionType.toUpperCase()}`);
      setTimeout(() => setActionFeedback(null), 2000);
      
      await submitTurn(actionType);
      
      const actionNames = {
        attack: 'Attack',
        defend: 'Defend',
        special: 'Special Attack',
        pass: 'Pass'
      };
      
      toast.success(`${actionNames[actionType]} performed!`, {
        description: "Waiting for opponent's turn..."
      });
    } catch (error: any) {
      setActionFeedback(null);
      toast.error('Action failed', {
        description: error.message || 'Failed to perform action. Please try again.'
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
  const iWon = battle.winner === 'TEAM_A' 
    ? (battle.team_a as any)?.userId === user?.id 
    : (battle.team_b as any)?.userId === user?.id;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Turn-Based Battle — Spider League</title>
        <meta name="description" content="Engage in strategic turn-based spider battles" />
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
                <h1 className="text-2xl font-bold gradient-text">Turn-Based Battle</h1>
                <p className="text-sm text-muted-foreground">Turn {battle.turn_count}</p>
              </div>
            </div>
            
            <Button variant="ghost" asChild>
              <Link to="/battle-mode">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Exit
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
        </AnimatePresence>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* My Spider */}
          <motion.div
            animate={isMyTurn && !battleEnded ? { scale: [1, 1.02, 1] } : {}}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <Card className={isMyTurn && !battleEnded ? 'border-primary shadow-lg' : ''}>
              <CardContent className="p-6">
                <div className="text-center mb-4">
                  <h3 className="text-xl font-bold">{mySpider.nickname}</h3>
                  <p className="text-sm text-muted-foreground">{mySpider.species}</p>
                  {isMyTurn && !battleEnded && (
                    <Badge variant="default" className="mt-2">
                      <Zap className="w-3 h-3 mr-1" />
                      Your Turn!
                    </Badge>
                  )}
                </div>
              
              <div className="relative">
                <img 
                  src={mySpider.image_url} 
                  alt={mySpider.nickname}
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />
                <AnimatePresence>
                  {actionFeedback && isMyTurn && (
                    <motion.div
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg"
                    >
                      <div className="text-4xl font-bold text-white">
                        {actionFeedback}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
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
          </motion.div>

          {/* Opponent Spider */}
          <motion.div
            animate={!isMyTurn && !battleEnded ? { scale: [1, 1.02, 1] } : {}}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <Card className={!isMyTurn && !battleEnded ? 'border-orange-500 shadow-lg' : ''}>
              <CardContent className="p-6">
                <div className="text-center mb-4">
                  <h3 className="text-xl font-bold">{opponentSpider.nickname}</h3>
                  <p className="text-sm text-muted-foreground">{opponentSpider.species}</p>
                  {!isMyTurn && !battleEnded && (
                    <Badge variant="secondary" className="mt-2">
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Opponent's Turn
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
          </motion.div>
        </div>

        {/* Action Buttons */}
        {!battleEnded && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className={isMyTurn ? 'border-primary' : ''}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">Battle Actions</h3>
                  {!isMyTurn && (
                    <Badge variant="outline">
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Waiting...
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Button
                    onClick={() => handleAction('attack')}
                    disabled={!isMyTurn || submitting}
                    className="h-24 flex flex-col gap-2"
                    variant={isMyTurn ? "default" : "secondary"}
                  >
                    <Sword className="w-6 h-6" />
                    <span className="font-bold">Attack</span>
                  </Button>
                  <Button
                    onClick={() => handleAction('defend')}
                    disabled={!isMyTurn || submitting}
                    variant="secondary"
                    className="h-24 flex flex-col gap-2"
                  >
                    <Shield className="w-6 h-6" />
                    <span className="font-bold">Defend</span>
                  </Button>
                  <Button
                    onClick={() => handleAction('special')}
                    disabled={!isMyTurn || submitting}
                    variant="outline"
                    className="h-24 flex flex-col gap-2"
                  >
                    <Zap className="w-6 h-6" />
                    <span className="font-bold">Special</span>
                  </Button>
                  <Button
                    onClick={() => handleAction('pass')}
                    disabled={!isMyTurn || submitting}
                    variant="ghost"
                    className="h-24 flex flex-col gap-2"
                  >
                    <SkipForward className="w-6 h-6" />
                    <span className="font-bold">Pass</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Battle Log */}
        <Card className="mt-6">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold mb-4">Battle Log</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {turns.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No turns yet. Battle begins now!
                </p>
              ) : (
                <AnimatePresence>
                  {turns.slice().reverse().map((turn, index) => (
                    <motion.div
                      key={turn.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.05 }}
                      className="text-sm p-3 bg-muted/50 rounded-lg border border-border"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-primary">Turn {turn.turn_index}</span>
                        <Badge variant="outline" className="text-xs">
                          {turn.action_type.toUpperCase()}
                        </Badge>
                      </div>
                      {turn.result_payload && (
                        <div className="mt-1 text-muted-foreground">
                          {typeof turn.result_payload === 'object' && (turn.result_payload as any).damage && (
                            <span>💥 Damage: {(turn.result_payload as any).damage}</span>
                          )}
                        </div>
                      )}
                    </motion.div>
                  ))}
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
