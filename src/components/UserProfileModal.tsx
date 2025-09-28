import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Users, Target } from "lucide-react";
import { BadgeIcon } from "@/components/BadgeIcon";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      fetchUserProfile();
    }
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
                <div>
                  <h2 className="text-2xl font-bold">
                    {profile.display_name || 'Anonymous User'}
                  </h2>
                  <p className="text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Joined {formatDate(profile.created_at)}
                  </p>
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