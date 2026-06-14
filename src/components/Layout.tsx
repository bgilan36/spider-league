import React from 'react';
import BattleResultsNotification from '@/components/BattleResultsNotification';
import GlobalHeader from '@/components/GlobalHeader';
import AppTabs from '@/components/nav/AppTabs';
import { useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

const HIDDEN_ROUTES = ['/auth', '/admin'];

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { pathname } = useLocation();
  const hideNav = HIDDEN_ROUTES.some((r) => pathname.startsWith(r));
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
      {!hideNav && <AppTabs pathname={pathname} />}
      <main id="main-content" className={hideNav ? '' : 'pb-20 md:pb-0'}>{children}</main>
    </>
  );
};

export default Layout;
