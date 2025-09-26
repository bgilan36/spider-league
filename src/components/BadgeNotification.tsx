import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Trophy, Crown, Award, Sword, Shield, Zap, Star, Flame, Hexagon, LucideIcon } from "lucide-react";

interface BadgeData {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  color: string;
}

interface BadgeNotificationProps {
  badge: BadgeData | null;
  isVisible: boolean;
  onDismiss: () => void;
}

const iconMap: Record<string, LucideIcon> = {
  Trophy, Crown, Award, Sword, Shield, Zap, Star, Flame, Hexagon
};

const rarityColors = {
  common: 'bg-gray-500',
  rare: 'bg-blue-500', 
  epic: 'bg-purple-500',
  legendary: 'bg-amber-500'
};

export const BadgeNotification = ({ badge, isVisible, onDismiss }: BadgeNotificationProps) => {
  const [autoHide, setAutoHide] = useState(false);

  useEffect(() => {
    if (isVisible && badge) {
      const timer = setTimeout(() => {
        setAutoHide(true);
        setTimeout(onDismiss, 500); // Allow exit animation to complete
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [isVisible, badge, onDismiss]);

  if (!badge) return null;

  const IconComponent = iconMap[badge.icon] || Trophy;

  return (
    <AnimatePresence>
      {isVisible && !autoHide && (
        <motion.div
          initial={{ opacity: 0, y: -100, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -100, scale: 0.8 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50"
        >
          <Card className="w-96 max-w-[90vw] shadow-2xl border-2 border-primary/20 bg-background/95 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <motion.div
                  initial={{ rotate: 0, scale: 1 }}
                  animate={{ rotate: [0, -10, 10, -5, 5, 0], scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className={`p-3 rounded-full flex-shrink-0 ${rarityColors[badge.rarity]}`}
                  style={{ backgroundColor: badge.color }}
                >
                  <IconComponent className="h-8 w-8 text-white" />
                </motion.div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="flex items-center space-x-2 mb-2"
                      >
                        <h3 className="text-lg font-bold text-primary">Achievement Unlocked!</h3>
                        <Badge 
                          variant="outline"
                          className={`${rarityColors[badge.rarity]} text-white border-0 text-xs`}
                          style={{ backgroundColor: badge.color }}
                        >
                          {badge.rarity.toUpperCase()}
                        </Badge>
                      </motion.div>

                      <motion.h4
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                        className="font-semibold text-base mb-1"
                      >
                        {badge.name}
                      </motion.h4>

                      <motion.p
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 }}
                        className="text-sm text-muted-foreground"
                      >
                        {badge.description}
                      </motion.p>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onDismiss}
                      className="text-muted-foreground hover:text-foreground p-1 h-auto"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
};