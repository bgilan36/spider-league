import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import UserSnapshotModal from '@/components/UserSnapshotModal';

interface ClickableUsernameProps {
  userId: string;
  displayName: string | null;
  className?: string;
  variant?: "link" | "ghost" | "outline" | "default" | "destructive" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
}

const ClickableUsername: React.FC<ClickableUsernameProps> = ({
  userId,
  displayName,
  className = "",
  variant = "link",
  size = "sm"
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsModalOpen(true);
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        className={`p-0 h-auto font-medium hover:underline ${className}`}
      >
        {displayName || 'Unknown Player'}
      </Button>
      
      <UserSnapshotModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        userId={userId}
      />
    </>
  );
};

export default ClickableUsername;