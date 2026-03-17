import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if it's iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const hasBeenDismissed = localStorage.getItem('installPromptDismissed');

    if (!isStandalone && !hasBeenDismissed) {
      if (iOS) {
        setShowPrompt(true);
      } else {
        // Listen for the beforeinstallprompt event
        const handler = (e: Event) => {
          e.preventDefault();
          setDeferredPrompt(e as BeforeInstallPromptEvent);
          setShowPrompt(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => {
          window.removeEventListener('beforeinstallprompt', handler);
        };
      }
    }
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('installPromptDismissed', 'true');
  };

  if (!showPrompt) return null;

  // Hide on mobile devices
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile) return null;

  return (
    <Card className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 p-4 shadow-lg border-primary/20 bg-card/95 backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <img 
              src="/favicon.png" 
              alt="Spider League" 
              className="h-8 w-8 rounded"
            />
            <h3 className="font-semibold text-sm">Install Spider League</h3>
          </div>
          
          {isIOS ? (
            <p className="text-xs text-muted-foreground mb-3">
              Tap the Share button <span className="inline-block">📤</span> and select "Add to Home Screen"
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mb-3">
              Install Spider League for quick access and a better experience
            </p>
          )}

          <div className="flex gap-2">
            {!isIOS && (
              <Button 
                size="sm" 
                onClick={handleInstallClick}
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                Install App
              </Button>
            )}
            <Button 
              size="sm" 
              variant="ghost"
              onClick={handleDismiss}
              className={isIOS ? "flex-1" : ""}
            >
              {isIOS ? "Got it" : "Not now"}
            </Button>
          </div>
        </div>
        
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
};
