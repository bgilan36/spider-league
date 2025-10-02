import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { usePresence } from '@/hooks/usePresence';
import { useAuth } from '@/auth/AuthProvider';
import UserSnapshotModal from '@/components/UserSnapshotModal';
import { Skeleton } from '@/components/ui/skeleton';

const OnlineUsersBar: React.FC = () => {
  const { onlineUsers, loading } = usePresence();
  const { user } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Filter out current user from the list
  const otherUsers = onlineUsers.filter(u => u.user_id !== user?.id);

  if (!user) return null;

  if (loading) {
    return (
      <div className="w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Online:</span>
            <div className="flex gap-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-10 rounded-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (otherUsers.length === 0) {
    return (
      <div className="w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Online:</span>
            <span className="text-sm text-muted-foreground/70">No other players online</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">
              Online: <span className="text-primary">{otherUsers.length}</span>
            </span>
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex gap-2">
                {otherUsers.map((onlineUser) => (
                  <TooltipProvider key={onlineUser.user_id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setSelectedUserId(onlineUser.user_id)}
                          className="relative group flex-shrink-0 transition-transform hover:scale-110"
                        >
                          <Avatar className="h-10 w-10 border-2 border-primary/20 group-hover:border-primary/60 transition-colors">
                            <AvatarImage 
                              src={onlineUser.avatar_url || undefined} 
                              alt={onlineUser.display_name || 'User'} 
                            />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {(onlineUser.display_name || 'U').charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">{onlineUser.display_name || 'Unknown Player'}</p>
                        <p className="text-xs text-muted-foreground">Click to view profile</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        </div>
      </div>

      <UserSnapshotModal
        isOpen={selectedUserId !== null}
        onClose={() => setSelectedUserId(null)}
        userId={selectedUserId || ''}
      />
    </>
  );
};

export default OnlineUsersBar;
