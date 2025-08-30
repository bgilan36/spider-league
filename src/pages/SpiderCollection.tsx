import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trophy, Zap, Shield, Target, Droplet, Globe, ArrowUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import PowerScoreArc from "@/components/PowerScoreArc";
import BattleButton from "@/components/BattleButton";

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
  owner_id?: string;
  created_at: string;
}

const SpiderCollection = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [spiders, setSpiders] = useState<Spider[]>([]);
  const [sortBy, setSortBy] = useState<"newest" | "power_score" | "recent">("newest");
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

      setSpiders(userSpiders || []);
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to load spiders.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getSortedSpiders = () => {
    if (!spiders.length) return [];
    
    const sortedSpiders = [...spiders];
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    switch (sortBy) {
      case "power_score":
        return sortedSpiders.sort((a, b) => b.power_score - a.power_score);
      case "recent":
        return sortedSpiders.filter(spider => 
          new Date(spider.created_at) >= oneWeekAgo
        ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case "newest":
      default:
        return sortedSpiders.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
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
      </div>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">{spider.nickname}</CardTitle>
        <CardDescription>{spider.species}</CardDescription>
        <div className="flex justify-center mt-2">
          <PowerScoreArc score={spider.power_score} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground leading-relaxed">
          A powerful {spider.species.toLowerCase()} with exceptional {spider.venom > 70 ? 'venom production' : spider.webcraft > 70 ? 'web crafting abilities' : spider.speed > 70 ? 'agility and speed' : spider.defense > 70 ? 'defensive capabilities' : 'combat prowess'}. This spider excels in battle with its {spider.damage > 70 ? 'devastating attacks' : spider.hit_points > 70 ? 'incredible endurance' : 'balanced fighting style'}.
        </p>
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
        
        <div className="pt-4 border-t flex justify-center">
          <BattleButton 
            targetSpider={{...spider, owner_id: spider.owner_id || user?.id}} 
            size="sm" 
            variant="outline"
            className="w-full"
          />
        </div>
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
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              ← Home
            </Link>
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium">Collection</span>
        </div>
        
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <img 
              src="/lovable-uploads/3a8558c8-28e5-4ad2-8bb8-425536ee81ca.png" 
              alt="Spider League Logo" 
              className="h-12 w-auto"
            />
            <div>
              <h1 className="text-3xl font-bold mb-2">My Spider Collection</h1>
              <p className="text-muted-foreground">View and manage your fighters ({spiders.length} total)</p>
            </div>
          </div>
          <Button asChild>
            <Link to="/upload">
              <Plus className="mr-2 h-4 w-4" />
              Upload Spider
            </Link>
          </Button>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4" />
            <span className="text-sm font-medium">Sort by:</span>
          </div>
          <Select value={sortBy} onValueChange={(value: "newest" | "power_score" | "recent") => setSortBy(value)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Upload Date (Newest)</SelectItem>
              <SelectItem value="power_score">Power Score (Highest)</SelectItem>
              <SelectItem value="recent">Past Week</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {spiders.length === 0 ? (
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
          <>
            {sortBy === "recent" && getSortedSpiders().length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground">No spiders uploaded in the past week.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {getSortedSpiders().map((spider) => (
                  <SpiderCard key={spider.id} spider={spider} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default SpiderCollection;