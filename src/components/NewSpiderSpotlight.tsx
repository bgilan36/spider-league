import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import PowerScoreArc from "@/components/PowerScoreArc";
import ClickableUsername from "@/components/ClickableUsername";
import SpiderDetailsModal from "@/components/SpiderDetailsModal";
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
  hit_points: number;
  damage: number;
  speed: number;
  defense: number;
  venom: number;
  webcraft: number;
  special_attacks?: any;
  is_approved: boolean;
}

interface Profile {
  display_name: string | null;
  avatar_url: string | null;
}

const NewSpiderSpotlight = () => {
  const [newestSpider, setNewestSpider] = useState<Spider | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
        .neq("species", "Spider League Starter Spider")
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
      <section className="container mx-auto px-4 mb-12 flex justify-center">
        <div className="max-w-sm w-full">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">New Spider Spotlight</h2>
          </div>
          <Card className="rounded-3xl">
            <CardContent className="flex items-center justify-center p-8">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  if (!newestSpider) {
    return null;
  }

  const ownerName = ownerProfile?.display_name || `User ${newestSpider.owner_id.slice(0, 8)}`;

  return (
    <section className="container mx-auto px-4 mb-12 flex justify-center">
      <div className="max-w-sm w-full">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-primary animate-pulse" />
          <h2 className="text-xl font-bold">New Spider Spotlight</h2>
        </div>
        
        <Card className="overflow-hidden hover:shadow-xl transition-all rounded-3xl cursor-pointer" onClick={() => setIsModalOpen(true)}>
          <CardContent className="p-6">
            <div className="flex flex-col items-center space-y-4">
              {/* Circular Spider Image */}
              <div className="relative w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5 ring-4 ring-primary/20">
                <img
                  src={newestSpider.image_url}
                  alt={newestSpider.nickname}
                  className="w-full h-full object-cover"
                />
              </div>
              
              {/* Spider Name & Rarity */}
              <div className="text-center space-y-1">
                <div className="flex items-center justify-center gap-2">
                  <h3 className="text-lg font-bold">{newestSpider.nickname}</h3>
                  <Badge className={`${rarityColors[newestSpider.rarity]} text-xs`}>
                    {newestSpider.rarity}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground italic">{newestSpider.species}</p>
              </div>
              
              {/* Power Score */}
              <div className="scale-75">
                <PowerScoreArc score={newestSpider.power_score} size="large" />
              </div>
              
              {/* Owner Info */}
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xs text-muted-foreground">Owned by</span>
                  {ownerProfile?.avatar_url && (
                    <img 
                      src={ownerProfile.avatar_url} 
                      alt={ownerName}
                      className="w-5 h-5 rounded-full"
                    />
                  )}
                  <ClickableUsername 
                    userId={newestSpider.owner_id}
                    displayName={ownerName}
                    variant="ghost"
                    className="text-sm font-semibold hover:text-primary"
                  />
                </div>
                
                <p className="text-xs text-center text-muted-foreground">
                  Joined {new Date(newestSpider.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {newestSpider && (
        <SpiderDetailsModal
          spider={newestSpider}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </section>
  );
};

export default NewSpiderSpotlight;
