import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import PowerScoreArc from "@/components/PowerScoreArc";
import ClickableUsername from "@/components/ClickableUsername";
import { Sparkles } from "lucide-react";

interface Spider {
  id: string;
  nickname: string;
  species: string;
  image_url: string;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY" | "UNCOMMON";
  power_score: number;
  owner_id: string;
  created_at: string;
}

interface Profile {
  display_name: string | null;
  avatar_url: string | null;
}

const NewSpiderSpotlight = () => {
  const [newestSpider, setNewestSpider] = useState<Spider | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const rarityColors = {
    COMMON: "bg-gray-500",
    UNCOMMON: "bg-green-500",
    RARE: "bg-blue-500",
    EPIC: "bg-purple-500",
    LEGENDARY: "bg-amber-500"
  };

  useEffect(() => {
    fetchNewestSpider();
  }, []);

  const fetchNewestSpider = async () => {
    try {
      const { data: spider, error } = await supabase
        .from("spiders")
        .select("*")
        .eq("is_approved", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;

      if (spider) {
        setNewestSpider(spider as Spider);
        
        // Fetch owner profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("id", spider.owner_id)
          .single();
        
        if (profile) {
          setOwnerProfile(profile);
        }
      }
    } catch (error) {
      console.error("Error fetching newest spider:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="container mx-auto px-4 mb-16">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Sparkles className="h-6 w-6 text-primary" />
          <h2 className="text-3xl font-bold">New Spider Spotlight</h2>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center p-12">
            <p className="text-muted-foreground">Loading newest spider...</p>
          </CardContent>
        </Card>
      </section>
    );
  }

  if (!newestSpider) {
    return null;
  }

  const ownerName = ownerProfile?.display_name || `User ${newestSpider.owner_id.slice(0, 8)}`;

  return (
    <section className="container mx-auto px-4 mb-16">
      <div className="flex items-center justify-center gap-2 mb-6">
        <Sparkles className="h-6 w-6 text-primary animate-pulse" />
        <h2 className="text-3xl font-bold">New Spider Spotlight</h2>
      </div>
      
      <Card className="overflow-hidden hover:shadow-xl transition-shadow">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">{newestSpider.nickname}</CardTitle>
            <Badge className={rarityColors[newestSpider.rarity]}>
              {newestSpider.rarity}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground italic">{newestSpider.species}</p>
        </CardHeader>
        
        <CardContent className="p-6">
          <div className="grid md:grid-cols-2 gap-6 items-center">
            {/* Spider Image */}
            <div className="relative aspect-square rounded-xl overflow-hidden bg-muted">
              <img
                src={newestSpider.image_url}
                alt={newestSpider.nickname}
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Spider Info */}
            <div className="space-y-6">
              <div className="text-center">
                <PowerScoreArc score={newestSpider.power_score} size="large" />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-sm text-muted-foreground">Owned by</span>
                  {ownerProfile?.avatar_url && (
                    <img 
                      src={ownerProfile.avatar_url} 
                      alt={ownerName}
                      className="w-6 h-6 rounded-full"
                    />
                  )}
                  <ClickableUsername 
                    userId={newestSpider.owner_id}
                    displayName={ownerName}
                    variant="ghost"
                    className="font-semibold hover:text-primary"
                  />
                </div>
                
                <p className="text-xs text-center text-muted-foreground">
                  Joined the league {new Date(newestSpider.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
};

export default NewSpiderSpotlight;
