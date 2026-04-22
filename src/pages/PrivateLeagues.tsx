import { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import CreatePrivateLeagueButton from "@/components/CreatePrivateLeagueButton";
import PrivateLeagueCard from "@/components/PrivateLeagueCard";

const PrivateLeagues = () => {
  const { user, loading: authLoading } = useAuth();
  const [leagues, setLeagues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeagues = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("private_leagues")
      .select("id,name,owner_id,private_league_members(count)")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    setLeagues(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) fetchLeagues();
    if (!authLoading && !user) setLoading(false);
  }, [authLoading, user, fetchLeagues]);

  if (!authLoading && !user) {
    return (
      <main className="container mx-auto px-4 py-10">
        <Card><CardContent className="py-10 text-center"><Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" /><h1 className="mb-2 text-2xl font-bold">Friend pods need sign-in</h1><p className="mb-4 text-muted-foreground">Sign in to create or join private leagues.</p><Button asChild><Link to="/auth">Sign in</Link></Button></CardContent></Card>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-6">
      <Helmet><title>Friend Pods — Spider League</title><meta name="description" content="Create private Spider League pods for your group chat." /></Helmet>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><Button asChild variant="ghost" size="sm" className="mb-2"><Link to="/"><ArrowLeft className="h-4 w-4" />Home</Link></Button><h1 className="text-3xl font-bold">Your pods</h1><p className="text-muted-foreground">Beat your friends, not a giant global ladder.</p></div>
        <CreatePrivateLeagueButton size="lg" onCreated={fetchLeagues} />
      </div>
      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div> : leagues.length === 0 ? (
        <Card><CardContent className="py-10 text-center"><Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" /><h2 className="mb-2 text-xl font-semibold">No pods yet</h2><p className="mb-4 text-muted-foreground">Create a league from your group chat and settle it in the Web Cage.</p><CreatePrivateLeagueButton onCreated={fetchLeagues} /></CardContent></Card>
      ) : <div className="space-y-3">{leagues.map((league) => <PrivateLeagueCard key={league.id} league={league} currentUserId={user?.id} />)}</div>}
    </main>
  );
};

export default PrivateLeagues;
