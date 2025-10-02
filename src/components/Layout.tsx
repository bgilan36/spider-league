import React from 'react';
import OnlineUsersBar from '@/components/OnlineUsersBar';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <>
      <OnlineUsersBar />
      {children}
    </>
  );
};

export default Layout;
