import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, User, Calendar, Zap } from 'lucide-react'; // Bite functionality uses Zap icon
import { BadgeIcon } from '@/components/BadgeIcon';
import SpiderDetailsModal from '@/components/SpiderDetailsModal';
import { supabase } from '@/integrations/supabase/client';
import PowerScoreArc from '@/components/PowerScoreArc';
import ProfileWall from '@/components/ProfileWall';
import { useAuth } from '@/auth/AuthProvider';
import { toast } from 'sonner';
import { useState as useReactState, useEffect } from 'react';

interface UserProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  rating_elo: number | null;
  season_wins: number | null;
  season_losses: number | null;
  created_at: string;
}

interface Spider {
  id: string;
  nickname: string;
  species: string;
  image_url: string;
  power_score: number;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY" | "UNCOMMON";
  hit_points?: number;
  damage?: number;
  speed?: number;
  defense?: number;
  venom?: number;
  webcraft?: number;
  is_approved?: boolean;
  owner_id?: string;
  created_at?: string;
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
  const { user } = useAuth();
  const [profile, setProfile] = useReactState<UserProfile | null>(null);
  const [spiders, setSpiders] = useReactState<Spider[]>([]);
  const [badges, setBadges] = useReactState<UserBadge[]>([]);
  const [loading, setLoading] = useReactState(true);
  const [selectedSpider, setSelectedSpider] = useReactState<any>(null);
  const [isSpiderModalOpen, setIsSpiderModalOpen] = useReactState(false);
  const [hasBitUser, setHasBitUser] = useReactState(false);
  const [biting, setBiting] = useReactState(false);
  const [biteCount, setBiteCount] = useReactState(0);

  const handleViewFullProfile = () => {
    onClose();
    // Use window.location for navigation to avoid Router context issues
    window.location.href = `/collection/${userId}`;
  };

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
      if (user) {
        checkBiteStatus();
      }
    }
  }, [isOpen, userId, user]);

  const checkBiteStatus = async () => {
    if (!user) return;

    try {
      // Check if current user has bitten this user
      const { data: biteData } = await supabase
        .from('pokes')
        .select('id')
        .eq('poker_user_id', user.id)
        .eq('poked_user_id', userId)
        .maybeSingle();

      setHasBitUser(!!biteData);

      // Get total bite count
      const { count } = await supabase
        .from('pokes')
        .select('*', { count: 'exact', head: true })
        .eq('poked_user_id', userId);

      setBiteCount(count || 0);
    } catch (error) {
      console.error('Error checking bite status:', error);
    }
  };

  const handleBite = async () => {
    if (!user || user.id === userId) return;

    setBiting(true);
    try {
      if (hasBitUser) {
        // Remove bite
        const { error } = await supabase
          .from('pokes')
          .delete()
          .eq('poker_user_id', user.id)
          .eq('poked_user_id', userId);

        if (error) throw error;

        toast.success('Bite removed! 🦷');
        setHasBitUser(false);
        setBiteCount(prev => Math.max(0, prev - 1));
      } else {
        // Add bite
        const { error } = await supabase
          .from('pokes')
          .insert({
            poker_user_id: user.id,
            poked_user_id: userId
          });

        if (error) throw error;

        toast.success(`You bit ${profile?.display_name || 'this player'}! 🦷`);
        setHasBitUser(true);
        setBiteCount(prev => prev + 1);
      }
    } catch (error: any) {
      console.error('Error toggling bite:', error);
      toast.error(error.message || 'Failed to bite player');
    } finally {
      setBiting(false);
    }
  };

  const fetchUserData = async () => {
    setLoading(true);
    
    try {
      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, bio, rating_elo, season_wins, season_losses, created_at')
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

  const handleSpiderClick = (spider: Spider) => {
    // Create a compatible spider object for the modal
    const modalSpider = {
      id: spider.id,
      nickname: spider.nickname,
      species: spider.species,
      image_url: spider.image_url,
      power_score: spider.power_score,
      rarity: spider.rarity,
      hit_points: 50, // Default values since these aren't stored in profile spider list
      damage: 50,
      speed: 50,
      defense: 50,
      venom: 50,
      webcraft: 50,
      is_approved: true,
      owner_id: userId,
      created_at: new Date().toISOString()
    };
    setSelectedSpider(modalSpider as any);
    setIsSpiderModalOpen(true);
  };

  const totalPowerScore = spiders.reduce((sum, spider) => sum + spider.power_score, 0);
  const winRate = profile?.season_wins && profile?.season_losses 
    ? (profile.season_wins / (profile.season_wins + profile.season_losses) * 100).toFixed(1)
    : '0';

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    });
  };

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
                    <p className="text-muted-foreground flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4" />
                      Joined {formatDate(profile.created_at)}
                    </p>
                    {profile.bio && (
                      <p className="text-muted-foreground mb-3">{profile.bio}</p>
                    )}
                    
                    {/* Bite Button - Only show if viewing someone else's profile */}
                    {user && userId !== user.id && (
                      <div className="flex items-center gap-3 mb-3">
                        <Button
                          variant={hasBitUser ? "destructive" : "outline"}
                          size="sm"
                          onClick={handleBite}
                          disabled={biting}
                          className="flex items-center gap-2"
                        >
                          <Zap className="h-4 w-4" />
                          {hasBitUser ? "Unbite" : "Bite 🦷"}
                        </Button>
                        {biteCount > 0 && (
                          <span className="text-sm text-muted-foreground">
                            🦷 {biteCount} bite{biteCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
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
                        className="group relative p-3 border rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => handleSpiderClick(spider)}
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

            {/* Profile Wall Section */}
            <ProfileWall 
              profileUserId={userId}
              profileDisplayName={profile.display_name || 'Anonymous Player'}
            />

            {/* Action Buttons */}
            <div className="flex justify-center gap-3">
              <Button 
                onClick={handleViewFullProfile}
                variant="default"
              >
                View Full Profile
              </Button>
              <Button onClick={onClose} variant="outline">
                Close
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

      <SpiderDetailsModal
        spider={selectedSpider}
        isOpen={isSpiderModalOpen}
        onClose={() => setIsSpiderModalOpen(false)}
      />
    </Dialog>
  );
};

export default UserSnapshotModal;