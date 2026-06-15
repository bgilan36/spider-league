import { useState, useRef, useCallback, useEffect } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  disabled?: boolean;
}

// Trigger haptic feedback if supported
const triggerHaptic = (duration: number = 10) => {
  if ('vibrate' in navigator) {
    navigator.vibrate(duration);
  }
};

export const usePullToRefresh = ({
  onRefresh,
  threshold = 120,
  disabled = false,
}: UsePullToRefreshOptions) => {
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasTriggeredHaptic = useRef(false);
  const activated = useRef(false);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled || isRefreshing) return;
      
      // Only start pull if at top of page
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
        setIsPulling(true);
        hasTriggeredHaptic.current = false;
        activated.current = false;
      }
    },
    [disabled, isRefreshing]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isPulling || disabled || isRefreshing) return;
      
      const currentY = e.touches[0].clientY;
      const diff = currentY - startY.current;

      // Require a clear, intentional downward drag before engaging pull-to-refresh.
      // This prevents accidental triggers during normal upward scrolling at the top.
      const ACTIVATION_DIFF = 60;
      if (!activated.current) {
        if (diff > ACTIVATION_DIFF && window.scrollY === 0) {
          activated.current = true;
          // Re-baseline so distance starts from activation point
          startY.current = currentY;
        } else {
          return;
        }
      }

      if (diff > 0 && window.scrollY === 0) {
        // Apply resistance to make it feel more natural
        const resistance = 0.35;
        const newDistance = Math.min(diff * resistance, threshold * 1.5);
        setPullDistance(newDistance);
        
        // Trigger haptic when crossing threshold
        if (newDistance >= threshold && !hasTriggeredHaptic.current) {
          triggerHaptic(15);
          hasTriggeredHaptic.current = true;
        } else if (newDistance < threshold) {
          hasTriggeredHaptic.current = false;
        }
        
        // Prevent default scrolling once we've meaningfully engaged
        if (newDistance > 20 && e.cancelable) {
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
        triggerHaptic(20); // Success haptic
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
