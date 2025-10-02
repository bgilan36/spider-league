import React from 'react';
import OnlineUsersBar from '@/components/OnlineUsersBar';
import NotificationListener from '@/components/NotificationListener';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <>
      <NotificationListener />
      {children}
    </>
  );
};

export default Layout;
