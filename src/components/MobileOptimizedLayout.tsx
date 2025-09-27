import React from 'react';
import { cn } from '@/lib/utils';

interface MobileOptimizedLayoutProps {
  children: React.ReactNode;
  className?: string;
  enableSafeArea?: boolean;
}

export const MobileOptimizedLayout: React.FC<MobileOptimizedLayoutProps> = ({
  children,
  className,
  enableSafeArea = true
}) => {
  return (
    <div 
      className={cn(
        "min-h-screen bg-background overflow-x-hidden",
        enableSafeArea && "pb-safe",
        className
      )}
    >
      {children}
    </div>
  );
};

interface MobileContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const MobileContainer: React.FC<MobileContainerProps> = ({
  children,
  className
}) => {
  return (
    <main className={cn(
      "container mx-auto px-4 sm:px-6 py-4 sm:py-8",
      className
    )}>
      {children}
    </main>
  );
};

interface MobileGridProps {
  children: React.ReactNode;
  className?: string;
  cols?: "1" | "2" | "3" | "4";
}

export const MobileGrid: React.FC<MobileGridProps> = ({
  children,
  className,
  cols = "3"
}) => {
  const gridClasses = {
    "1": "grid-cols-1",
    "2": "grid-cols-1 sm:grid-cols-2",
    "3": "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    "4": "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
  };

  return (
    <div className={cn(
      "grid gap-4 sm:gap-6",
      gridClasses[cols],
      className
    )}>
      {children}
    </div>
  );
};