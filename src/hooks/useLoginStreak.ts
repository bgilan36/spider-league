import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/auth/AuthProvider';

interface LoginStreak {
  currentStreak: number;
  longestStreak: number;
  lastLoginDate: string;
  streakPowerBonus: number;
  isNewDay: boolean;
}

export const useLoginStreak = () => {
  const { user } = useAuth();
  const [streak, setStreak] = useState<LoginStreak | null>(null);
  const [loading, setLoading] = useState(true);
  const [justUpdated, setJustUpdated] = useState(false);

  const calculateStreakBonus = (days: number): number => {
    // Bonus power: 1% per day, up to 10% max
    return Math.min(days, 10);
  };

  const checkAndUpdateStreak = useCallback(async () => {
    if (!user) {
      setStreak(null);
      setLoading(false);
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Fetch existing streak
      const { data: existingStreak, error: fetchError } = await supabase
        .from('login_streaks')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!existingStreak) {
        // First login - create streak
        const { data: newStreak, error: insertError } = await supabase
          .from('login_streaks')
          .insert({
            user_id: user.id,
            current_streak: 1,
            longest_streak: 1,
            last_login_date: today,
            streak_power_bonus: calculateStreakBonus(1)
          })
          .select()
          .single();

        if (insertError) throw insertError;

        setStreak({
          currentStreak: 1,
          longestStreak: 1,
          lastLoginDate: today,
          streakPowerBonus: calculateStreakBonus(1),
          isNewDay: true
        });
        setJustUpdated(true);
      } else {
        const lastLogin = new Date(existingStreak.last_login_date);
        const todayDate = new Date(today);
        const diffTime = todayDate.getTime() - lastLogin.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
          // Same day login - no update needed
          setStreak({
            currentStreak: existingStreak.current_streak,
            longestStreak: existingStreak.longest_streak,
            lastLoginDate: existingStreak.last_login_date,
            streakPowerBonus: existingStreak.streak_power_bonus,
            isNewDay: false
          });
        } else if (diffDays === 1) {
          // Consecutive day - increment streak
          const newCurrentStreak = existingStreak.current_streak + 1;
          const newLongestStreak = Math.max(newCurrentStreak, existingStreak.longest_streak);
          const bonus = calculateStreakBonus(newCurrentStreak);

          const { error: updateError } = await supabase
            .from('login_streaks')
            .update({
              current_streak: newCurrentStreak,
              longest_streak: newLongestStreak,
              last_login_date: today,
              streak_power_bonus: bonus
            })
            .eq('user_id', user.id);

          if (updateError) throw updateError;

          setStreak({
            currentStreak: newCurrentStreak,
            longestStreak: newLongestStreak,
            lastLoginDate: today,
            streakPowerBonus: bonus,
            isNewDay: true
          });
          setJustUpdated(true);
        } else {
          // Streak broken - reset to 1
          const { error: updateError } = await supabase
            .from('login_streaks')
            .update({
              current_streak: 1,
              last_login_date: today,
              streak_power_bonus: calculateStreakBonus(1)
            })
            .eq('user_id', user.id);

          if (updateError) throw updateError;

          setStreak({
            currentStreak: 1,
            longestStreak: existingStreak.longest_streak,
            lastLoginDate: today,
            streakPowerBonus: calculateStreakBonus(1),
            isNewDay: true
          });
          setJustUpdated(true);
        }
      }
    } catch (error) {
      console.error('Error updating login streak:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    checkAndUpdateStreak();
  }, [checkAndUpdateStreak]);

  // Reset justUpdated after 5 seconds (for animation purposes)
  useEffect(() => {
    if (justUpdated) {
      const timer = setTimeout(() => setJustUpdated(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [justUpdated]);

  return { streak, loading, justUpdated };
};
