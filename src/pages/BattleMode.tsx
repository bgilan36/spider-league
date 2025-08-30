import { Helmet } from "react-helmet-async";
import BattleModeComponent from "@/components/BattleMode";

const BattleMode = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Battle Mode — Spider League</title>
        <meta name="description" content="Challenge other players and claim their spiders in epic Spider League battles." />
        <link rel="canonical" href={`${window.location.origin}/battle-mode`} />
      </Helmet>
      
      {/* Header */}
      <header className="glass-card border-b border-border/30 sticky top-0 z-40 backdrop-blur-xl">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="floating">
              <img 
                src="/lovable-uploads/3a8558c8-28e5-4ad2-8bb8-425536ee81ca.png" 
                alt="Spider League Logo" 
                className="h-10 sm:h-14 w-auto flex-shrink-0 drop-shadow-lg"
              />
            </div>
            <div>
              <h1 className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
                Battle Mode
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground font-medium">
                Challenge players and claim their spiders! 🕷️⚔️
              </p>
            </div>
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