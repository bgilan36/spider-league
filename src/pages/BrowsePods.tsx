import React, { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Clock, Loader2, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import PodThumbnail from "@/components/PodThumbnail";

interface DiscoverablePod {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  created_at: string;
  member_count: number;
  is_member: boolean;
  has_pending_request: boolean;
}

const BrowsePods: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pods, setPods] = useState<DiscoverablePod[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("list_discoverable_pods");
    if (error) {
      toast({ title: "Couldn't load pods", description: error.message, variant: "destructive" });
    } else {
      setPods((data || []) as DiscoverablePod[]);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleRequest = async (pod: DiscoverablePod) => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setPendingId(pod.id);
    const { error } = await (supabase as any).rpc("request_to_join_pod", { p_league_id: pod.id });
    setPendingId(null);
    if (error) {
      toast({ title: "Request failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Request sent", description: `The commissioner of ${pod.name} will review your request.` });
    setPods((prev) => prev.map((p) => p.id === pod.id ? { ...p, has_pending_request: true } : p));
  };

  const filtered = pods.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <main className="container mx-auto px-4 py-6">
      <Helmet>
        <title>Browse Pods — Spider League</title>
        <meta name="description" content="Discover public Spider League friend pods and request to join." />
      </Helmet>

      <div className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/pods"><ArrowLeft className="h-4 w-4 mr-1" />Pods</Link>
        </Button>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">Browse</span>
      </div>

      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">Browse pods</h1>
        <p className="text-muted-foreground">Find an open pod and ask its commissioner to let you in.</p>
      </div>

      <div className="mb-4 relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search pods by name"
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          {pods.length === 0 ? "No public pods yet. Create one and invite friends!" : "No pods match your search."}
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((pod) => (
            <Card key={pod.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <PodThumbnail imageUrl={pod.image_url} podName={pod.name} size={56} />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold truncate">{pod.name}</h3>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {pod.member_count} {pod.member_count === 1 ? "member" : "members"}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  {pod.is_member ? (
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <Link to={`/leagues/${pod.id}`}>Open pod</Link>
                    </Button>
                  ) : pod.has_pending_request ? (
                    <Button disabled variant="outline" size="sm" className="w-full">
                      <Clock className="h-4 w-4" />Request pending
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => handleRequest(pod)}
                      disabled={pendingId === pod.id}
                    >
                      {pendingId === pod.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Ask to join
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
};

export default BrowsePods;