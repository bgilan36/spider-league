import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { usePresence } from '@/hooks/usePresence';
import { useAuth } from '@/auth/AuthProvider';
import UserSnapshotModal from '@/components/UserSnapshotModal';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const OnlineUsersBar: React.FC = () => {
  const { onlineUsers, loading } = usePresence();
  const { user } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { toast } = useToast();

  // Filter out current user from the list
  const otherUsers = onlineUsers.filter(u => u.user_id !== user?.id);

  const handleInvite = async () => {
    const url = window.location.origin;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Spider League',
          text: 'Join me on Spider League - Share spiders you find in the wild for friendly battles!',
          url: url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast({
          title: "Link copied!",
          description: "Share this link to invite friends to Spider League",
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  if (!user) return null;

  if (loading) {
    return (
      <div className="w-full mb-6">
        <div className="container mx-auto px-4">
          <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-2xl p-4 shadow-sm border border-primary/10">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Online:
              </span>
              <div className="flex gap-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-10 rounded-full" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (otherUsers.length === 0) {
    return (
      <div className="w-full mb-6">
        <div className="container mx-auto px-4">
          <div className="bg-gradient-to-r from-muted/30 via-muted/50 to-muted/30 rounded-2xl p-4 shadow-sm border border-border/50">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />
                Online:
              </span>
              <span className="text-sm text-muted-foreground">No other players online</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full mb-6">
        <div className="container mx-auto px-4">
          <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-2xl p-4 shadow-sm border border-primary/10 hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Online: <span className="text-primary font-bold">{otherUsers.length}</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleInvite}
                className="h-8 gap-2 text-xs"
              >
                <UserPlus className="h-4 w-4" />
                Invite
              </Button>
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-2">
                  {otherUsers.map((onlineUser) => (
                    <TooltipProvider key={onlineUser.user_id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setSelectedUserId(onlineUser.user_id)}
                            className="relative group flex-shrink-0 transition-all duration-200 hover:scale-110"
                          >
                            <Avatar className="h-10 w-10 ring-2 ring-primary/20 group-hover:ring-primary/60 transition-all duration-200">
                              <AvatarImage 
                                src={onlineUser.avatar_url || undefined} 
                                alt={onlineUser.display_name || 'User'} 
                              />
                              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                {(onlineUser.display_name || 'U').charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-background ring-1 ring-green-400/50" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-card/95 backdrop-blur-sm">
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
