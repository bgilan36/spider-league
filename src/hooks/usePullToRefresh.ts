import { useState, useRef, useCallback, useEffect } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  disabled?: boolean;
}

export const usePullToRefresh = ({
  onRefresh,
  threshold = 80,
  disabled = false,
}: UsePullToRefreshOptions) => {
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled || isRefreshing) return;
      
      // Only start pull if at top of page
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
        setIsPulling(true);
      }
    },
    [disabled, isRefreshing]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isPulling || disabled || isRefreshing) return;
      
      const currentY = e.touches[0].clientY;
      const diff = currentY - startY.current;
      
      if (diff > 0 && window.scrollY === 0) {
        // Apply resistance to make it feel more natural
        const resistance = 0.4;
        setPullDistance(Math.min(diff * resistance, threshold * 1.5));
        
        // Prevent default scrolling when pulling down
        if (diff > 10) {
          e.preventDefault();
        }
      }
    },
    [isPulling, disabled, isRefreshing, threshold]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling || disabled) return;
    
    setIsPulling(false);
    
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold); // Keep indicator visible during refresh
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [isPulling, pullDistance, threshold, isRefreshing, onRefresh, disabled]);

  useEffect(() => {
    const container = containerRef.current || document;
    
    container.addEventListener('touchstart', handleTouchStart as EventListener, { passive: true });
    container.addEventListener('touchmove', handleTouchMove as EventListener, { passive: false });
    container.addEventListener('touchend', handleTouchEnd as EventListener, { passive: true });
    
    return () => {
      container.removeEventListener('touchstart', handleTouchStart as EventListener);
      container.removeEventListener('touchmove', handleTouchMove as EventListener);
      container.removeEventListener('touchend', handleTouchEnd as EventListener);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const progress = Math.min(pullDistance / threshold, 1);
  const shouldTrigger = pullDistance >= threshold;

  return {
    containerRef,
    isPulling,
    isRefreshing,
    pullDistance,
    progress,
    shouldTrigger,
  };
};
