import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, Loader2, Swords, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PodThumbnail from "@/components/PodThumbnail";
import PrivateLeagueStandings from "@/components/PrivateLeagueStandings";

export interface PodMember {
  user_id: string;
  role?: string;
  profiles?: { display_name?: string | null; avatar_url?: string | null } | null;
}

export interface PodRecentBattle {
  id: string;
  created_at: string;
  winner: string | null;
  team_a: any;
  team_b: any;
}

interface PrimaryPodPanelProps {
  pod: { id: string; name: string; image_url?: string | null; member_count: number };
  members: PodMember[];
  standings: any[];
  recentBattles: PodRecentBattle[];
  timeframe: "weekly" | "all_time";
  onTimeframeChange: (value: "weekly" | "all_time") => void;
  loading: boolean;
}

const getSpider = (team: any) => team?.spider ?? team?.[0] ?? null;

const PrimaryPodPanel = ({
  pod,
  members,
  standings,
  recentBattles,
  timeframe,
  onTimeframeChange,
  loading,
}: PrimaryPodPanelProps) => {
  return (
    <div className="space-y-4">
      <Card className="border-primary/30">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <PodThumbnail imageUrl={pod.image_url} podName={pod.name} className="h-16 w-16" iconClassName="h-6 w-6" />
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-bold">{pod.name}</h2>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                {pod.member_count} {pod.member_count === 1 ? "member" : "members"}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to={`/leagues/${pod.id}`}>
                <Swords className="h-4 w-4" />
                Battle a member
              </Link>
            </Button>
            <Button asChild>
              <Link to={`/leagues/${pod.id}`}>
                Open pod
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <PrivateLeagueStandings standings={standings} timeframe={timeframe} onTimeframeChange={onTimeframeChange} />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="h-5 w-5 text-primary" />
                Recent pod battles
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentBattles.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">
                  No pod battles yet. Open the pod and challenge a member to kick things off.
                </p>
              ) : (
                <ul className="space-y-2">
                  {recentBattles.map((battle) => {
                    const spiderA = getSpider(battle.team_a);
                    const spiderB = getSpider(battle.team_b);
                    const winnerSide = battle.winner;
                    const winnerSpider = winnerSide === "A" ? spiderA : winnerSide === "B" ? spiderB : null;
                    const loserSpider = winnerSide === "A" ? spiderB : winnerSide === "B" ? spiderA : null;
                    return (
                      <li key={battle.id}>
                        <Link
                          to={`/battle/${battle.id}`}
                          className="group flex items-center gap-3 rounded-md border border-border p-2 transition hover:border-primary/60 hover:bg-primary/5"
                        >
                          <div className="flex items-center gap-2">
                            {spiderA?.image_url && (
                              <img src={spiderA.image_url} alt={spiderA.nickname || "Spider"} className="h-10 w-10 rounded object-cover" />
                            )}
                            <span className="text-xs text-muted-foreground">vs</span>
                            {spiderB?.image_url && (
                              <img src={spiderB.image_url} alt={spiderB.nickname || "Spider"} className="h-10 w-10 rounded object-cover" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">
                              {winnerSpider?.nickname || "Spider"} defeated {loserSpider?.nickname || "opponent"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(battle.created_at), { addSuffix: true })}
                            </div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-primary" />
                Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {members.map((member) => (
                  <div key={member.user_id} className="flex items-center gap-2 rounded-full border border-border bg-background/50 py-1 pl-1 pr-3">
                    <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-semibold">
                      {member.profiles?.avatar_url ? (
                        <img src={member.profiles.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span>{(member.profiles?.display_name || "P").charAt(0)}</span>
                      )}
                    </div>
                    <span className="text-sm">
                      {member.profiles?.display_name || `Player ${member.user_id.slice(0, 6)}`}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default PrimaryPodPanel;