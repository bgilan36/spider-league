import React from 'react';
import BattleResultsNotification from '@/components/BattleResultsNotification';
import GlobalHeader from '@/components/GlobalHeader';
import FloatingHomeButton from '@/components/FloatingHomeButton';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to main content
      </a>
      <BattleResultsNotification />
      <GlobalHeader />
      <main id="main-content">{children}</main>
      <FloatingHomeButton />
    </>
  );
};

export default Layout;
