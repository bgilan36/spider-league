import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Crown, Sparkles, Share2, X } from 'lucide-react';
import { toast } from 'sonner';

interface Spider {
  id: string;
  nickname: string;
  species: string;
  image_url: string;
  power_score: number;
}

interface BattleOutcomeRevealProps {
  winner: Spider;
  loser: Spider;
  winnerOwnerName: string;
  loserOwnerName: string;
  onComplete: () => void;
}

const BattleOutcomeReveal: React.FC<BattleOutcomeRevealProps> = ({
  winner,
  loser,
  winnerOwnerName,
  loserOwnerName,
  onComplete,
}) => {
  const handleShare = async () => {
    const shareText = `🕷️ ${winner.nickname} just won an epic battle in Spider League! 🏆\n\nJoin the action and battle your own spiders at https://spiderleague.app/`;
    const shareUrl = 'https://spiderleague.app/';

    try {
      if (navigator.share) {
        // Try to fetch and include the spider image
        try {
          const response = await fetch(winner.image_url);
          const blob = await response.blob();
          const file = new File([blob], `${winner.nickname}-victory.jpg`, { type: blob.type });

          // Check if sharing files is supported
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: 'Spider League Battle Victory',
              text: shareText,
              url: shareUrl,
              files: [file],
            });
            toast.success('Battle shared successfully!');
          } else {
            // Share without image if files not supported
            await navigator.share({
              title: 'Spider League Battle Victory',
              text: shareText,
              url: shareUrl,
            });
            toast.success('Battle shared successfully!');
          }
        } catch (imageError) {
          console.warn('Could not fetch image, sharing without it:', imageError);
          // Fallback to sharing without image
          await navigator.share({
            title: 'Spider League Battle Victory',
            text: shareText,
            url: shareUrl,
          });
          toast.success('Battle shared successfully!');
        }
      } else {
        // Fallback: Copy to clipboard
        await navigator.clipboard.writeText(shareText);
        toast.success('Battle result copied to clipboard! Share it with your friends!');
      }
    } catch (error) {
      // User cancelled share or clipboard access denied
      if ((error as Error).name === 'AbortError') {
        // User cancelled, don't show error
        return;
      }
      
      console.error('Share error:', error);
      
      // Final fallback: create a temporary textarea to copy
      try {
        const textarea = document.createElement('textarea');
        textarea.value = shareText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        toast.success('Battle result copied to clipboard!');
      } catch (fallbackError) {
        console.error('Fallback copy failed:', fallbackError);
        toast.error('Unable to share. Please try again.');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-yellow-500/30 rounded-full"
            initial={{
              x: Math.random() * window.innerWidth,
              y: window.innerHeight + 50,
            }}
            animate={{
              y: -50,
              x: Math.random() * window.innerWidth,
            }}
            transition={{
              duration: Math.random() * 3 + 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{
          type: 'spring',
          stiffness: 200,
          damping: 20,
          duration: 1,
        }}
        className="relative z-10 max-w-3xl w-full"
      >
        <Card className="border-4 border-yellow-500 bg-gradient-to-br from-yellow-500/20 via-background to-background shadow-2xl">
          <CardContent className="p-8 text-center space-y-6">
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4"
              onClick={onComplete}
            >
              <X className="h-5 w-5" />
            </Button>
            {/* Trophy animation */}
            <motion.div
              initial={{ scale: 0, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ delay: 0.3, type: 'spring' }}
            >
              <div className="relative inline-block">
                <Trophy className="h-24 w-24 text-yellow-500 mx-auto" />
                <motion.div
                  className="absolute -inset-4"
                  animate={{
                    rotate: 360,
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                >
                  <Sparkles className="h-8 w-8 text-yellow-300 absolute top-0 left-0" />
                  <Sparkles className="h-6 w-6 text-yellow-400 absolute bottom-0 right-0" />
                </motion.div>
              </div>
            </motion.div>

            {/* Victory text */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <h2 className="text-6xl font-bold gradient-text mb-2">
                VICTORY!
              </h2>
              <Badge className="text-lg px-4 py-1 bg-yellow-500 hover:bg-yellow-600">
                <Crown className="h-4 w-4 mr-1" />
                Battle Complete
              </Badge>
            </motion.div>

            {/* Winner card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8 }}
              className="max-w-md mx-auto"
            >
              <Card className="ring-4 ring-green-500 bg-green-500/10">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <motion.img
                      src={winner.image_url}
                      alt={winner.nickname}
                      className="w-24 h-24 rounded-full object-cover ring-4 ring-green-500"
                      initial={{ rotate: -10 }}
                      animate={{ rotate: 10 }}
                      transition={{
                        repeat: Infinity,
                        repeatType: 'reverse',
                        duration: 0.5,
                      }}
                    />
                    <div className="flex-1 text-left">
                      <h3 className="text-2xl font-bold">{winner.nickname}</h3>
                      <p className="text-sm text-muted-foreground">{winner.species}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Owned by <span className="font-semibold text-foreground">{winnerOwnerName}</span>
                      </p>
                      <div className="mt-2">
                        <Badge variant="outline">Power: {winner.power_score}</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Prevails text */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1 }}
              className="text-2xl font-semibold text-yellow-500"
            >
              {winner.nickname} prevails!
            </motion.div>

            {/* Defeated spider (grayed out) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              transition={{ delay: 1.3 }}
              className="text-sm text-muted-foreground"
            >
              <p className="mb-2">Defeated:</p>
              <div className="flex items-center justify-center gap-2 grayscale opacity-70">
                <img
                  src={loser.image_url}
                  alt={loser.nickname}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div className="text-left">
                  <p className="font-semibold">{loser.nickname}</p>
                  <p className="text-xs">Was owned by {loserOwnerName}</p>
                </div>
              </div>
            </motion.div>

            {/* Action buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5 }}
              className="flex gap-3 justify-center pt-4"
            >
              <Button
                variant="outline"
                size="lg"
                onClick={handleShare}
                className="gap-2"
              >
                <Share2 className="h-5 w-5" />
                Share Victory
              </Button>
              <Button
                size="lg"
                onClick={onComplete}
                className="gap-2"
              >
                Close
              </Button>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default BattleOutcomeReveal;
