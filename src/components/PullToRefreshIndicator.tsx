import { Loader2, ArrowDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  progress: number;
  shouldTrigger: boolean;
}

export const PullToRefreshIndicator = ({
  pullDistance,
  isRefreshing,
  progress,
  shouldTrigger,
}: PullToRefreshIndicatorProps) => {
  const [showSuccess, setShowSuccess] = useState(false);
  const [wasRefreshing, setWasRefreshing] = useState(false);

  // Detect when refresh completes to trigger success animation
  useEffect(() => {
    if (isRefreshing) {
      setWasRefreshing(true);
    } else if (wasRefreshing && !isRefreshing) {
      setShowSuccess(true);
      const timer = setTimeout(() => {
        setShowSuccess(false);
        setWasRefreshing(false);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isRefreshing, wasRefreshing]);

  if (pullDistance === 0 && !isRefreshing && !showSuccess) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
        style={{ paddingTop: showSuccess ? 20 : Math.max(pullDistance - 20, 0) }}
      >
        <motion.div
          className={`
            flex items-center justify-center w-10 h-10 rounded-full 
            ${showSuccess ? 'bg-green-500' : shouldTrigger || isRefreshing ? 'bg-primary' : 'bg-muted'}
            shadow-lg transition-colors duration-200
          `}
          style={{
            transform: showSuccess ? undefined : `scale(${0.5 + progress * 0.5})`,
          }}
          animate={showSuccess ? {
            scale: [1, 1.3, 1],
            y: [0, -10, 0],
          } : {}}
          transition={showSuccess ? {
            duration: 0.4,
            ease: "easeOut",
          } : {}}
        >
          {showSuccess ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 15 }}
            >
              <Check className="w-5 h-5 text-white" />
            </motion.div>
          ) : isRefreshing ? (
            <Loader2 className="w-5 h-5 text-primary-foreground animate-spin" />
          ) : (
            <motion.div
              animate={{ rotate: shouldTrigger ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ArrowDown 
                className={`w-5 h-5 ${shouldTrigger ? 'text-primary-foreground' : 'text-muted-foreground'}`} 
              />
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
