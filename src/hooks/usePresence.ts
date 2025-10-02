import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/auth/AuthProvider';

interface OnlineUser {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  last_seen: string;
}

const HEARTBEAT_INTERVAL = 20000; // 20 seconds
const STALE_THRESHOLD = 45000; // 45 seconds

export const usePresence = () => {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Update our presence
  const updatePresence = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_presence')
        .upsert({
          user_id: user.id,
          last_seen: new Date().toISOString(),
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  };

  // Fetch current online users
  const fetchOnlineUsers = async () => {
    try {
      const staleTime = new Date(Date.now() - STALE_THRESHOLD).toISOString();
      
      const { data: presenceData, error: presenceError } = await supabase
        .from('user_presence')
        .select('user_id, last_seen')
        .gte('last_seen', staleTime);

      if (presenceError) throw presenceError;

      if (!presenceData || presenceData.length === 0) {
        setOnlineUsers([]);
        setLoading(false);
        return;
      }

      // Fetch profile data for online users
      const userIds = presenceData.map(p => p.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      const usersWithProfiles = presenceData.map(presence => {
        const profile = profiles?.find(p => p.id === presence.user_id);
        return {
          user_id: presence.user_id,
          display_name: profile?.display_name || null,
          avatar_url: profile?.avatar_url || null,
          last_seen: presence.last_seen,
        };
      });

      setOnlineUsers(usersWithProfiles);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching online users:', error);
      setLoading(false);
    }
  };

  // Remove our presence on unmount
  const removePresence = async () => {
    if (!user) return;

    try {
      await supabase
        .from('user_presence')
        .delete()
        .eq('user_id', user.id);
    } catch (error) {
      console.error('Error removing presence:', error);
    }
  };

  useEffect(() => {
    if (!user) {
      setOnlineUsers([]);
      setLoading(false);
      return;
    }

    // Initial presence update and fetch
    updatePresence();
    fetchOnlineUsers();

    // Set up heartbeat interval
    const heartbeatInterval = setInterval(updatePresence, HEARTBEAT_INTERVAL);

    // Subscribe to realtime presence changes
    const channel = supabase
      .channel('presence-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
        },
        () => {
          // Refetch online users when presence changes
          fetchOnlineUsers();
        }
      )
      .subscribe();

    // Cleanup on unmount
    return () => {
      clearInterval(heartbeatInterval);
      supabase.removeChannel(channel);
      removePresence();
    };
  }, [user]);

  return { onlineUsers, loading };
};
