import React, { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Heart, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const GlobalHeader: React.FC = () => {
  const location = useLocation();
  const [tipModalOpen, setTipModalOpen] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<string>('5');
  const isHomeRoute = location.pathname === '/';

  const normalizedAmount = useMemo(() => {
    const parsed = Number.parseFloat(selectedAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed.toFixed(2);
  }, [selectedAmount]);

  const venmoWebUrl = useMemo(() => {
    if (!normalizedAmount) return 'https://venmo.com/u/Brian-Gilan';
    const params = new URLSearchParams({
      txn: 'pay',
      amount: normalizedAmount,
      note: 'Spider League tip',
    });
    return `https://venmo.com/u/Brian-Gilan?${params.toString()}`;
  }, [normalizedAmount]);

  const venmoAppUrl = useMemo(() => {
    if (!normalizedAmount) return 'venmo://users/Brian-Gilan';
    const params = new URLSearchParams({
      txn: 'pay',
      recipients: 'Brian-Gilan',
      amount: normalizedAmount,
      note: 'Spider League tip',
    });
    return `venmo://paycharge?${params.toString()}`;
  }, [normalizedAmount]);

  // Home has its own dedicated dashboard header, so this global bar is redundant there.
  if (isHomeRoute) {
    return null;
  }
  
  // Get page title based on route
  const getPageTitle = () => {
    const routes: Record<string, string> = {
      '/auth': 'Sign In',
      '/upload': 'Upload Spider',
      '/collection': 'My Collection',
      '/leaderboard': 'Leaderboard',
      '/battle-history': 'Battle History',
      '/roadmap': 'Roadmap',
      '/shop': 'Shop',
      '/admin': 'Admin Dashboard',
    };
    
    // Check for dynamic routes
    if (location.pathname.startsWith('/battle/')) {
      return 'Battle Arena';
    }
    if (location.pathname.startsWith('/collection/')) {
      return 'User Collection';
    }
    
    return routes[location.pathname] || 'Spider League';
  };

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/40">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left section - Logo/Home link */}
          <Link 
            to="/" 
            className="flex items-center gap-2 group transition-all duration-200 hover:opacity-80"
          >
            <img 
              src="/lovable-uploads/12c04e49-1f4c-4ed1-b840-514c07b83c24.png" 
              alt="Spider League" 
              className="h-8 w-auto"
            />
            <span className="sr-only sm:not-sr-only text-sm font-medium text-foreground transition-colors">
              Spider League
            </span>
          </Link>
          
          {/* Center - Page title (mobile only) */}
          <span className="sm:hidden text-sm font-semibold truncate max-w-[140px]">
            {getPageTitle()}
          </span>
          
          {/* Right section - Tip + Home button */}
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setTipModalOpen(true)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Buy the devs a coffee"
                >
                  <Heart className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="hidden sm:block">
                Buy the devs a coffee
              </TooltipContent>
            </Tooltip>

            <Button 
              variant="ghost" 
              size="sm" 
              asChild 
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Link to="/">
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">Home</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={tipModalOpen} onOpenChange={setTipModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Support Spider League</DialogTitle>
            <DialogDescription>
              Tip the devs on Venmo. Quick tip is $5, or enter your own amount.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant={selectedAmount === '5' ? 'default' : 'outline'} onClick={() => setSelectedAmount('5')}>
                $5
              </Button>
              <Button type="button" variant={selectedAmount === '10' ? 'default' : 'outline'} onClick={() => setSelectedAmount('10')}>
                $10
              </Button>
              <Button type="button" variant={selectedAmount === '20' ? 'default' : 'outline'} onClick={() => setSelectedAmount('20')}>
                $20
              </Button>
            </div>

            <div className="space-y-2">
              <label htmlFor="custom-tip-amount" className="text-sm font-medium">
                Custom amount (USD)
              </label>
              <Input
                id="custom-tip-amount"
                inputMode="decimal"
                placeholder="5.00"
                value={selectedAmount}
                onChange={(e) => setSelectedAmount(e.target.value)}
              />
            </div>

            <div className="text-sm text-muted-foreground">
              Venmo username: <span className="font-medium text-foreground">@Brian-Gilan</span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button asChild disabled={!normalizedAmount}>
                <a href={venmoAppUrl}>
                  Open Venmo App
                </a>
              </Button>
              <Button asChild variant="outline" disabled={!normalizedAmount}>
                <a href={venmoWebUrl} target="_blank" rel="noopener noreferrer">
                  Pay on Venmo Web
                </a>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
};

export default GlobalHeader;
