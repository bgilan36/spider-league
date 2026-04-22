import { Trophy, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Standing {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  wins: number;
  losses: number;
  battles: number;
  win_rate: number;
  top_spider: any;
}

interface PrivateLeagueStandingsProps {
  standings: Standing[];
}

const PrivateLeagueStandings = ({ standings }: PrivateLeagueStandingsProps) => {
  const hasBattles = standings.some((standing) => standing.battles > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-5 w-5 text-primary" />
          Pod standings
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasBattles ? (
          <div className="py-8 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <h3 className="font-semibold">No one’s battled yet.</h3>
            <p className="text-sm text-muted-foreground">Invite friends, then battle inside this pod.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {standings.map((standing, index) => {
              const topSpider = standing.top_spider && Object.keys(standing.top_spider).length > 0 ? standing.top_spider : null;
              return (
                <div key={standing.user_id} className="flex items-center gap-3 rounded-md border border-border p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-bold">#{index + 1}</div>
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted">
                    {standing.avatar_url ? <img src={standing.avatar_url} alt="" className="h-full w-full object-cover" /> : <span className="font-semibold">{(standing.display_name || "P").charAt(0)}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{standing.display_name || `Player ${standing.user_id.slice(0, 6)}`}</div>
                    <div className="truncate text-xs text-muted-foreground">{topSpider ? `Top spider: ${topSpider.nickname} (${topSpider.power_score})` : "No active spider yet"}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs sm:gap-4">
                    <div><div className="font-bold text-foreground">{standing.wins}</div><div className="text-muted-foreground">W</div></div>
                    <div><div className="font-bold text-foreground">{standing.losses}</div><div className="text-muted-foreground">L</div></div>
                    <div><Badge variant="outline">{standing.win_rate}%</Badge></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PrivateLeagueStandings;
