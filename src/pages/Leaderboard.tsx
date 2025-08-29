import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Trophy, Medal, Award, ArrowLeft, Crown, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PowerScoreArc from "@/components/PowerScoreArc";

interface Spider {
  id: string;
  nickname: string;
  species: string;
  image_url: string;
  power_score: number;
  rarity: "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY";
  hit_points: number;
  damage: number;
  speed: number;
  defense: number;
  venom: number;
  webcraft: number;
  owner_id: string;
  created_at: string;
  profiles: {
    display_name: string | null;
  } | null;
}

const Leaderboard = () => {
  const { toast } = useToast();
  const [topSpiders, setTopSpiders] = useState<Spider[]>([]);
  const [loading, setLoading] = useState(true);

  const rarityColors = {
    COMMON: "bg-gray-500",
    UNCOMMON: "bg-green-500", 
    RARE: "bg-blue-500",
    EPIC: "bg-purple-500",
    LEGENDARY: "bg-amber-500",
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-5 w-5 text-amber-500" />;
    if (rank === 2) return <Trophy className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
    if (rank <= 10) return <Award className="h-5 w-5 text-primary" />;
    return <Star className="h-4 w-4 text-muted-foreground" />;
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return "1st";
    if (rank === 2) return "2nd"; 
    if (rank === 3) return "3rd";
    return `${rank}th`;
  };

  useEffect(() => {
    fetchTopSpiders();
  }, []);

  const fetchTopSpiders = async () => {
    try {
      setLoading(true);

      const { data: spiders, error } = await supabase
        .from('spiders')
        .select(`
          *,
          profiles (
            display_name
          )
        `)
        .eq('is_approved', true)
        .order('power_score', { ascending: false })
        .limit(100);

      if (error) throw error;

      setTopSpiders((spiders || []) as any);
    } catch (error: any) {
      console.error("Error fetching leaderboard:", error);
      toast({ 
        title: "Error loading leaderboard", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading global leaderboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Global Leaderboard — Spider League</title>
        <meta name="description" content="View the top-ranked spider fighters in Spider League by Power Score." />
        <link rel="canonical" href={`${window.location.origin}/leaderboard`} />
      </Helmet>
      
      <main className="container mx-auto px-6 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to Home
            </Link>
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium">Leaderboard</span>
        </div>
        
        <div className="flex items-center justify-center mb-8">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <img 
                src="/lovable-uploads/3a8558c8-28e5-4ad2-8bb8-425536ee81ca.png" 
                alt="Spider League Logo" 
                className="h-16 w-auto"
              />
            </div>
            <h1 className="text-4xl font-bold mb-2">Global Leaderboard</h1>
            <p className="text-muted-foreground">The most powerful spider fighters in the league</p>
          </div>
        </div>

        {topSpiders.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Spiders Yet</h3>
              <p className="text-muted-foreground">Be the first to upload a spider and claim the top spot!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Top 3 Featured */}
            {topSpiders.slice(0, 3).length > 0 && (
              <div className="space-y-4 mb-8">
                {topSpiders.slice(0, 3).map((spider, index) => {
                  const rank = index + 1;
                  const ownerName = spider.profiles?.display_name || `User ${spider.owner_id.slice(0, 8)}`;
                  return (
                    <Card key={spider.id} className={`${rank === 1 ? 'ring-2 ring-amber-500' : ''}`}>
                      <CardContent className="flex items-center gap-4 p-6">
                        <div className="flex items-center gap-3">
                          {getRankIcon(rank)}
                          <Badge variant="secondary" className="font-bold text-lg px-3 py-1">
                            {getRankBadge(rank)}
                          </Badge>
                        </div>
                        
                        <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                          <img 
                            src={spider.image_url} 
                            alt={`${spider.nickname} - ${spider.species}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-xl">{spider.nickname}</h3>
                            <Badge 
                              variant="secondary" 
                              className={`${rarityColors[spider.rarity]} text-white`}
                            >
                              {spider.rarity}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground">{spider.species}</p>
                          <p className="text-sm text-muted-foreground">Owner: {ownerName}</p>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <PowerScoreArc score={spider.power_score} />
                          <div className="text-right">
                            <div className="text-3xl font-bold">{spider.power_score}</div>
                            <div className="text-sm text-muted-foreground">Power Score</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Rest of the leaderboard */}
            <div className="space-y-2">
              {topSpiders.slice(3).map((spider, index) => {
                const rank = index + 4;
                const ownerName = spider.profiles?.display_name || `User ${spider.owner_id.slice(0, 8)}`;
                return (
                  <Card key={spider.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex items-center gap-2 w-16">
                          {getRankIcon(rank)}
                          <span className="font-bold text-lg min-w-0">#{rank}</span>
                        </div>
                        
                        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                          <img 
                            src={spider.image_url} 
                            alt={`${spider.nickname} - ${spider.species}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold truncate">{spider.nickname}</h3>
                          <p className="text-sm text-muted-foreground truncate">{spider.species}</p>
                          <p className="text-xs text-muted-foreground truncate">Owner: {ownerName}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <Badge 
                          variant="secondary" 
                          className={`${rarityColors[spider.rarity]} text-white`}
                        >
                          {spider.rarity}
                        </Badge>
                        
                        <div className="text-right">
                          <div className="text-2xl font-bold">{spider.power_score}</div>
                          <div className="text-xs text-muted-foreground">Power Score</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Leaderboard;
