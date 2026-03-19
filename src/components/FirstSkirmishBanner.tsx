import { motion } from "framer-motion";
import { Zap, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FirstSkirmishBannerProps {
  onStartSkirmish: () => void;
  onDismiss: () => void;
}

const FirstSkirmishBanner = ({ onStartSkirmish, onDismiss }: FirstSkirmishBannerProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 p-4 sm:p-5"
    >
      {/* Pulsing background glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent animate-pulse pointer-events-none" />

      <button
        onClick={onDismiss}
        className="absolute top-2 right-2 p-1 rounded-full text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="relative flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="flex-shrink-0 h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center"
        >
          <Zap className="h-6 w-6 text-primary" />
        </motion.div>

        <div className="flex-1 text-center sm:text-left">
          <h3 className="text-sm sm:text-base font-bold text-foreground">
            Ready for your first fight? ⚔️
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Jump into a Skirmish — it's risk-free and earns XP for your spider!
          </p>
        </div>

        <Button
          onClick={onStartSkirmish}
          size="sm"
          className="flex-shrink-0 gap-1.5"
        >
          <Zap className="h-4 w-4" />
          Start Skirmish
        </Button>
      </div>
    </motion.div>
  );
};

export default FirstSkirmishBanner;
