import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import BattleModeComponent from "@/components/BattleMode";

const BattleMode = () => {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden pb-safe">
      <Helmet>
        <title>Battle Mode — Spider League</title>
        <meta name="description" content="Challenge other players and claim their spiders in epic Spider League battles." />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <link rel="canonical" href={`${window.location.origin}/battle-mode`} />
      </Helmet>
      
      {/* Header */}
      <header className="glass-card border-b border-border/30 sticky top-0 z-40 backdrop-blur-xl">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <Link to="/" className="floating">
                <img 
                  src="/lovable-uploads/12c04e49-1f4c-4ed1-b840-514c07b83c24.png" 
                  alt="Spider League Logo" 
                  className="h-10 sm:h-14 w-auto flex-shrink-0 drop-shadow-lg hover:scale-105 transition-transform cursor-pointer"
                />
              </Link>
              <div>
                <h1 className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
                  Battle Mode
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground font-medium">
                  Challenge players and claim their spiders! 🕷️⚔️
                </p>
              </div>
            </div>
            
            <Button variant="ghost" asChild className="flex items-center gap-2">
              <Link to="/">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to Home</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <BattleModeComponent />
      </main>
    </div>
  );
};

export default BattleMode;