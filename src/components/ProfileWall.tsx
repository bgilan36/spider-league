import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/auth/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageSquare, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import ClickableUsername from './ClickableUsername';
import { z } from 'zod';

interface ProfileWallProps {
  profileUserId: string;
  profileDisplayName: string;
}

interface WallPost {
  id: string;
  profile_user_id: string;
  poster_user_id: string;
  message: string;
  created_at: string;
  poster_profile?: {
    display_name: string;
    avatar_url: string | null;
  };
}

const wallPostSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(1000, 'Message must be less than 1000 characters')
});

const ProfileWall = ({ profileUserId, profileDisplayName }: ProfileWallProps) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<WallPost[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ message?: string }>({});

  const isOwnProfile = user?.id === profileUserId;

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('profile_wall_posts')
        .select('*')
        .eq('profile_user_id', profileUserId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch poster profiles separately
      if (data && data.length > 0) {
        const posterIds = [...new Set(data.map(p => p.poster_user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', posterIds);

        const profilesMap = new Map(
          profiles?.map(p => [p.id, { display_name: p.display_name || 'Unknown', avatar_url: p.avatar_url }]) || []
        );

        const postsWithProfiles = data.map(post => ({
          ...post,
          poster_profile: profilesMap.get(post.poster_user_id) || { display_name: 'Unknown', avatar_url: null }
        }));

        setPosts(postsWithProfiles);
      } else {
        setPosts([]);
      }
    } catch (error: any) {
      console.error('Error fetching wall posts:', error);
      toast.error('Failed to load wall posts');
    } finally {
      setLoading(false);
    }
  };

  const handlePostMessage = async () => {
    if (!user) {
      toast.error('You must be logged in to post');
      return;
    }

    if (user.id === profileUserId) {
      toast.error('You cannot post on your own wall');
      return;
    }

    // Validate input
    const validation = wallPostSchema.safeParse({ message: newMessage });
    if (!validation.success) {
      setErrors({ message: validation.error.errors[0]?.message });
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('profile_wall_posts')
        .insert({
          profile_user_id: profileUserId,
          poster_user_id: user.id,
          message: validation.data.message
        });

      if (error) throw error;

      toast.success('Message posted!');
      setNewMessage('');
      fetchPosts();
    } catch (error: any) {
      console.error('Error posting message:', error);
      toast.error(error.message || 'Failed to post message');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      const { error } = await supabase
        .from('profile_wall_posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      toast.success('Post deleted');
      setPosts(posts.filter(p => p.id !== postId));
    } catch (error: any) {
      console.error('Error deleting post:', error);
      toast.error('Failed to delete post');
    }
  };

  useEffect(() => {
    fetchPosts();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`wall-posts-${profileUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profile_wall_posts',
          filter: `profile_user_id=eq.${profileUserId}`
        },
        () => {
          fetchPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileUserId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          Profile Wall
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Post Form - Only show for other users' profiles */}
        {user && !isOwnProfile && (
          <div className="space-y-2">
            <Textarea
              placeholder={`Leave a message on ${profileDisplayName}'s wall...`}
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                setErrors({});
              }}
              className={errors.message ? 'border-destructive' : ''}
              maxLength={1000}
              rows={3}
            />
            {errors.message && (
              <p className="text-sm text-destructive">{errors.message}</p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {newMessage.length}/1000
              </span>
              <Button
                onClick={handlePostMessage}
                disabled={submitting || !newMessage.trim()}
                size="sm"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Posting...
                  </>
                ) : (
                  'Post Message'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Posts List */}
        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No messages yet</p>
            {!isOwnProfile && user && (
              <p className="text-sm mt-1">Be the first to leave a message!</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => {
              const canDelete = user && (user.id === post.poster_user_id || user.id === profileUserId);
              
              return (
                <div
                  key={post.id}
                  className="p-4 bg-muted/30 rounded-lg border border-border/50"
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      <AvatarImage src={post.poster_profile?.avatar_url || undefined} />
                      <AvatarFallback>
                        {post.poster_profile?.display_name?.[0]?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <ClickableUsername
                            userId={post.poster_user_id}
                            displayName={post.poster_profile?.display_name}
                            variant="link"
                            size="sm"
                            className="font-semibold p-0 h-auto"
                          />
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 flex-shrink-0"
                            onClick={() => handleDeletePost(post.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      
                      <p className="text-sm break-words whitespace-pre-wrap">
                        {post.message}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProfileWall;
