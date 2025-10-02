import { useState, useEffect } from 'react';
import { Bell, MessageSquare, Zap, Trophy, Skull, Swords, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/auth/AuthProvider';
import { formatDistanceToNow } from 'date-fns';
import ClickableUsername from './ClickableUsername';

interface Notification {
  id: string;
  type: 'wall_post' | 'bite' | 'battle_win' | 'battle_loss' | 'challenge';
  message: string;
  created_at: string;
  from_user_id?: string;
  from_user_name?: string;
  read: boolean;
  challenge_id?: string;
}

const NotificationsDropdown = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      setupRealtimeSubscriptions();
    }
  }, [user]);

  const setupRealtimeSubscriptions = () => {
    if (!user) return;

    // Subscribe to wall posts on user's profile
    const wallPostsChannel = supabase
      .channel('wall-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'profile_wall_posts',
          filter: `profile_user_id=eq.${user.id}`
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    // Subscribe to bites/pokes
    const bitesChannel = supabase
      .channel('bite-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pokes',
          filter: `poked_user_id=eq.${user.id}`
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    // Subscribe to battles
    const battlesChannel = supabase
      .channel('battle-notifications')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'battles',
          filter: `is_active=eq.false`
        },
        (payload) => {
          const battle = payload.new;
          const isParticipant = 
            (battle.team_a as any)?.userId === user.id || 
            (battle.team_b as any)?.userId === user.id;
          
          if (isParticipant) {
            fetchNotifications();
          }
        }
      )
      .subscribe();

    // Subscribe to challenges
    const challengesChannel = supabase
      .channel('challenge-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'battle_challenges',
          filter: `status=eq.OPEN`
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(wallPostsChannel);
      supabase.removeChannel(bitesChannel);
      supabase.removeChannel(battlesChannel);
      supabase.removeChannel(challengesChannel);
    };
  };

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      const notifications: Notification[] = [];

      // Fetch recent wall posts (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data: wallPosts } = await supabase
        .from('profile_wall_posts')
        .select('id, poster_user_id, message, created_at')
        .eq('profile_user_id', user.id)
        .gte('created_at', oneDayAgo)
        .order('created_at', { ascending: false })
        .limit(10);

      if (wallPosts) {
        const posterIds = [...new Set(wallPosts.map(p => p.poster_user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', posterIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p.display_name]) || []);

        wallPosts.forEach(post => {
          notifications.push({
            id: `wall-${post.id}`,
            type: 'wall_post',
            message: post.message.substring(0, 100) + (post.message.length > 100 ? '...' : ''),
            created_at: post.created_at,
            from_user_id: post.poster_user_id,
            from_user_name: profileMap.get(post.poster_user_id) || 'Someone',
            read: false
          });
        });
      }

      // Fetch recent bites (last 24 hours)
      const { data: bites } = await supabase
        .from('pokes')
        .select('id, poker_user_id, created_at')
        .eq('poked_user_id', user.id)
        .gte('created_at', oneDayAgo)
        .order('created_at', { ascending: false })
        .limit(10);

      if (bites) {
        const biterIds = [...new Set(bites.map(b => b.poker_user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', biterIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p.display_name]) || []);

        bites.forEach(bite => {
          notifications.push({
            id: `bite-${bite.id}`,
            type: 'bite',
            message: 'bit you! 🦷',
            created_at: bite.created_at,
            from_user_id: bite.poker_user_id,
            from_user_name: profileMap.get(bite.poker_user_id) || 'Someone',
            read: false
          });
        });
      }

      // Fetch recent battle results (last 24 hours)
      const { data: battles } = await supabase
        .from('battles')
        .select('id, winner, team_a, team_b, created_at')
        .eq('is_active', false)
        .gte('created_at', oneDayAgo)
        .order('created_at', { ascending: false })
        .limit(10);

      if (battles) {
        battles.forEach(battle => {
          const isTeamA = (battle.team_a as any)?.userId === user.id;
          const isTeamB = (battle.team_b as any)?.userId === user.id;
          
          if (isTeamA || isTeamB) {
            const wonBattle = 
              (battle.winner === 'A' && isTeamA) || 
              (battle.winner === 'B' && isTeamB);
            
            const opponentSpider = isTeamA 
              ? (battle.team_b as any)?.spider?.nickname 
              : (battle.team_a as any)?.spider?.nickname;
            
            notifications.push({
              id: `battle-${battle.id}`,
              type: wonBattle ? 'battle_win' : 'battle_loss',
              message: wonBattle 
                ? `Your spider won against ${opponentSpider}!`
                : `Your spider lost to ${opponentSpider}`,
              created_at: battle.created_at,
              read: false
            });
          }
        });
      }

      // Fetch recent challenges (last 24 hours) - challenges directed at this user
      const { data: challenges } = await supabase
        .from('battle_challenges')
        .select('id, challenger_id, created_at, challenge_message, challenger_spider_id')
        .eq('status', 'OPEN')
        .gte('created_at', oneDayAgo)
        .neq('challenger_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (challenges) {
        const challengerIds = [...new Set(challenges.map(c => c.challenger_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', challengerIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p.display_name]) || []);

        challenges.forEach(challenge => {
          notifications.push({
            id: `challenge-${challenge.id}`,
            type: 'challenge',
            message: challenge.challenge_message || 'challenged you to a battle!',
            created_at: challenge.created_at,
            from_user_id: challenge.challenger_id,
            from_user_name: profileMap.get(challenge.challenger_id) || 'Someone',
            challenge_id: challenge.id,
            read: false
          });
        });
      }

      // Sort by created_at
      notifications.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setNotifications(notifications.slice(0, 20));
      setUnreadCount(notifications.length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'wall_post':
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case 'bite':
        return <Zap className="h-4 w-4 text-orange-500" />;
      case 'battle_win':
        return <Trophy className="h-4 w-4 text-yellow-500" />;
      case 'battle_loss':
        return <Skull className="h-4 w-4 text-red-500" />;
      case 'challenge':
        return <Swords className="h-4 w-4 text-purple-500" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  if (!user) return null;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 bg-card/95 backdrop-blur-sm border-border/50">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Badge variant="secondary">{unreadCount} new</Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <ScrollArea className="h-96">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        {notification.from_user_id ? (
                          <>
                            <ClickableUsername
                              userId={notification.from_user_id}
                              displayName={notification.from_user_name}
                              variant="link"
                              size="sm"
                              className="font-semibold p-0 h-auto"
                            />{' '}
                            {notification.message}
                          </>
                        ) : (
                          notification.message
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), { 
                          addSuffix: true 
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationsDropdown;
