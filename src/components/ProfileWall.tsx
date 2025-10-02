import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/auth/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  MessageSquare, 
  Trash2, 
  Loader2, 
  Heart, 
  Reply
} from 'lucide-react';
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
  likes_count?: number;
  replies_count?: number;
  spider_reactions_count?: number;
  user_has_liked?: boolean;
  user_has_spider_reacted?: boolean;
}

interface WallReply {
  id: string;
  post_id: string;
  user_id: string;
  message: string;
  created_at: string;
  user_profile?: {
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
  const [replyingToPost, setReplyingToPost] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [replies, setReplies] = useState<{ [key: string]: WallReply[] }>({});
  const [showReplies, setShowReplies] = useState<{ [key: string]: boolean }>({});

  const isOwnProfile = user?.id === profileUserId;

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('profile_wall_posts')
        .select('id, profile_user_id, poster_user_id, message, created_at')
        .eq('profile_user_id', profileUserId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        // Fetch poster profiles
        const posterIds = [...new Set(data.map(p => p.poster_user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', posterIds);

        const profilesMap = new Map(
          profiles?.map(p => [p.id, { display_name: p.display_name || 'Unknown', avatar_url: p.avatar_url }]) || []
        );

        // Fetch like counts
        const postIds = data.map(p => p.id);
        const { data: likesData } = await supabase
          .from('profile_wall_likes')
          .select('post_id, user_id')
          .in('post_id', postIds);

        const likesCountMap = new Map<string, number>();
        const userLikesMap = new Map<string, boolean>();
        likesData?.forEach(like => {
          likesCountMap.set(like.post_id, (likesCountMap.get(like.post_id) || 0) + 1);
          if (user && like.user_id === user.id) {
            userLikesMap.set(like.post_id, true);
          }
        });

        // Fetch spider reactions
        const { data: spiderReactionsData } = await supabase
          .from('profile_wall_spider_reactions')
          .select('post_id, user_id')
          .in('post_id', postIds);

        const spiderReactionsCountMap = new Map<string, number>();
        const userSpiderReactionsMap = new Map<string, boolean>();
        spiderReactionsData?.forEach(reaction => {
          spiderReactionsCountMap.set(reaction.post_id, (spiderReactionsCountMap.get(reaction.post_id) || 0) + 1);
          if (user && reaction.user_id === user.id) {
            userSpiderReactionsMap.set(reaction.post_id, true);
          }
        });

        // Fetch reply counts
        const { data: repliesData } = await supabase
          .from('profile_wall_replies')
          .select('post_id')
          .in('post_id', postIds);

        const repliesCountMap = new Map<string, number>();
        repliesData?.forEach(reply => {
          repliesCountMap.set(reply.post_id, (repliesCountMap.get(reply.post_id) || 0) + 1);
        });

        const postsWithData = data.map(post => ({
          ...post,
          poster_profile: profilesMap.get(post.poster_user_id) || { display_name: 'Unknown', avatar_url: null },
          likes_count: likesCountMap.get(post.id) || 0,
          spider_reactions_count: spiderReactionsCountMap.get(post.id) || 0,
          replies_count: repliesCountMap.get(post.id) || 0,
          user_has_liked: userLikesMap.get(post.id) || false,
          user_has_spider_reacted: userSpiderReactionsMap.get(post.id) || false
        }));

        setPosts(postsWithData);
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

  const fetchReplies = async (postId: string) => {
    try {
      const { data, error } = await supabase
        .from('profile_wall_replies')
        .select('id, post_id, user_id, message, created_at')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(r => r.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', userIds);

        const profilesMap = new Map(
          profiles?.map(p => [p.id, { display_name: p.display_name || 'Unknown', avatar_url: p.avatar_url }]) || []
        );

        const repliesWithProfiles = data.map(reply => ({
          ...reply,
          user_profile: profilesMap.get(reply.user_id) || { display_name: 'Unknown', avatar_url: null }
        }));

        setReplies(prev => ({ ...prev, [postId]: repliesWithProfiles }));
      }
    } catch (error: any) {
      console.error('Error fetching replies:', error);
    }
  };

  const handleLikePost = async (postId: string) => {
    if (!user) {
      toast.error('You must be logged in to like posts');
      return;
    }

    try {
      const post = posts.find(p => p.id === postId);
      if (!post) return;

      if (post.user_has_liked) {
        // Unlike
        const { error } = await supabase
          .from('profile_wall_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Like
        const { error } = await supabase
          .from('profile_wall_likes')
          .insert({
            post_id: postId,
            user_id: user.id
          });

        if (error) throw error;
      }

      fetchPosts();
    } catch (error: any) {
      console.error('Error toggling like:', error);
      toast.error('Failed to update like');
    }
  };

  const handleSpiderReaction = async (postId: string) => {
    if (!user) {
      toast.error('You must be logged in to react');
      return;
    }

    try {
      const post = posts.find(p => p.id === postId);
      if (!post) return;

      if (post.user_has_spider_reacted) {
        // Remove reaction
        const { error } = await supabase
          .from('profile_wall_spider_reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Add reaction
        const { error } = await supabase
          .from('profile_wall_spider_reactions')
          .insert({
            post_id: postId,
            user_id: user.id
          });

        if (error) throw error;
      }

      fetchPosts();
    } catch (error: any) {
      console.error('Error toggling spider reaction:', error);
      toast.error('Failed to update reaction');
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

  const handleReply = async (postId: string) => {
    if (!user || !replyMessage.trim()) return;

    const validation = wallPostSchema.safeParse({ message: replyMessage });
    if (!validation.success) {
      toast.error(validation.error.errors[0]?.message);
      return;
    }

    try {
      const { error } = await supabase
        .from('profile_wall_replies')
        .insert({
          post_id: postId,
          user_id: user.id,
          message: validation.data.message
        });

      if (error) throw error;

      toast.success('Reply posted!');
      setReplyMessage('');
      setReplyingToPost(null);
      fetchPosts();
      fetchReplies(postId);
    } catch (error: any) {
      console.error('Error posting reply:', error);
      toast.error('Failed to post reply');
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

  const toggleReplies = async (postId: string) => {
    if (!showReplies[postId]) {
      await fetchReplies(postId);
    }
    setShowReplies(prev => ({ ...prev, [postId]: !prev[postId] }));
  };

  useEffect(() => {
    fetchPosts();

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
  }, [profileUserId, user]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          Profile Wall
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
            
            <div className="flex items-center justify-between gap-2">
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
                  className="p-4 bg-gradient-to-r from-muted/30 to-muted/10 rounded-2xl border border-border/30 hover:border-primary/20 transition-all"
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
                      
                      <p className="text-sm break-words whitespace-pre-wrap mb-2">
                        {post.message}
                      </p>

                      {/* Actions */}
                      <div className="flex items-center gap-4 mt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-2"
                          onClick={() => handleLikePost(post.id)}
                        >
                          <Heart className={`h-4 w-4 ${post.user_has_liked ? 'fill-red-500 text-red-500' : ''}`} />
                          <span className="text-xs">{post.likes_count || 0}</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-2"
                          onClick={() => handleSpiderReaction(post.id)}
                          title="React with spider emoji"
                        >
                          <span className={`text-lg ${post.user_has_spider_reacted ? 'scale-125' : ''} transition-transform`}>
                            🕷️
                          </span>
                          <span className="text-xs">{post.spider_reactions_count || 0}</span>
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-2"
                          onClick={() => toggleReplies(post.id)}
                        >
                          <MessageSquare className="h-4 w-4" />
                          <span className="text-xs">{post.replies_count || 0}</span>
                        </Button>

                        {user && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-2"
                            onClick={() => setReplyingToPost(post.id)}
                          >
                            <Reply className="h-4 w-4" />
                            <span className="text-xs">Reply</span>
                          </Button>
                        )}
                      </div>

                      {/* Reply Form */}
                      {replyingToPost === post.id && (
                        <div className="mt-3 space-y-2">
                          <Textarea
                            placeholder="Write a reply..."
                            value={replyMessage}
                            onChange={(e) => setReplyMessage(e.target.value)}
                            className="text-sm"
                            rows={2}
                            maxLength={1000}
                          />
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setReplyingToPost(null);
                                setReplyMessage('');
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleReply(post.id)}
                              disabled={!replyMessage.trim()}
                            >
                              Post Reply
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Replies */}
                      {showReplies[post.id] && replies[post.id] && (
                        <div className="mt-3 space-y-2 pl-4 border-l-2 border-primary/20">
                          {replies[post.id].map(reply => (
                            <div key={reply.id} className="flex items-start gap-2">
                              <Avatar className="w-6 h-6">
                                <AvatarImage src={reply.user_profile?.avatar_url || undefined} />
                                <AvatarFallback className="text-xs">
                                  {reply.user_profile?.display_name?.[0]?.toUpperCase() || '?'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <ClickableUsername
                                    userId={reply.user_id}
                                    displayName={reply.user_profile?.display_name}
                                    variant="link"
                                    size="sm"
                                    className="font-medium p-0 h-auto text-xs"
                                  />
                                  <span className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">{reply.message}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
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
