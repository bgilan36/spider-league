import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, Zap } from 'lucide-react';
import PowerScoreArc from '@/components/PowerScoreArc';
import BattleButton from '@/components/BattleButton';
import { Skeleton } from '@/components/ui/skeleton';
import ProfileWall from '@/components/ProfileWall';
import { useAuth } from '@/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';

interface Spider {
  id: string;
  nickname: string;
  species: string;
  image_url: string;
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'UNCOMMON';
  hit_points: number;
  damage: number;
  speed: number;
  defense: number;
  venom: number;
  webcraft: number;
  power_score: number;
}

interface UserProfile {
  display_name: string;
  avatar_url?: string;
}

const UserCollection: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [spiders, setSpiders] = useState<Spider[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [biteCount, setBiteCount] = useState(0);
  const [hasBittenUser, setHasBittenUser] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchUserCollection();
      if (user && userId !== user.id) {
        fetchBites();
      }
    }
  }, [userId, user]);

  const fetchUserCollection = async () => {
    try {
      // Fetch user profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', userId)
        .single();
      
      setUserProfile(profileData);

      // Fetch user's approved spiders
      const { data: spiderData } = await supabase
        .from('spiders')
        .select('*')
        .eq('owner_id', userId)
        .eq('is_approved', true)
        .order('created_at', { ascending: false });

      setSpiders(spiderData || []);
    } catch (error) {
      console.error('Error fetching user collection:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBites = async () => {
    if (!user || !userId) return;

    try {
      // Get total bite count for this user
      const { count } = await supabase
        .from('pokes')
        .select('*', { count: 'exact', head: true })
        .eq('poked_user_id', userId);
      
      setBiteCount(count || 0);

      // Check if current user has bitten this user
      if (user) {
        const { data } = await supabase
          .from('pokes')
          .select('id')
          .eq('poker_user_id', user.id)
          .eq('poked_user_id', userId)
          .maybeSingle();
        
        setHasBittenUser(!!data);
      }
    } catch (error) {
      console.error('Error fetching bites:', error);
    }
  };

  const handleBite = async () => {
    if (!user || !userId) return;

    try {
      if (hasBittenUser) {
        // Remove bite
        const { error } = await supabase
          .from('pokes')
          .delete()
          .eq('poker_user_id', user.id)
          .eq('poked_user_id', userId);

        if (error) throw error;

        setHasBittenUser(false);
        setBiteCount(prev => Math.max(0, prev - 1));
        toast({
          title: "Bite removed",
          description: "You unbit this user"
        });
      } else {
        // Add bite
        const { error } = await supabase
          .from('pokes')
          .insert({
            poker_user_id: user.id,
            poked_user_id: userId
          });

        if (error) throw error;

        setHasBittenUser(true);
        setBiteCount(prev => prev + 1);
        toast({
          title: "Bitten!",
          description: "You bit this user"
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to bite user",
        variant: "destructive"
      });
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'LEGENDARY': return 'bg-yellow-500';
      case 'EPIC': return 'bg-purple-500';
      case 'RARE': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Helmet>
          <title>User Collection - Spider League</title>
        </Helmet>
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-8">
            <Skeleton className="h-10 w-10 rounded" />
            <Skeleton className="h-8 w-48" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-96 rounded-lg" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{userProfile?.display_name || 'User'}'s Collection - Spider League</title>
        <meta name="description" content={`View ${userProfile?.display_name || 'User'}'s spider collection in Spider League`} />
      </Helmet>

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/leaderboard">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            
            <div className="flex items-center gap-3">
              {userProfile?.avatar_url && (
                <img 
                  src={userProfile.avatar_url} 
                  alt={userProfile.display_name || 'User'}
                  className="w-10 h-10 rounded-full"
                />
              )}
              <div>
                <h1 className="text-2xl font-bold">{userProfile?.display_name || 'User'}'s Collection</h1>
                <p className="text-muted-foreground flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {spiders.length} Spider{spiders.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Bite Button - Only show if viewing someone else's profile and user is logged in */}
          {user && userId && userId !== user.id && (
            <div className="flex items-center gap-2">
              <Button
                variant={hasBittenUser ? "secondary" : "outline"}
                size="sm"
                onClick={handleBite}
                className="gap-2"
              >
                <Zap className="h-4 w-4" />
                {hasBittenUser ? "Unbite" : "Bite"}
              </Button>
              {biteCount > 0 && (
                <Badge variant="secondary">
                  {biteCount} bite{biteCount !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          )}
        </div>

        {spiders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">This user hasn't uploaded any spiders yet.</p>
            <Button asChild>
              <Link to="/leaderboard">Back to Leaderboard</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {spiders.map((spider) => (
              <Card key={spider.id} className="overflow-hidden">
                <div className="relative">
                  <img 
                    src={spider.image_url} 
                    alt={spider.nickname}
                    className="w-full h-48 object-cover"
                  />
                  <Badge 
                    className={`absolute top-2 right-2 text-white ${getRarityColor(spider.rarity)}`}
                  >
                    {spider.rarity}
                  </Badge>
                </div>
                
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-lg">{spider.nickname}</h3>
                      <p className="text-sm text-muted-foreground">{spider.species}</p>
                    </div>
                    <PowerScoreArc score={spider.power_score} size="small" />
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span>HP</span>
                      <span>{spider.hit_points}</span>
                    </div>
                    <Progress value={spider.hit_points} className="h-2" />

                    <div className="flex justify-between text-sm">
                      <span>Damage</span>
                      <span>{spider.damage}</span>
                    </div>
                    <Progress value={spider.damage} className="h-2" />

                    <div className="flex justify-between text-sm">
                      <span>Speed</span>
                      <span>{spider.speed}</span>
                    </div>
                    <Progress value={spider.speed} className="h-2" />

                    <div className="flex justify-between text-sm">
                      <span>Defense</span>
                      <span>{spider.defense}</span>
                    </div>
                    <Progress value={spider.defense} className="h-2" />

                    <div className="flex justify-between text-sm">
                      <span>Venom</span>
                      <span>{spider.venom}</span>
                    </div>
                    <Progress value={spider.venom} className="h-2" />

                    <div className="flex justify-between text-sm">
                      <span>Webcraft</span>
                      <span>{spider.webcraft}</span>
                    </div>
                    <Progress value={spider.webcraft} className="h-2" />
                  </div>

                  <BattleButton 
                    targetSpider={{
                      ...spider,
                      is_approved: true,
                      owner_id: userId
                    }} 
                    context="collection"
                  />
                </CardContent>
              </Card>
              ))}
            </div>

            {/* Profile Wall Section */}
            <div className="mt-8 max-w-4xl mx-auto">
              <ProfileWall 
                profileUserId={userId!} 
                profileDisplayName={userProfile?.display_name || 'User'} 
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default UserCollection;