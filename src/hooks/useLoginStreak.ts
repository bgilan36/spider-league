import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/auth/AuthProvider';

interface LoginStreak {
  currentStreak: number;
  longestStreak: number;
  lastLoginDate: string;
  streakPowerBonus: number;
  isNewDay: boolean;
  dailyBonusXp: number;
}

export const useLoginStreak = () => {
  const { user } = useAuth();
  const [streak, setStreak] = useState<LoginStreak | null>(null);
  const [loading, setLoading] = useState(true);
  const [justUpdated, setJustUpdated] = useState(false);

  const calculateStreakBonus = (days: number): number => {
    return Math.min(days, 10);
  };

  const calculateDailyXp = (streakDays: number): number => {
    // 5 XP base + 1 XP per streak day, up to 15 XP max
    return Math.min(5 + streakDays, 15);
  };

  const awardDailyXp = useCallback(async (xpAmount: number) => {
    if (!user) return;
    await supabase
      .from('profiles')
      .update({ xp: undefined }) // We'll use RPC-style increment instead
      .eq('id', user.id);
    
    // Use raw SQL via rpc isn't available, so fetch current XP and add
    const { data: profile } = await supabase
      .from('profiles')
      .select('xp')
      .eq('id', user.id)
      .single();
    
    if (profile) {
      await supabase
        .from('profiles')
        .update({ xp: profile.xp + xpAmount })
        .eq('id', user.id);
    }
  }, [user]);

  const checkAndUpdateStreak = useCallback(async () => {
    if (!user) {
      setStreak(null);
      setLoading(false);
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: existingStreak, error: fetchError } = await supabase
        .from('login_streaks')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!existingStreak) {
        const dailyXp = calculateDailyXp(1);
        const { error: insertError } = await supabase
          .from('login_streaks')
          .insert({
            user_id: user.id,
            current_streak: 1,
            longest_streak: 1,
            last_login_date: today,
            streak_power_bonus: calculateStreakBonus(1)
          });

        if (insertError) throw insertError;

        await awardDailyXp(dailyXp);

        setStreak({
          currentStreak: 1,
          longestStreak: 1,
          lastLoginDate: today,
          streakPowerBonus: calculateStreakBonus(1),
          isNewDay: true,
          dailyBonusXp: dailyXp,
        });
        setJustUpdated(true);
      } else {
        const lastLogin = new Date(existingStreak.last_login_date);
        const todayDate = new Date(today);
        const diffTime = todayDate.getTime() - lastLogin.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
          setStreak({
            currentStreak: existingStreak.current_streak,
            longestStreak: existingStreak.longest_streak,
            lastLoginDate: existingStreak.last_login_date,
            streakPowerBonus: existingStreak.streak_power_bonus,
            isNewDay: false,
            dailyBonusXp: 0,
          });
        } else if (diffDays === 1) {
          const newCurrentStreak = existingStreak.current_streak + 1;
          const newLongestStreak = Math.max(newCurrentStreak, existingStreak.longest_streak);
          const bonus = calculateStreakBonus(newCurrentStreak);
          const dailyXp = calculateDailyXp(newCurrentStreak);

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

          await awardDailyXp(dailyXp);

          setStreak({
            currentStreak: newCurrentStreak,
            longestStreak: newLongestStreak,
            lastLoginDate: today,
            streakPowerBonus: bonus,
            isNewDay: true,
            dailyBonusXp: dailyXp,
          });
          setJustUpdated(true);
        } else {
          const dailyXp = calculateDailyXp(1);
          const { error: updateError } = await supabase
            .from('login_streaks')
            .update({
              current_streak: 1,
              last_login_date: today,
              streak_power_bonus: calculateStreakBonus(1)
            })
            .eq('user_id', user.id);

          if (updateError) throw updateError;

          await awardDailyXp(dailyXp);

          setStreak({
            currentStreak: 1,
            longestStreak: existingStreak.longest_streak,
            lastLoginDate: today,
            streakPowerBonus: calculateStreakBonus(1),
            isNewDay: true,
            dailyBonusXp: dailyXp,
          });
          setJustUpdated(true);
        }
      }
    } catch (error) {
      console.error('Error updating login streak:', error);
    } finally {
      setLoading(false);
    }
  }, [user, awardDailyXp]);

  useEffect(() => {
    checkAndUpdateStreak();
  }, [checkAndUpdateStreak]);

  useEffect(() => {
    if (justUpdated) {
      const timer = setTimeout(() => setJustUpdated(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [justUpdated]);

  return { streak, loading, justUpdated };
};
