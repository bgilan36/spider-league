import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  color: string;
}

export const useBadgeSystem = () => {
  const { toast } = useToast();
  const [newBadge, setNewBadge] = useState<Badge | null>(null);
  const [showBadgeNotification, setShowBadgeNotification] = useState(false);

  const checkAndAwardBadges = useCallback(async (userId: string) => {
    try {
      // Get user's current badges to check for new ones
      const { data: currentBadges, error: currentError } = await supabase
        .from('user_badges')
        .select('badge_id')
        .eq('user_id', userId);

      if (currentError) throw currentError;

      const currentBadgeIds = new Set(currentBadges?.map(ub => ub.badge_id) || []);

      // Award badges using the database function
      const { error: awardError } = await supabase.rpc('award_badges_for_user', {
        user_id_param: userId
      });

      if (awardError) throw awardError;

      // Check for newly awarded badges
      const { data: updatedBadges, error: updatedError } = await supabase
        .from('user_badges')
        .select(`
          badge_id,
          badge:badges(
            id,
            name,
            description,
            icon,
            rarity,
            color
          )
        `)
        .eq('user_id', userId);

      if (updatedError) throw updatedError;

      // Find new badges
      const newBadges = updatedBadges?.filter(ub => !currentBadgeIds.has(ub.badge_id)) || [];

      // Show notification for the first new badge (if any)
      if (newBadges.length > 0) {
        const firstNewBadge = newBadges[0];
        setNewBadge(firstNewBadge.badge as Badge);
        setShowBadgeNotification(true);

        // Show toast for additional badges if there are more than one
        if (newBadges.length > 1) {
          toast({
            title: "Multiple Achievements Unlocked!",
            description: `You've earned ${newBadges.length} new badges! Check your profile to see them all.`
          });
        }
      }

    } catch (error: any) {
      console.error('Error checking badges:', error);
    }
  }, [toast]);

  const dismissBadgeNotification = useCallback(() => {
    setShowBadgeNotification(false);
    setNewBadge(null);
  }, []);

  return {
    newBadge,
    showBadgeNotification,
    checkAndAwardBadges,
    dismissBadgeNotification
  };
};