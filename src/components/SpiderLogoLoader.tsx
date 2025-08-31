import spiderLogo from "@/assets/spider-league-logo.png";

const SpiderLogoLoader = () => {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="relative">
          {/* Outer rotating ring */}
          <div className="w-32 h-32 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          {/* Logo in center */}
          <div className="absolute inset-4 flex items-center justify-center">
            <img 
              src={spiderLogo} 
              alt="Spider League"
              className="w-16 h-16 animate-pulse"
            />
          </div>
          {/* Inner pulsing glow */}
          <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping"></div>
        </div>
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-foreground animate-pulse">
            Spider League
          </p>
          <p className="text-sm text-muted-foreground">
            Signing you in...
          </p>
        </div>
      </div>
    </div>
  );
};

export default SpiderLogoLoader;