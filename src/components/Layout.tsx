import React from 'react';
import OnlineUsersBar from '@/components/OnlineUsersBar';
import NotificationListener from '@/components/NotificationListener';
import BattleResultsNotification from '@/components/BattleResultsNotification';
import GlobalHeader from '@/components/GlobalHeader';
import FloatingHomeButton from '@/components/FloatingHomeButton';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <>
      <NotificationListener />
      <BattleResultsNotification />
      <GlobalHeader />
      {children}
      <FloatingHomeButton />
    </>
  );
};

export default Layout;
