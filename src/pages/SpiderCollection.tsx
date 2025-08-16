import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Trophy, Zap, Shield, Target, Droplet, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";

interface Spider {
  id: string;
  nickname: string;
  species: string;
  image_url: string;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY" | "UNCOMMON";
  hit_points: number;
  damage: number;
  speed: number;
  defense: number;
  venom: number;
  webcraft: number;
  power_score: number;
  is_approved: boolean;
  created_at: string;
}

const SpiderCollection = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [mySpiders, setMySpiders] = useState<Spider[]>([]);
  const [allSpiders, setAllSpiders] = useState<Spider[]>([]);
  const [loading, setLoading] = useState(true);

  const rarityColors = {
    COMMON: "bg-gray-500",
    UNCOMMON: "bg-green-500",
    RARE: "bg-blue-500", 
    EPIC: "bg-purple-500",
    LEGENDARY: "bg-amber-500"
  };

  const statIcons = {
    hit_points: Trophy,
    damage: Target,
    speed: Zap,
    defense: Shield,
    venom: Droplet,
    webcraft: Globe
  };

  useEffect(() => {
    fetchSpiders();
  }, [user]);

  const fetchSpiders = async () => {
    if (!user) return;
    
    try {
      // Fetch user's spiders (including unapproved ones)
      const { data: userSpiders, error: userError } = await supabase
        .from('spiders')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (userError) throw userError;

      // Fetch all approved spiders
      const { data: approvedSpiders, error: approvedError } = await supabase
        .from('spiders')
        .select('*')
        .eq('is_approved', true)
        .order('power_score', { ascending: false })
        .limit(50);

      if (approvedError) throw approvedError;

      setMySpiders(userSpiders || []);
      setAllSpiders(approvedSpiders || []);
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to load spiders.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const SpiderCard = ({ spider, showOwner = false }: { spider: Spider; showOwner?: boolean }) => (
    <Card className="overflow-hidden">
      <div className="aspect-square relative">
        <img 
          src={spider.image_url} 
          alt={spider.nickname}
          className="w-full h-full object-cover"
        />
        <Badge 
          className={`absolute top-2 right-2 ${rarityColors[spider.rarity]} text-white`}
        >
          {spider.rarity}
        </Badge>
        {!spider.is_approved && (
          <Badge variant="outline" className="absolute top-2 left-2 bg-background">
            Pending Approval
          </Badge>
        )}
      </div>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{spider.nickname}</CardTitle>
        <CardDescription>{spider.species}</CardDescription>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Power Score</span>
          <span className="text-lg font-bold text-primary">{spider.power_score}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {Object.entries(statIcons).map(([stat, Icon]) => (
          <div key={stat} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              <span className="capitalize">{stat.replace('_', ' ')}</span>
            </div>
            <div className="flex items-center gap-2 min-w-0 flex-1 ml-2">
              <Progress 
                value={(spider[stat as keyof Spider] as number) / 100 * 100} 
                className="flex-1"
              />
              <span className="text-xs font-medium w-8 text-right">
                {spider[stat as keyof Spider] as number}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading spiders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Spider Collection — Spider League</title>
        <meta name="description" content="View your spider collection and discover other fighters in Spider League." />
        <link rel="canonical" href={`${window.location.origin}/collection`} />
      </Helmet>

      <main className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Spider Collection</h1>
            <p className="text-muted-foreground">Manage your fighters and discover others</p>
          </div>
          <Button asChild>
            <Link to="/upload">
              <Plus className="mr-2 h-4 w-4" />
              Upload Spider
            </Link>
          </Button>
        </div>

        <Tabs defaultValue="my-spiders" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="my-spiders">My Spiders ({mySpiders.length})</TabsTrigger>
            <TabsTrigger value="all-spiders">All Fighters ({allSpiders.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="my-spiders" className="mt-6">
            {mySpiders.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground mb-4">You haven't uploaded any spiders yet.</p>
                  <Button asChild>
                    <Link to="/upload">
                      <Plus className="mr-2 h-4 w-4" />
                      Upload Your First Spider
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {mySpiders.map((spider) => (
                  <SpiderCard key={spider.id} spider={spider} />
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="all-spiders" className="mt-6">
            {allSpiders.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground">No approved spiders yet. Be the first to upload!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {allSpiders.map((spider) => (
                  <SpiderCard key={spider.id} spider={spider} showOwner />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default SpiderCollection;