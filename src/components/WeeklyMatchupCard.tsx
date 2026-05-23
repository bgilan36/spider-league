import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Swords } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";

interface MatchupRow {
  id: string;
  user_a_id: string;
  user_b_id: string;
  pod_league_id: string | null;
  created_at: string;
}

interface OpponentProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  rating_elo: number | null;
}

interface Props {
  podLeagueId?: string | null;
  className?: string;
}

/**
 * Shows the current logged-in user's weekly head-to-head matchup
 * for either the public league (podLeagueId = null/undefined) or a specific pod.
 */
export default function WeeklyMatchupCard({ podLeagueId = null, className }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [opponent, setOpponent] = useState<OpponentProfile | null>(null);
  const [matchup, setMatchup] = useState<MatchupRow | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Find current week
      const nowIso = new Date().toISOString();
      const { data: week } = await supabase
        .from("weeks").select("id")
        .lte("start_date", nowIso).gte("end_date", nowIso)
        .order("start_date", { ascending: false }).limit(1).maybeSingle();
      if (!week) { if (!cancelled) { setLoading(false); setMatchup(null); } return; }

      let q = supabase
        .from("matchups").select("id, user_a_id, user_b_id, pod_league_id, created_at")
        .eq("week_id", week.id)
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .limit(1);
      q = podLeagueId
        ? q.eq("pod_league_id", podLeagueId)
        : q.is("pod_league_id", null);

      const { data: m } = await q.maybeSingle();
      if (cancelled) return;
      if (!m) { setMatchup(null); setLoading(false); return; }
      setMatchup(m as MatchupRow);

      const opponentId = m.user_a_id === user.id ? m.user_b_id : m.user_a_id;
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, rating_elo")
        .eq("id", opponentId).maybeSingle();
      if (!cancelled) {
        setOpponent(prof as OpponentProfile);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, podLeagueId]);

  if (!user || loading || !matchup || !opponent) return null;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Swords className="h-5 w-5 text-primary" />
          This Week's Matchup
          {podLeagueId && <Badge variant="secondary" className="ml-2">Pod</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        {opponent.avatar_url ? (
          <img
            src={opponent.avatar_url}
            alt={opponent.display_name ?? "Opponent"}
            className="h-12 w-12 rounded-full object-cover border border-border"
          />
        ) : (
          <div className="h-12 w-12 rounded-full bg-muted" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm text-muted-foreground">You face</div>
          <div className="font-semibold truncate">
            {opponent.display_name ?? "Anonymous Player"}
          </div>
          {opponent.rating_elo != null && (
            <div className="text-xs text-muted-foreground">
              Rating {opponent.rating_elo}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}