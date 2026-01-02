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
  const [revealedTurnsCount, setRevealedTurnsCount] = useState(0);
  const [statImprovements, setStatImprovements] = useState<Record<string, number> | null>(null);

  // Extract stat improvements from the last turn's result
  useEffect(() => {
    if (turns.length > 0) {
      const lastTurn = turns[turns.length - 1];
      const result = lastTurn?.result_payload as any;
      if (result?.stat_improvements && Object.keys(result.stat_improvements).length > 0) {
        setStatImprovements(result.stat_improvements);
      }
    }
  }, [turns]);

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

  // Progressive turn reveal system - shows one turn every 6 seconds
  useEffect(() => {
    if (turns.length === 0 || revealedTurnsCount >= turns.length) return;

    const timer = setTimeout(() => {
      setRevealedTurnsCount(prev => prev + 1);
    }, 6000);

    return () => clearTimeout(timer);
  }, [turns.length, revealedTurnsCount]);

  useEffect(() => {
    // Battle ended, show outcome reveal then redirect
    // Wait until all turns are revealed
    if (battle && !battle.is_active && !showOutcomeReveal && hasConfirmedPresence && revealedTurnsCount >= turns.length) {
      // Small delay to ensure all turns are visible first
      const revealTimer = setTimeout(() => {
        setShowOutcomeReveal(true);
      }, 2000);

      return () => clearTimeout(revealTimer);
    }
  }, [battle, showOutcomeReveal, hasConfirmedPresence, revealedTurnsCount, turns.length]);

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
    navigate('/battle-mode');
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
  
  // Simplified logic: if I won, winner is "You", loser is opponent name
  // If I lost, winner is opponent name, loser is "You"
  const opponentName = ((battle.team_a as any)?.userId === user?.id 
    ? (battle.team_b as any)?.userName 
    : (battle.team_a as any)?.userName) || 'Opponent';
  
  const winnerOwnerName = iWon ? 'You' : opponentName;
  const loserOwnerName = iWon ? opponentName : 'You';

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
          statImprovements={statImprovements || undefined}
          isCurrentUserWinner={iWon}
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
        {/* Battle Log - Moved to Top */}
        <Card className="mb-6">
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
                  {turns.slice(0, revealedTurnsCount).reverse().map((turn, index) => {
                    const result = turn.result_payload as any;
                    const isAttack = turn.action_type === 'attack';
                    const isSpecial = turn.action_type === 'special';
                    const dodged = result?.dodged || false;
                    const isCritical = result?.is_critical || false;
                    
                    return (
                      <motion.div
                        key={turn.id}
                        initial={{ opacity: 0, scale: 0.8, x: -50, rotateY: -20 }}
                        animate={{ 
                          opacity: 1, 
                          scale: 1, 
                          x: 0, 
                          rotateY: 0,
                          transition: {
                            type: "spring",
                            stiffness: 180,
                            damping: 22,
                            delay: 0
                          }
                        }}
                        whileHover={{ 
                          scale: 1.02,
                          transition: { duration: 0.2 }
                        }}
                        exit={{ 
                          opacity: 0, 
                          scale: 0.9,
                          transition: { duration: 0.2 }
                        }}
                        className={`relative overflow-hidden text-sm p-6 rounded-xl border-2 transition-all backdrop-blur-sm ${
                          isCritical
                            ? 'border-yellow-400 bg-gradient-to-br from-yellow-500/30 via-yellow-600/20 to-orange-500/10 shadow-2xl shadow-yellow-500/30' 
                            : dodged
                            ? 'border-blue-400 bg-gradient-to-br from-blue-500/30 via-cyan-500/20 to-blue-600/10 shadow-2xl shadow-blue-500/30'
                            : isSpecial
                            ? 'border-purple-400 bg-gradient-to-br from-purple-500/25 via-fuchsia-500/15 to-purple-600/10 shadow-xl shadow-purple-500/20'
                            : 'border-border/50 bg-gradient-to-br from-muted/40 to-background/20 shadow-md'
                        }`}
                        >
                          {/* Animated background glow effect */}
                          {(isCritical || dodged) && (
                            <motion.div
                              className="absolute inset-0 opacity-30"
                              animate={{
                                background: isCritical 
                                  ? [
                                      'radial-gradient(circle at 50% 50%, rgba(234, 179, 8, 0.3) 0%, transparent 70%)',
                                      'radial-gradient(circle at 50% 50%, rgba(234, 179, 8, 0.5) 0%, transparent 70%)',
                                      'radial-gradient(circle at 50% 50%, rgba(234, 179, 8, 0.3) 0%, transparent 70%)',
                                    ]
                                  : [
                                      'radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.3) 0%, transparent 70%)',
                                      'radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.5) 0%, transparent 70%)',
                                      'radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.3) 0%, transparent 70%)',
                                    ]
                              }}
                              transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                ease: "easeInOut"
                              }}
                            />
                          )}
                          {/* Turn header */}
                          <div className="flex items-center justify-between mb-4 relative z-10">
                              <motion.span 
                                initial={{ scale: 0, x: -20 }}
                                animate={{ 
                                  scale: 1, 
                                  x: 0,
                                   transition: {
                                     type: "spring",
                                     stiffness: 300,
                                     damping: 15,
                                     delay: 0.3
                                   }
                                }}
                                className="font-black text-2xl bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent"
                              >
                                Turn {turn.turn_index}
                              </motion.span>
                            <div className="flex items-center gap-2">
                              {isCritical && (
                                <motion.div
                                  initial={{ scale: 0, rotate: -180 }}
                                  animate={{ 
                                    scale: 1, 
                                    rotate: 0,
                                   transition: {
                                     type: "spring",
                                     stiffness: 400,
                                     delay: 0.5
                                   }
                                  }}
                                >
                                  <motion.div
                                    animate={{
                                      scale: [1, 1.1, 1],
                                    }}
                                    transition={{
                                      duration: 0.8,
                                      repeat: Infinity,
                                      ease: "easeInOut"
                                    }}
                                  >
                                    <Badge variant="default" className="text-xs bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-black shadow-2xl border-2 border-yellow-300">
                                      ⚡ CRITICAL HIT! ⚡
                                    </Badge>
                                  </motion.div>
                                </motion.div>
                              )}
                              {dodged && (
                                <motion.div
                                  initial={{ scale: 0, rotate: 180 }}
                                  animate={{ 
                                    scale: 1, 
                                    rotate: 0,
                                   transition: {
                                     type: "spring",
                                     stiffness: 400,
                                     delay: 0.5
                                   }
                                  }}
                                >
                                  <motion.div
                                    animate={{
                                      x: [-2, 2, -2],
                                    }}
                                    transition={{
                                      duration: 0.6,
                                      repeat: Infinity,
                                      ease: "easeInOut"
                                    }}
                                  >
                                    <Badge variant="default" className="text-xs bg-gradient-to-r from-blue-400 to-cyan-500 font-black shadow-2xl border-2 border-blue-300">
                                      💨 DODGED! 💨
                                    </Badge>
                                  </motion.div>
                                </motion.div>
                              )}
                               <motion.div
                                 initial={{ scale: 0 }}
                                 animate={{ 
                                   scale: 1,
                                   transition: {
                                     delay: 0.4
                                   }
                                 }}
                              >
                                <Badge 
                                  variant={isSpecial ? "default" : "outline"} 
                                  className={`text-xs font-bold shadow-lg ${
                                    isSpecial 
                                      ? 'bg-gradient-to-r from-purple-500 to-fuchsia-500 border-2 border-purple-300' 
                                      : 'border-2'
                                  }`}
                                >
                                  {isSpecial ? '✨ SPECIAL MOVE ✨' : '⚔️ ATTACK'}
                                </Badge>
                              </motion.div>
                            </div>
                          </div>
                          
                          {result && (
                            <div className="space-y-4 relative z-10">
                              {/* Action description with cinematic entrance */}
                              <motion.div 
                                initial={{ opacity: 0, x: -30, scale: 0.9 }}
                                 animate={{ 
                                   opacity: 1, 
                                   x: 0, 
                                   scale: 1,
                                   transition: {
                                     type: "spring",
                                     stiffness: 200,
                                     delay: 0.8
                                   }
                                 }}
                                className="font-bold text-lg leading-relaxed"
                              >
                                <motion.span 
                                  className="text-primary text-xl"
                                  animate={isCritical ? {
                                    textShadow: [
                                      '0 0 8px rgba(234, 179, 8, 0.8)',
                                      '0 0 16px rgba(234, 179, 8, 0.8)',
                                      '0 0 8px rgba(234, 179, 8, 0.8)',
                                    ]
                                  } : {}}
                                  transition={{ duration: 1, repeat: Infinity }}
                                >
                                  {result.attacker_name}
                                </motion.span>
                                {isAttack && (
                                   <motion.span
                                     initial={{ opacity: 0 }}
                                     animate={{ opacity: 1 }}
                                     transition={{ delay: 1.0 }}
                                   >
                                     {' '}launches a devastating attack on{' '}
                                   </motion.span>
                                )}
                                {isSpecial && (
                                   <motion.span
                                     initial={{ opacity: 0 }}
                                     animate={{ opacity: 1 }}
                                     transition={{ delay: 1.0 }}
                                   >
                                    {' '}unleashes{' '}
                                    <motion.span 
                                      className="text-purple-400 text-xl font-black"
                                      animate={{
                                        textShadow: [
                                          '0 0 10px rgba(168, 85, 247, 0.8)',
                                          '0 0 20px rgba(168, 85, 247, 0.8)',
                                          '0 0 10px rgba(168, 85, 247, 0.8)',
                                        ]
                                      }}
                                      transition={{ duration: 1.2, repeat: Infinity }}
                                    >
                                      {result.special_move || 'Special Attack'}
                                    </motion.span>
                                    {' '}on{' '}
                                  </motion.span>
                                )}
                                <motion.span 
                                  className="text-destructive text-xl"
                                  animate={dodged ? {
                                    x: [-1, 1, -1],
                                  } : {}}
                                  transition={{ duration: 0.3, repeat: Infinity }}
                                >
                                  {result.defender_name}
                                </motion.span>!
                              </motion.div>
                              
                              {/* Dice rolls with cinematic presentation */}
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                 animate={{ 
                                   opacity: 1, 
                                   scale: 1, 
                                   y: 0,
                                   transition: {
                                     type: "spring",
                                     delay: 1.3
                                   }
                                 }}
                                className="flex items-center gap-4 p-4 bg-gradient-to-br from-background/70 to-muted/50 rounded-lg border-2 border-primary/30 backdrop-blur-sm shadow-lg"
                              >
                                <motion.div 
                                  className="flex items-center gap-2"
                                  initial={{ rotate: 0 }}
                                   animate={{ rotate: [0, 360, 720] }}
                                   transition={{ 
                                     duration: 0.8, 
                                     delay: 1.5,
                                     ease: "easeOut"
                                   }}
                                >
                                  <motion.span 
                                    className="text-3xl"
                                    animate={result.attacker_dice === 20 ? {
                                      scale: [1, 1.3, 1],
                                      rotate: [0, 10, -10, 0]
                                    } : {}}
                                    transition={{ duration: 0.6, repeat: Infinity }}
                                  >
                                    🎲
                                  </motion.span>
                                  <div className="text-sm">
                                    <div className="text-muted-foreground font-semibold">Attack Roll</div>
                                    <motion.div 
                                      className={`font-black text-2xl ${
                                        result.attacker_dice === 20 ? 'text-yellow-400' :
                                        result.attacker_dice >= 15 ? 'text-green-500' : 
                                        'text-foreground'
                                      }`}
                                      initial={{ scale: 0 }}
                                       animate={{ 
                                         scale: 1,
                                         transition: {
                                           type: "spring",
                                           delay: 1.8
                                         }
                                       }}
                                    >
                                      {result.attacker_dice}
                                    </motion.div>
                                  </div>
                                </motion.div>
                                <div className="h-8 w-px bg-border" />
                                <motion.div 
                                  className="flex items-center gap-2"
                                  initial={{ rotate: 0 }}
                                   animate={{ rotate: [0, -360, -720] }}
                                   transition={{ 
                                     duration: 0.8, 
                                     delay: 1.5,
                                     ease: "easeOut"
                                   }}
                                >
                                  <motion.span 
                                    className="text-3xl"
                                    animate={result.defender_dice >= 19 ? {
                                      scale: [1, 1.3, 1],
                                      rotate: [0, -10, 10, 0]
                                    } : {}}
                                    transition={{ duration: 0.6, repeat: Infinity }}
                                  >
                                    🛡️
                                  </motion.span>
                                  <div className="text-sm">
                                    <div className="text-muted-foreground font-semibold">Defense Roll</div>
                                    <motion.div 
                                      className={`font-black text-2xl ${
                                        result.defender_dice >= 19 ? 'text-blue-400' : 
                                        result.defender_dice >= 15 ? 'text-green-500' : 
                                        'text-foreground'
                                      }`}
                                      initial={{ scale: 0 }}
                                       animate={{ 
                                         scale: 1,
                                         transition: {
                                           type: "spring",
                                           delay: 1.8
                                         }
                                       }}
                                    >
                                      {result.defender_dice}
                                    </motion.div>
                                  </div>
                                </motion.div>
                              </motion.div>
                              
                              {/* Damage or dodge with cinematic effects */}
                              {dodged ? (
                                <motion.div 
                                  initial={{ opacity: 0, scale: 0.8, x: -20 }}
                                   animate={{ 
                                     opacity: 1, 
                                     scale: 1, 
                                     x: 0,
                                     transition: {
                                       type: "spring",
                                       delay: 2.3
                                     }
                                   }}
                                  whileHover={{ scale: 1.02 }}
                                  className="text-blue-400 font-bold text-xl flex items-center gap-3 p-5 bg-gradient-to-r from-blue-500/20 to-cyan-500/10 rounded-lg border-2 border-blue-400/50 shadow-xl"
                                >
                                  <motion.span 
                                    className="text-4xl"
                                    animate={{
                                      x: [-5, 5, -5],
                                      rotate: [-10, 10, -10]
                                    }}
                                    transition={{ duration: 0.5, repeat: Infinity }}
                                  >
                                    💨
                                  </motion.span>
                                  <span>{result.defender_name} narrowly dodges the attack!</span>
                                </motion.div>
                              ) : result.damage > 0 && (
                                <motion.div 
                                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                                   animate={{ 
                                     opacity: 1, 
                                     scale: 1, 
                                     y: 0,
                                     transition: {
                                       type: "spring",
                                       delay: 2.3
                                     }
                                   }}
                                  className="space-y-3"
                                >
                                  <motion.div 
                                    className={`font-bold text-xl flex items-center gap-3 p-5 rounded-lg border-2 shadow-xl ${
                                      isCritical
                                        ? 'bg-gradient-to-r from-yellow-500/30 to-orange-500/20 border-yellow-400/70 text-yellow-300' 
                                        : 'bg-gradient-to-r from-destructive/20 to-red-500/10 border-destructive/60 text-destructive'
                                    }`}
                                    animate={isCritical ? {
                                      scale: [1, 1.05, 1],
                                    } : {}}
                                    transition={{ duration: 0.5, repeat: Infinity }}
                                  >
                                    <motion.span 
                                      className="text-4xl"
                                      animate={{
                                        rotate: isCritical ? [0, 15, -15, 0] : [0],
                                        scale: isCritical ? [1, 1.2, 1] : [1]
                                      }}
                                      transition={{ duration: 0.4, repeat: Infinity }}
                                    >
                                      💥
                                    </motion.span>
                                    <span>
                                      <motion.span
                                        className="text-3xl font-black"
                                        animate={isCritical ? {
                                          textShadow: [
                                            '0 0 10px rgba(234, 179, 8, 0.8)',
                                            '0 0 20px rgba(234, 179, 8, 1)',
                                            '0 0 10px rgba(234, 179, 8, 0.8)',
                                          ]
                                        } : {}}
                                        transition={{ duration: 0.8, repeat: Infinity }}
                                      >
                                        {result.damage}
                                      </motion.span>
                                      {' '}damage dealt
                                      {isCritical && ' - DEVASTATING BLOW!'}
                                    </span>
                                  </motion.div>
                                  
                                  {/* HP change with cinematic display */}
                                  <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                     animate={{ 
                                       opacity: 1, 
                                       y: 0,
                                       transition: {
                                         delay: 2.7
                                       }
                                     }}
                                    className="flex items-center gap-4 text-base p-4 bg-gradient-to-r from-background/60 to-muted/40 rounded-lg backdrop-blur-sm border border-border/50"
                                  >
                                    <span className="text-muted-foreground font-semibold">{result.defender_name}'s HP:</span>
                                    <div className="flex items-center gap-3">
                                       <motion.span 
                                         className="font-mono font-black text-xl text-green-400"
                                         initial={{ scale: 1 }}
                                         animate={{ scale: [1, 1.2, 1] }}
                                         transition={{ delay: 2.9, duration: 0.3 }}
                                       >
                                        {result.old_defender_hp}
                                      </motion.span>
                                      <motion.span 
                                        className="text-muted-foreground text-2xl"
                                        animate={{ x: [0, 5, 0] }}
                                        transition={{ duration: 0.6, repeat: Infinity }}
                                      >
                                        →
                                      </motion.span>
                                      <motion.span 
                                        className={`font-mono font-black text-2xl ${
                                          result.new_defender_hp === 0 ? 'text-red-500' : 
                                          result.new_defender_hp < 20 ? 'text-orange-400' : 
                                          'text-green-400'
                                        }`}
                                        initial={{ scale: 0 }}
                                         animate={{ 
                                           scale: 1,
                                           transition: {
                                             type: "spring",
                                             delay: 3.1
                                           }
                                         }}
                                      >
                                        {result.new_defender_hp}
                                      </motion.span>
                                    </div>
                                    <Progress 
                                      value={(result.new_defender_hp / result.old_defender_hp) * 100}
                                      className="h-3 flex-1"
                                    />
                                  </motion.div>
                                </motion.div>
                              )}
                              
                              {/* KO message with dramatic effect */}
                              {result.new_defender_hp === 0 && (
                                <motion.div 
                                  initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
                                   animate={{ 
                                     opacity: 1, 
                                     scale: 1, 
                                     rotate: 0,
                                     transition: {
                                       type: "spring",
                                       stiffness: 200,
                                       delay: 3.3
                                     }
                                   }}
                                  className="text-red-400 font-black text-2xl mt-3 p-6 bg-gradient-to-br from-red-500/30 to-red-600/10 rounded-xl border-4 border-red-500/70 text-center shadow-2xl"
                                >
                                  <motion.span 
                                    className="text-5xl mr-3"
                                    animate={{
                                      rotate: [0, 10, -10, 0],
                                      scale: [1, 1.2, 1]
                                    }}
                                    transition={{ duration: 1, repeat: Infinity }}
                                  >
                                    💀
                                  </motion.span>
                                  <motion.span
                                    animate={{
                                      textShadow: [
                                        '0 0 10px rgba(239, 68, 68, 0.8)',
                                        '0 0 20px rgba(239, 68, 68, 1)',
                                        '0 0 10px rgba(239, 68, 68, 0.8)',
                                      ]
                                    }}
                                    transition={{ duration: 1, repeat: Infinity }}
                                  >
                                    {result.defender_name} has been defeated!
                                  </motion.span>
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

        <AnimatePresence>
          {battleEnded && revealedTurnsCount >= turns.length && (
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
                <p className="font-medium">Spiders are entering the Web Cage</p>
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
                {battleEnded && iWon && revealedTurnsCount >= turns.length && (
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
                {battleEnded && !iWon && revealedTurnsCount >= turns.length && (
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
      </main>
    </div>
  );
};

export default TurnBasedBattle;
