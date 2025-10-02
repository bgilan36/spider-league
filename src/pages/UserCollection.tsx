import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users } from 'lucide-react';
import PowerScoreArc from '@/components/PowerScoreArc';
import BattleButton from '@/components/BattleButton';
import { Skeleton } from '@/components/ui/skeleton';
import ProfileWall from '@/components/ProfileWall';

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
  const [spiders, setSpiders] = useState<Spider[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchUserCollection();
    }
  }, [userId]);

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
        <div className="flex items-center gap-4 mb-8">
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