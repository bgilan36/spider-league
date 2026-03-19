import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Star, Zap, Sparkles } from 'lucide-react';
import { useLoginStreak } from '@/hooks/useLoginStreak';
import { useConfetti } from '@/hooks/useConfetti';
import { Badge } from '@/components/ui/badge';

export const LoginStreakDisplay = () => {
  const { streak, loading, justUpdated } = useLoginStreak();
  const { fireConfetti } = useConfetti();

  useEffect(() => {
    if (justUpdated && streak && streak.currentStreak > 1) {
      fireConfetti('streak');
    }
  }, [justUpdated, streak, fireConfetti]);

  if (loading || !streak) return null;

  const getStreakIcon = () => {
    if (streak.currentStreak >= 7) return <Flame className="h-4 w-4 text-orange-500" />;
    if (streak.currentStreak >= 3) return <Zap className="h-4 w-4 text-amber-500" />;
    return <Star className="h-4 w-4 text-yellow-500" />;
  };

  const getStreakColor = () => {
    if (streak.currentStreak >= 7) return 'bg-gradient-to-r from-orange-500 to-red-500';
    if (streak.currentStreak >= 3) return 'bg-gradient-to-r from-amber-500 to-orange-500';
    return 'bg-gradient-to-r from-yellow-500 to-amber-500';
  };

  const getMilestoneReward = () => {
    if (streak.currentStreak === 7) return '🎁 Weekly Bonus!';
    if (streak.currentStreak === 30) return '🏆 Monthly Champion!';
    if (streak.currentStreak === 3) return '🔥 On Fire!';
    return null;
  };

  const milestone = getMilestoneReward();

  return (
    <AnimatePresence>
      <motion.div
        initial={justUpdated ? { scale: 0.8, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        className="flex flex-wrap items-center gap-2"
      >
        {/* Welcome back banner for new day */}
        {justUpdated && streak.isNewDay && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/20 border border-accent/30 text-sm"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">Welcome back!</span>
            {streak.dailyBonusXp > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 300 }}
                className="font-bold text-primary"
              >
                +{streak.dailyBonusXp} XP
              </motion.span>
            )}
          </motion.div>
        )}

        <motion.div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${getStreakColor()} text-white text-sm font-semibold shadow-lg`}
          whileHover={{ scale: 1.05 }}
          animate={justUpdated ? {
            scale: [1, 1.1, 1],
            transition: { duration: 0.5, repeat: 2 }
          } : {}}
        >
          {getStreakIcon()}
          <span>{streak.currentStreak} Day{streak.currentStreak !== 1 ? 's' : ''}</span>
        </motion.div>

        {streak.streakPowerBonus > 0 && (
          <Badge variant="outline" className="text-xs border-primary/30 text-primary">
            +{streak.streakPowerBonus}% Power
          </Badge>
        )}

        {milestone && justUpdated && (
          <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="text-sm font-medium text-primary"
          >
            {milestone}
          </motion.span>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
