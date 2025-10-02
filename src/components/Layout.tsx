import React from 'react';
import OnlineUsersBar from '@/components/OnlineUsersBar';
import NotificationListener from '@/components/NotificationListener';
import NotificationsDropdown from '@/components/NotificationsDropdown';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <>
      <NotificationListener />
      <div className="fixed top-4 right-4 z-50">
        <NotificationsDropdown />
      </div>
      <OnlineUsersBar />
      {children}
    </>
  );
};

export default Layout;
