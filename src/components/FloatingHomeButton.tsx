import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const FloatingHomeButton: React.FC = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  
  // Only show on mobile and not on home page
  if (!isMobile || location.pathname === '/') {
    return null;
  }

  return (
    <Link
      to="/"
      className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 active:scale-95 transition-transform"
      aria-label="Go to Home"
    >
      <Home className="h-6 w-6" />
    </Link>
  );
};

export default FloatingHomeButton;
