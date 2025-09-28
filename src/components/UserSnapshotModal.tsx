import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, User } from 'lucide-react';
import { BadgeIcon } from '@/components/BadgeIcon';
import { supabase } from '@/integrations/supabase/client';
import PowerScoreArc from '@/components/PowerScoreArc';

interface UserProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  rating_elo: number | null;
  season_wins: number | null;
  season_losses: number | null;
}

interface Spider {
  id: string;
  nickname: string;
  species: string;
  image_url: string;
  power_score: number;
  rarity: string;
}

interface UserBadge {
  id: string;
  badge: {
    name: string;
    description: string;
    icon: string;
    color: string;
    rarity: string;
  };
  awarded_at: string;
}

interface UserSnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

const UserSnapshotModal: React.FC<UserSnapshotModalProps> = ({
  isOpen,
  onClose,
  userId
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [spiders, setSpiders] = useState<Spider[]>([]);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);

  const rarityColors = {
    COMMON: "bg-gray-500",
    UNCOMMON: "bg-green-500", 
    RARE: "bg-blue-500",
    EPIC: "bg-purple-500",
    LEGENDARY: "bg-amber-500"
  };

  useEffect(() => {
    if (isOpen && userId) {
      fetchUserData();
    }
  }, [isOpen, userId]);

  const fetchUserData = async () => {
    setLoading(true);
    
    try {
      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch user's spiders
      const { data: spidersData, error: spidersError } = await supabase
        .from('spiders')
        .select('id, nickname, species, image_url, power_score, rarity')
        .eq('owner_id', userId)
        .eq('is_approved', true)
        .order('power_score', { ascending: false })
        .limit(12);

      if (spidersError) throw spidersError;
      setSpiders(spidersData || []);

      // Fetch user's badges
      const { data: badgesData, error: badgesError } = await supabase
        .from('user_badges')
        .select(`
          id,
          awarded_at,
          badge:badges (
            name,
            description,
            icon,
            color,
            rarity
          )
        `)
        .eq('user_id', userId)
        .order('awarded_at', { ascending: false });

      if (badgesError) throw badgesError;
      setBadges(badgesData || []);

    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalPowerScore = spiders.reduce((sum, spider) => sum + spider.power_score, 0);
  const winRate = profile?.season_wins && profile?.season_losses 
    ? (profile.season_wins / (profile.season_wins + profile.season_losses) * 100).toFixed(1)
    : '0';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold gradient-text">
            <User className="w-6 h-6 inline-block mr-2" />
            Player Profile
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : profile ? (
          <div className="space-y-6">
            {/* Profile Header */}
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback className="text-2xl">
                      {profile.display_name?.charAt(0)?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 text-center sm:text-left">
                    <h2 className="text-2xl font-bold mb-2">
                      {profile.display_name || 'Anonymous Player'}
                    </h2>
                    {profile.bio && (
                      <p className="text-muted-foreground mb-3">{profile.bio}</p>
                    )}
                    
                    {/* Stats */}
                    <div className="flex flex-wrap gap-4 justify-center sm:justify-start">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">ELO Rating</p>
                        <p className="text-lg font-bold">{profile.rating_elo || 1000}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Season Record</p>
                        <p className="text-lg font-bold">
                          {profile.season_wins || 0}W - {profile.season_losses || 0}L
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Win Rate</p>
                        <p className="text-lg font-bold">{winRate}%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Total Power</p>
                        <p className="text-lg font-bold">{totalPowerScore}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Badges Section */}
            {badges.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BadgeIcon badgeName="First Victory" size="sm" />
                    Badges ({badges.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {badges.map((userBadge) => (
                      <div
                        key={userBadge.id}
                        className="p-3 border rounded-lg text-center space-y-2 hover:shadow-md transition-shadow"
                      >
                        <div className="flex justify-center">
                          <BadgeIcon badgeName={userBadge.badge.name} size="lg" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{userBadge.badge.name}</p>
                          <Badge 
                            variant="outline" 
                            className="text-xs"
                            style={{ backgroundColor: userBadge.badge.color + '20', borderColor: userBadge.badge.color }}
                          >
                            {userBadge.badge.rarity}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Spider Collection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BadgeIcon badgeName="Spider Collector" size="sm" />
                  Spider Collection ({spiders.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {spiders.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No approved spiders in collection</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {spiders.map((spider) => (
                      <div
                        key={spider.id}
                        className="group relative p-3 border rounded-lg hover:shadow-md transition-shadow"
                      >
                        <div className="aspect-square relative mb-3 rounded-md overflow-hidden">
                          <img 
                            src={spider.image_url} 
                            alt={spider.nickname}
                            className="w-full h-full object-cover"
                          />
                          <Badge 
                            className={`absolute top-1 right-1 text-xs ${rarityColors[spider.rarity as keyof typeof rarityColors]} text-white`}
                          >
                            {spider.rarity}
                          </Badge>
                        </div>
                        <div className="text-center">
                          <h4 className="font-medium text-sm mb-1 truncate">{spider.nickname}</h4>
                          <p className="text-xs text-muted-foreground mb-2 truncate">{spider.species}</p>
                          <div className="flex justify-center">
                            <PowerScoreArc score={spider.power_score} size="small" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Close Button */}
            <div className="flex justify-center">
              <Button onClick={onClose} variant="outline" size="lg">
                Close Profile
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Player profile not found</p>
            <Button onClick={onClose} variant="outline" className="mt-4">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UserSnapshotModal;