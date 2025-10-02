import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Users, Target, MessageSquare, Trash2, Send, Hand } from "lucide-react";
import { BadgeIcon } from "@/components/BadgeIcon";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/auth/AuthProvider";
import { z } from "zod";
import { formatDistanceToNow } from "date-fns";

interface UserProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
}

interface UserBadge {
  id: string;
  badge: {
    id: string;
    name: string;
    description: string;
    icon: string;
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
    color: string;
  };
  awarded_at: string;
}

interface UserStats {
  spider_count: number;
  total_power_score: number;
  battles_won: number;
  battles_total: number;
}

interface WallPost {
  id: string;
  profile_user_id: string;
  poster_user_id: string;
  message: string;
  created_at: string;
  poster_profile?: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

const wallPostSchema = z.object({
  message: z.string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(500, "Message must be less than 500 characters")
});

interface UserProfileModalProps {
  userId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

const rarityColors = {
  common: 'bg-gray-500',
  rare: 'bg-blue-500', 
  epic: 'bg-purple-500',
  legendary: 'bg-amber-500'
};

export const UserProfileModal = ({ userId, isOpen, onClose }: UserProfileModalProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [wallPosts, setWallPosts] = useState<WallPost[]>([]);
  const [newPostMessage, setNewPostMessage] = useState("");
  const [postingMessage, setPostingMessage] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [pokeCount, setPokeCount] = useState(0);
  const [hasPokedUser, setHasPokedUser] = useState(false);
  const [pokingUser, setPokingUser] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      fetchUserProfile();
      fetchWallPosts();
      fetchPokes();
    }
  }, [isOpen, userId]);

  // Real-time subscription for wall posts
  useEffect(() => {
    if (!isOpen || !userId) return;

    const channel = supabase
      .channel(`wall-posts-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'profile_wall_posts',
          filter: `profile_user_id=eq.${userId}`
        },
        () => {
          fetchWallPosts();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'profile_wall_posts',
          filter: `profile_user_id=eq.${userId}`
        },
        () => {
          fetchWallPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, userId]);

  const fetchUserProfile = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, bio, created_at')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      // Fetch user badges
      const { data: badgeData, error: badgeError } = await supabase
        .from('user_badges')
        .select(`
          id,
          awarded_at,
          badge:badges(
            id,
            name,
            description,
            icon,
            rarity,
            color
          )
        `)
        .eq('user_id', userId)
        .order('awarded_at', { ascending: false });

      if (badgeError) throw badgeError;

      // Fetch user stats
      const { data: spiderData, error: spiderError } = await supabase
        .from('spiders')
        .select('power_score')
        .eq('owner_id', userId)
        .eq('is_approved', true);

      if (spiderError) throw spiderError;

      const { data: battleData, error: battleError } = await supabase
        .from('battle_challenges')
        .select('winner_id, challenger_id, accepter_id')
        .or(`challenger_id.eq.${userId},accepter_id.eq.${userId}`)
        .eq('status', 'COMPLETED');

      if (battleError) throw battleError;

      const totalPowerScore = spiderData?.reduce((sum, spider) => sum + spider.power_score, 0) || 0;
      const battlesWon = battleData?.filter(battle => battle.winner_id === userId).length || 0;
      const battlesTotal = battleData?.length || 0;

      setProfile(profileData);
      setBadges(badgeData as UserBadge[]);
      setStats({
        spider_count: spiderData?.length || 0,
        total_power_score: totalPowerScore,
        battles_won: battlesWon,
        battles_total: battlesTotal
      });

    } catch (error: any) {
      console.error('Error fetching user profile:', error);
      toast({
        title: "Error",
        description: "Failed to load user profile",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchWallPosts = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('profile_wall_posts')
        .select('*')
        .eq('profile_user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch poster profiles separately
      const posterIds = [...new Set(data?.map(post => post.poster_user_id) || [])];
      
      if (posterIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', posterIds);

        // Combine data
        const postsWithProfiles = data?.map(post => ({
          ...post,
          poster_profile: profiles?.find(p => p.id === post.poster_user_id)
        })) || [];

        setWallPosts(postsWithProfiles);
      } else {
        setWallPosts([]);
      }
    } catch (error: any) {
      console.error('Error fetching wall posts:', error);
    }
  };

  const fetchPokes = async () => {
    if (!userId) return;

    try {
      // Get total poke count for this user
      const { count, error: countError } = await supabase
        .from('pokes')
        .select('*', { count: 'exact', head: true })
        .eq('poked_user_id', userId);

      if (countError) throw countError;
      setPokeCount(count || 0);

      // Check if current user has poked this user
      if (user) {
        const { data, error } = await supabase
          .from('pokes')
          .select('id')
          .eq('poker_user_id', user.id)
          .eq('poked_user_id', userId)
          .maybeSingle();

        if (error) throw error;
        setHasPokedUser(!!data);
      }
    } catch (error: any) {
      console.error('Error fetching pokes:', error);
    }
  };

  const handlePoke = async () => {
    if (!user || !userId || user.id === userId) return;

    setPokingUser(true);
    try {
      if (hasPokedUser) {
        // Remove poke
        const { error } = await supabase
          .from('pokes')
          .delete()
          .eq('poker_user_id', user.id)
          .eq('poked_user_id', userId);

        if (error) throw error;

        setHasPokedUser(false);
        setPokeCount(prev => Math.max(0, prev - 1));
        toast({
          title: "Poke removed",
          description: "You unpoked this user"
        });
      } else {
        // Add poke
        const { error } = await supabase
          .from('pokes')
          .insert({
            poker_user_id: user.id,
            poked_user_id: userId
          });

        if (error) throw error;

        setHasPokedUser(true);
        setPokeCount(prev => prev + 1);
        toast({
          title: "Poked!",
          description: "You poked this user"
        });
      }
    } catch (error: any) {
      console.error('Error poking user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to poke user",
        variant: "destructive"
      });
    } finally {
      setPokingUser(false);
    }
  };

  const handlePostMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !userId) return;
    
    // Prevent posting on own wall
    if (user.id === userId) {
      toast({
        title: "Not Allowed",
        description: "You cannot post on your own wall",
        variant: "destructive"
      });
      return;
    }

    // Validate message
    try {
      wallPostSchema.parse({ message: newPostMessage });
      setValidationError(null);
    } catch (error) {
      if (error instanceof z.ZodError) {
        setValidationError(error.errors[0].message);
        return;
      }
    }

    setPostingMessage(true);
    try {
      const { error } = await supabase
        .from('profile_wall_posts')
        .insert({
          profile_user_id: userId,
          poster_user_id: user.id,
          message: newPostMessage.trim()
        });

      if (error) throw error;

      setNewPostMessage("");
      setValidationError(null);
      toast({
        title: "Posted!",
        description: "Your message has been posted to their wall"
      });
    } catch (error: any) {
      console.error('Error posting message:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to post message",
        variant: "destructive"
      });
    } finally {
      setPostingMessage(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      const { error } = await supabase
        .from('profile_wall_posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      toast({
        title: "Deleted",
        description: "Wall post has been deleted"
      });
    } catch (error: any) {
      console.error('Error deleting post:', error);
      toast({
        title: "Error",
        description: "Failed to delete post",
        variant: "destructive"
      });
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    });
  };

  if (!isOpen || !userId) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>User Profile</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <Skeleton className="h-20 w-20 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : profile ? (
          <div className="space-y-6">
            {/* Profile Header */}
            <div className="flex items-start space-x-6">
              <Avatar className="h-20 w-20">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="text-2xl">
                  {getInitials(profile.display_name)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold">
                      {profile.display_name || 'Anonymous User'}
                    </h2>
                    <p className="text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Joined {formatDate(profile.created_at)}
                    </p>
                  </div>
                  
                  {/* Action Buttons */}
                  {userId && (
                    <div className="flex items-center gap-2">
                      {/* Poke Button - Only show if viewing someone else's profile */}
                      {user && userId !== user.id && (
                        <div className="flex flex-col items-center gap-2">
                          <Button
                            variant={hasPokedUser ? "secondary" : "outline"}
                            size="sm"
                            onClick={handlePoke}
                            disabled={pokingUser}
                            className="flex items-center gap-2"
                          >
                            <Hand className="h-4 w-4" />
                            {hasPokedUser ? "Unpoke" : "Poke"}
                          </Button>
                          {pokeCount > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {pokeCount} poke{pokeCount !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      )}
                      
                      {/* View Full Profile Button */}
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => {
                          onClose();
                          navigate(`/collection/${userId}`);
                        }}
                        className="flex items-center gap-2"
                      >
                        <Users className="h-4 w-4" />
                        View Full Profile
                      </Button>
                    </div>
                  )}
                </div>
                
                {profile.bio && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {profile.bio}
                  </p>
                )}
              </div>
            </div>

            {/* Stats */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-2xl font-bold">{stats.spider_count}</div>
                    <div className="text-xs text-muted-foreground">Spiders</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center mb-2">
                      <BadgeIcon badgeName="Power Player" size="sm" />
                    </div>
                    <div className="text-2xl font-bold">{stats.total_power_score.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Total Power</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center mb-2">
                      <BadgeIcon badgeName="First Victory" size="sm" />
                    </div>
                    <div className="text-2xl font-bold">{stats.battles_won}</div>
                    <div className="text-xs text-muted-foreground">Victories</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Target className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="text-2xl font-bold">
                      {stats.battles_total > 0 
                        ? Math.round((stats.battles_won / stats.battles_total) * 100)
                        : 0}%
                    </div>
                    <div className="text-xs text-muted-foreground">Win Rate</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Wall Posts Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Wall
              </h3>

              {/* Post Form - Only show if viewing someone else's profile */}
              {user && userId !== user.id && (
                <Card>
                  <CardContent className="p-4">
                    <form onSubmit={handlePostMessage} className="space-y-3">
                      <Textarea
                        placeholder="Write something on their wall..."
                        value={newPostMessage}
                        onChange={(e) => {
                          setNewPostMessage(e.target.value);
                          setValidationError(null);
                        }}
                        className="min-h-[80px] resize-none"
                        maxLength={500}
                        disabled={postingMessage}
                      />
                      {validationError && (
                        <p className="text-sm text-destructive">{validationError}</p>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">
                          {newPostMessage.length}/500 characters
                        </span>
                        <Button 
                          type="submit" 
                          size="sm"
                          disabled={postingMessage || !newPostMessage.trim()}
                        >
                          <Send className="h-4 w-4 mr-2" />
                          Post
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              {/* Wall Posts List */}
              <div className="space-y-3">
                {wallPosts.length > 0 ? (
                  wallPosts.map((post) => {
                    const canDelete = user && (user.id === post.poster_user_id || user.id === userId);
                    
                    return (
                      <Card key={post.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={post.poster_profile?.avatar_url || undefined} />
                              <AvatarFallback>
                                {getInitials(post.poster_profile?.display_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <p className="font-medium text-sm">
                                    {post.poster_profile?.display_name || 'Anonymous User'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                                  </p>
                                </div>
                                {canDelete && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeletePost(post.id)}
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                              <p className="text-sm whitespace-pre-wrap break-words">
                                {post.message}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-muted-foreground">
                        {user && userId !== user.id 
                          ? "No posts yet. Be the first to write on their wall!"
                          : "No posts on this wall yet"
                        }
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Badges */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Achievements</h3>
              {badges.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {badges.map((userBadge) => {
                    return (
                      <Card key={userBadge.id} className="transition-colors hover:bg-muted/50">
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-3">
                            <div 
                              className={`p-2 rounded-full ${rarityColors[userBadge.badge.rarity]}`}
                              style={{ backgroundColor: userBadge.badge.color }}
                            >
                              <BadgeIcon badgeName={userBadge.badge.name} size="sm" className="brightness-0 invert" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <h4 className="font-medium text-sm">{userBadge.badge.name}</h4>
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${rarityColors[userBadge.badge.rarity]} text-white border-0`}
                                  style={{ backgroundColor: userBadge.badge.color }}
                                >
                                  {userBadge.badge.rarity}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {userBadge.badge.description}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Earned {formatDate(userBadge.awarded_at)}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <BadgeIcon badgeName="First Victory" size="lg" className="mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground">No achievements earned yet</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Start battling and collecting spiders to earn badges!
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">User not found</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};