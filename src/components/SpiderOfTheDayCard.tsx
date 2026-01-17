import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, Sparkles, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSpiderOfTheDay } from '@/hooks/useSpiderOfTheDay';
import { useConfetti } from '@/hooks/useConfetti';
import { Skeleton } from '@/components/ui/skeleton';
import ClickableUsername from './ClickableUsername';

interface SpiderOfTheDayCardProps {
  onSpiderClick?: (spider: any) => void;
}

export const SpiderOfTheDayCard = ({ onSpiderClick }: SpiderOfTheDayCardProps) => {
  const { spiderOfTheDay, loading } = useSpiderOfTheDay();
  const { fireConfetti } = useConfetti();
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    // Fire confetti once when the spider loads for the first time this session
    if (spiderOfTheDay && !hasAnimated) {
      const sessionKey = `sotd_${spiderOfTheDay.featuredDate}`;
      if (!sessionStorage.getItem(sessionKey)) {
        sessionStorage.setItem(sessionKey, 'true');
        setTimeout(() => fireConfetti('spotlight'), 500);
      }
      setHasAnimated(true);
    }
  }, [spiderOfTheDay, hasAnimated, fireConfetti]);

  if (loading) {
    return (
      <Card className="glass-card overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-16 w-16 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!spiderOfTheDay) return null;

  const rarityColors: Record<string, string> = {
    COMMON: 'bg-gray-500',
    UNCOMMON: 'bg-green-500',
    RARE: 'bg-blue-500',
    EPIC: 'bg-purple-500',
    LEGENDARY: 'bg-amber-500'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card 
        className="glass-card overflow-hidden cursor-pointer group relative border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5"
        onClick={() => onSpiderClick?.(spiderOfTheDay.spider)}
      >
        {/* Spotlight effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-400/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        
        {/* Crown badge */}
        <div className="absolute -top-1 -right-1 z-10">
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="bg-gradient-to-r from-amber-500 to-orange-500 p-2 rounded-bl-xl shadow-lg"
          >
            <Crown className="h-4 w-4 text-white" />
          </motion.div>
        </div>

        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
              Spider of the Day
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Spider image */}
            <motion.div 
              className="relative"
              whileHover={{ scale: 1.05 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/40 to-orange-500/40 rounded-lg blur-md" />
              <img
                src={spiderOfTheDay.spider.image_url}
                alt={spiderOfTheDay.spider.nickname}
                className="relative h-20 w-20 object-cover rounded-lg shadow-lg ring-2 ring-amber-500/50"
              />
              <Badge 
                className={`absolute -bottom-2 -right-2 ${rarityColors[spiderOfTheDay.spider.rarity]} text-white text-[10px] px-1.5`}
              >
                {spiderOfTheDay.spider.rarity}
              </Badge>
            </motion.div>

            {/* Spider info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg truncate">
                {spiderOfTheDay.spider.nickname}
              </h3>
              <p className="text-sm text-muted-foreground truncate">
                {spiderOfTheDay.spider.species}
              </p>
              
              {spiderOfTheDay.spider.profiles && (
                <div className="text-xs text-muted-foreground mt-1">
                  Owned by{' '}
                  <ClickableUsername
                    userId={spiderOfTheDay.spider.owner_id}
                    displayName={spiderOfTheDay.spider.profiles.display_name}
                  />
                </div>
              )}

              {/* Power bonus indicator */}
              <div className="flex items-center gap-1 mt-2">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <span className="text-xs font-medium text-green-600 dark:text-green-400">
                  +{spiderOfTheDay.powerBonus}% Power Today!
                </span>
              </div>
            </div>

            {/* Power score */}
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">
                {spiderOfTheDay.spider.power_score}
              </div>
              <div className="text-xs text-muted-foreground">Power</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
