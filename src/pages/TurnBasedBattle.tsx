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
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import BattleOutcomeReveal from '@/components/BattleOutcomeReveal';
import PresenceGateDialog from '@/components/PresenceGateDialog';

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
  const [started, setStarted] = useState(false);
  const [showPresenceGate, setShowPresenceGate] = useState(false);
  const [showOutcomeReveal, setShowOutcomeReveal] = useState(false);
  const [hasConfirmedPresence, setHasConfirmedPresence] = useState(false);

  // Check if coming from query param (direct notification link)
  useEffect(() => {
    if (!battleId) {
      toast.error('No battle ID provided');
      navigate('/battle-mode');
      return;
    }

    // Check if this is a fresh view (not already confirmed)
    const urlParams = new URLSearchParams(window.location.search);
    const requirePresence = urlParams.get('requirePresence') === 'true';
    
    if (requirePresence && !hasConfirmedPresence) {
      setShowPresenceGate(true);
    } else {
      setHasConfirmedPresence(true);
    }
  }, [battleId, navigate, hasConfirmedPresence]);

  useEffect(() => {
    // Battle ended, show outcome reveal then redirect
    if (battle && !battle.is_active && !showOutcomeReveal && hasConfirmedPresence) {
      // Small delay to ensure all turns are visible first
      const revealTimer = setTimeout(() => {
        setShowOutcomeReveal(true);
      }, 2000);

      return () => clearTimeout(revealTimer);
    }
  }, [battle, showOutcomeReveal, hasConfirmedPresence]);

  // Kick off auto-battle if it hasn't started (fallback) - only after presence confirmed
  useEffect(() => {
    if (!battleId || started || !hasConfirmedPresence) return;
    if (!battle) return;
    if (!battle.is_active) return;
    if ((battle.turn_count ?? 0) > 0 || turns.length > 0) return;

    setStarted(true);
    supabase.functions
      .invoke('auto-battle', { body: { battleId } })
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to start auto-battle:', error);
          toast.error('Failed to start battle, retrying...');
          setStarted(false);
        }
      });
  }, [battleId, battle, turns.length, started, hasConfirmedPresence]);

  const handlePresenceConfirm = () => {
    setShowPresenceGate(false);
    setHasConfirmedPresence(true);
  };

  const handlePresenceCancel = () => {
    setShowPresenceGate(false);
    navigate('/battle-mode');
  };

  const handleOutcomeComplete = () => {
    setShowOutcomeReveal(false);
    // Redirect after outcome reveal
    setTimeout(() => {
      navigate('/battle-mode');
    }, 1000);
  };

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
  const iWon = battle.winner === 'TEAM_A' 
    ? (battle.team_a as any)?.userId === user?.id 
    : battle.winner === 'TEAM_B'
    ? (battle.team_b as any)?.userId === user?.id
    : false;

  // Get winner and loser details for outcome reveal
  const winnerSpider = iWon ? mySpider : opponentSpider;
  const loserSpider = iWon ? opponentSpider : mySpider;
  const winnerOwnerName = iWon 
    ? ((battle.team_a as any)?.userId === user?.id ? 'You' : (battle.team_b as any)?.userName || 'Opponent')
    : ((battle.team_b as any)?.userId === user?.id ? 'You' : (battle.team_a as any)?.userName || 'Opponent');
  const loserOwnerName = iWon
    ? ((battle.team_a as any)?.userId === user?.id ? (battle.team_b as any)?.userName || 'Opponent' : 'You')
    : ((battle.team_b as any)?.userId === user?.id ? (battle.team_a as any)?.userName || 'Opponent' : 'You');

  return (
    <div className="min-h-screen bg-background">
      {/* Presence Gate Dialog */}
      {showPresenceGate && (
        <PresenceGateDialog
          isOpen={showPresenceGate}
          onConfirm={handlePresenceConfirm}
          onCancel={handlePresenceCancel}
          battleId={battleId || ''}
        />
      )}

      {/* Outcome Reveal Animation */}
      {showOutcomeReveal && winnerSpider && loserSpider && (
        <BattleOutcomeReveal
          winner={winnerSpider}
          loser={loserSpider}
          winnerOwnerName={winnerOwnerName}
          loserOwnerName={loserOwnerName}
          onComplete={handleOutcomeComplete}
        />
      )}
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
                <AnimatePresence mode="popLayout">
                  {turns.slice().reverse().map((turn, index) => {
                    const result = turn.result_payload as any;
                    const isAttack = turn.action_type === 'attack';
                    const isSpecial = turn.action_type === 'special';
                    const dodged = result?.dodged || false;
                    
                    return (
                      <motion.div
                        key={turn.id}
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ 
                          type: "spring",
                          stiffness: 300,
                          damping: 25,
                          delay: index * 0.03 
                        }}
                        className={`relative overflow-hidden text-sm p-5 rounded-lg border-2 transition-all ${
                          result?.is_critical 
                            ? 'border-yellow-500 bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 shadow-lg shadow-yellow-500/20' 
                            : dodged
                            ? 'border-blue-500 bg-gradient-to-br from-blue-500/20 to-blue-600/10 shadow-lg shadow-blue-500/20'
                            : isSpecial
                            ? 'border-purple-500 bg-gradient-to-br from-purple-500/15 to-purple-600/5'
                            : 'border-border bg-muted/30'
                        }`}
                      >
                        {/* Turn header */}
                        <div className="flex items-center justify-between mb-3">
                          <motion.span 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="font-bold text-lg gradient-text"
                          >
                            Turn {turn.turn_index}
                          </motion.span>
                          <div className="flex items-center gap-2">
                            {result?.is_critical && (
                              <motion.div
                                initial={{ scale: 0, rotate: -180 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: "spring" }}
                              >
                                <Badge variant="default" className="text-xs bg-yellow-500 text-black font-bold shadow-lg">
                                  ⚡ CRITICAL HIT!
                                </Badge>
                              </motion.div>
                            )}
                            {dodged && (
                              <motion.div
                                initial={{ scale: 0, rotate: 180 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: "spring" }}
                              >
                                <Badge variant="default" className="text-xs bg-blue-500 font-bold shadow-lg">
                                  💨 DODGED!
                                </Badge>
                              </motion.div>
                            )}
                            <Badge 
                              variant={isSpecial ? "default" : "outline"} 
                              className={`text-xs font-semibold ${isSpecial ? 'bg-purple-500' : ''}`}
                            >
                              {isSpecial ? '✨ SPECIAL' : '⚔️ ATTACK'}
                            </Badge>
                          </div>
                        </div>
                        
                        {result && (
                          <div className="space-y-3">
                            {/* Action description */}
                            <motion.div 
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.1 }}
                              className="font-semibold text-base"
                            >
                              <span className="text-primary">{result.attacker_name}</span>
                              {isAttack && ' launches an attack on '}
                              {isSpecial && (
                                <span>
                                  {' uses '}
                                  <span className="text-purple-400 font-bold">{result.special_move || 'Special Attack'}</span>
                                  {' on '}
                                </span>
                              )}
                              <span className="text-destructive">{result.defender_name}</span>!
                            </motion.div>
                            
                            {/* Dice rolls - more prominent */}
                            <motion.div 
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.15 }}
                              className="flex items-center gap-4 p-3 bg-background/50 rounded-md border border-border/50"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-lg">🎲</span>
                                <div className="text-xs">
                                  <div className="text-muted-foreground">Attack Roll</div>
                                  <div className={`font-bold text-lg ${
                                    result.attacker_dice === 20 ? 'text-yellow-500' : 
                                    result.attacker_dice >= 15 ? 'text-green-500' : 
                                    'text-foreground'
                                  }`}>
                                    {result.attacker_dice}
                                  </div>
                                </div>
                              </div>
                              <div className="h-8 w-px bg-border" />
                              <div className="flex items-center gap-2">
                                <span className="text-lg">🛡️</span>
                                <div className="text-xs">
                                  <div className="text-muted-foreground">Defense Roll</div>
                                  <div className={`font-bold text-lg ${
                                    result.defender_dice >= 19 ? 'text-blue-500' : 
                                    result.defender_dice >= 15 ? 'text-green-500' : 
                                    'text-foreground'
                                  }`}>
                                    {result.defender_dice}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                            
                            {/* Damage or dodge */}
                            {dodged ? (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.2 }}
                                className="text-blue-400 font-bold text-lg flex items-center gap-2 p-3 bg-blue-500/10 rounded-md border border-blue-500/30"
                              >
                                <span className="text-2xl">💨</span>
                                <span>{result.defender_name} narrowly dodges the attack!</span>
                              </motion.div>
                            ) : result.damage > 0 && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.2 }}
                                className="space-y-2"
                              >
                                <div className={`font-bold text-lg flex items-center gap-2 p-3 rounded-md border ${
                                  result.is_critical 
                                    ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-300' 
                                    : 'bg-destructive/10 border-destructive/50 text-destructive'
                                }`}>
                                  <span className="text-2xl">💥</span>
                                  <span>
                                    {result.damage} damage dealt
                                    {result.is_critical && ' - DEVASTATING BLOW!'}
                                  </span>
                                </div>
                                
                                {/* HP change */}
                                <div className="flex items-center gap-3 text-sm p-2 bg-background/30 rounded">
                                  <span className="text-muted-foreground">{result.defender_name}'s HP:</span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-green-400">{result.old_defender_hp}</span>
                                    <span className="text-muted-foreground">→</span>
                                    <span className={`font-mono font-bold ${
                                      result.new_defender_hp === 0 ? 'text-red-500' : 
                                      result.new_defender_hp < 20 ? 'text-orange-400' : 
                                      'text-green-400'
                                    }`}>
                                      {result.new_defender_hp}
                                    </span>
                                  </div>
                                  <Progress 
                                    value={(result.new_defender_hp / result.old_defender_hp) * 100}
                                    className="h-2 flex-1"
                                  />
                                </div>
                              </motion.div>
                            )}
                            
                            {/* KO message */}
                            {result.new_defender_hp === 0 && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.3, type: "spring" }}
                                className="text-red-500 font-bold text-xl mt-2 p-4 bg-red-500/10 rounded-lg border-2 border-red-500/50 text-center"
                              >
                                <span className="text-3xl mr-2">💀</span>
                                {result.defender_name} has been defeated!
                              </motion.div>
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
