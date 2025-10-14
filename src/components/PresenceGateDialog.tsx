import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Swords, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface PresenceGateDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  battleId: string;
}

const PresenceGateDialog: React.FC<PresenceGateDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  battleId,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = () => {
    setIsLoading(true);
    // Small delay to ensure assets are ready
    setTimeout(() => {
      onConfirm();
    }, 500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isLoading && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="flex justify-center mb-4"
          >
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Swords className="h-8 w-8 text-primary animate-pulse" />
            </div>
          </motion.div>
          <DialogTitle className="text-2xl text-center gradient-text">
            An Epic Battle Awaits
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            Your spider is ready to fight. Are you here and ready to watch the action unfold?
          </DialogDescription>
        </DialogHeader>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-4 py-4"
        >
          <div className="bg-muted/50 rounded-lg p-4 text-center space-y-2">
            <p className="text-sm font-medium">Get ready for:</p>
            <div className="flex justify-center gap-4 text-xs text-muted-foreground">
              <div className="flex flex-col items-center gap-1">
                <span className="text-2xl">⚔️</span>
                <span>Intense Action</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-2xl">🎬</span>
                <span>Cinematic View</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-2xl">🏆</span>
                <span>Epic Outcome</span>
              </div>
            </div>
          </div>
        </motion.div>

        <DialogFooter className="sm:justify-center gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="min-w-32"
          >
            Not Now
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading}
            className="min-w-32 bg-gradient-to-br from-primary via-primary-glow to-primary"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Swords className="h-4 w-4 mr-2" />
                I'm Here. Start Battle
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PresenceGateDialog;
