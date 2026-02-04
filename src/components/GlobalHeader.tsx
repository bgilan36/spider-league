import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const GlobalHeader: React.FC = () => {
  const location = useLocation();
  
  // Don't show on home page
  if (location.pathname === '/') {
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
      '/battle-mode': 'Battle Mode',
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
          
          {/* Right section - Home button */}
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
    </header>
  );
};

export default GlobalHeader;
