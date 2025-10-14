import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';

interface PendingBattle {
  battleId: string;
  timestamp: number;
  viewed: boolean;
}

export const useBattlePresence = () => {
  const { user } = useAuth();
  const [pendingBattles, setPendingBattles] = useState<PendingBattle[]>([]);
  const [isVisible, setIsVisible] = useState(true);

  // Track tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === 'visible');
    };

    const handleFocus = () => setIsVisible(true);
    const handleBlur = () => setIsVisible(false);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Load pending battles from localStorage
  useEffect(() => {
    if (!user) return;

    const stored = localStorage.getItem(`pending-battles-${user.id}`);
    if (stored) {
      try {
        const battles = JSON.parse(stored);
        setPendingBattles(battles.filter((b: PendingBattle) => !b.viewed));
      } catch (e) {
        console.error('Failed to parse pending battles:', e);
      }
    }
  }, [user]);

  // Save pending battles to localStorage
  const savePendingBattles = useCallback((battles: PendingBattle[]) => {
    if (!user) return;
    localStorage.setItem(`pending-battles-${user.id}`, JSON.stringify(battles));
    setPendingBattles(battles);
  }, [user]);

  // Add a battle to pending list
  const addPendingBattle = useCallback((battleId: string) => {
    const newBattle: PendingBattle = {
      battleId,
      timestamp: Date.now(),
      viewed: false,
    };
    savePendingBattles([...pendingBattles, newBattle]);
  }, [pendingBattles, savePendingBattles]);

  // Mark a battle as viewed
  const markBattleViewed = useCallback((battleId: string) => {
    const updated = pendingBattles.map(b =>
      b.battleId === battleId ? { ...b, viewed: true } : b
    );
    savePendingBattles(updated);
  }, [pendingBattles, savePendingBattles]);

  // Get unviewed battles
  const getUnviewedBattles = useCallback(() => {
    return pendingBattles.filter(b => !b.viewed);
  }, [pendingBattles]);

  // Clear all viewed battles
  const clearViewedBattles = useCallback(() => {
    const unviewed = pendingBattles.filter(b => !b.viewed);
    savePendingBattles(unviewed);
  }, [pendingBattles, savePendingBattles]);

  return {
    isVisible,
    pendingBattles,
    addPendingBattle,
    markBattleViewed,
    getUnviewedBattles,
    clearViewedBattles,
  };
};
