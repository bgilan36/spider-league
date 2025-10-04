import React from 'react';
import OnlineUsersBar from '@/components/OnlineUsersBar';
import NotificationListener from '@/components/NotificationListener';
import BattleResultsNotification from '@/components/BattleResultsNotification';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <>
      <NotificationListener />
      <BattleResultsNotification />
      {children}
    </>
  );
};

export default Layout;
