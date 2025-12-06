import { Loader2, ArrowDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
  if (pullDistance === 0 && !isRefreshing) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
        style={{ paddingTop: Math.max(pullDistance - 20, 0) }}
      >
        <motion.div
          className={`
            flex items-center justify-center w-10 h-10 rounded-full 
            ${shouldTrigger || isRefreshing ? 'bg-primary' : 'bg-muted'}
            shadow-lg transition-colors duration-200
          `}
          style={{
            transform: `scale(${0.5 + progress * 0.5})`,
          }}
        >
          {isRefreshing ? (
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
