import { Flame, Snowflake, Trophy, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Standing {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  wins: number;
  losses: number;
  battles: number;
  win_rate: number;
  streak: number;
  top_spider: any;
}

interface PrivateLeagueStandingsProps {
  standings: Standing[];
  timeframe: "weekly" | "all_time";
  onTimeframeChange: (value: "weekly" | "all_time") => void;
}

const PrivateLeagueStandings = ({ standings, timeframe, onTimeframeChange }: PrivateLeagueStandingsProps) => {
  const hasBattles = standings.some((standing) => standing.battles > 0);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-5 w-5 text-primary" />
          Pod standings
        </CardTitle>
        <Tabs value={timeframe} onValueChange={(v) => onTimeframeChange(v as "weekly" | "all_time")}>
          <TabsList>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="all_time">All time</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {!hasBattles ? (
          <div className="py-8 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <h3 className="font-semibold">No {timeframe === "weekly" ? "battles this week" : "battles yet"}.</h3>
            <p className="text-sm text-muted-foreground">
              {timeframe === "weekly" ? "Try All time, or kick off a pod battle." : "Invite friends, then battle inside this pod."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {standings.map((standing, index) => {
              const topSpider = standing.top_spider && Object.keys(standing.top_spider).length > 0 ? standing.top_spider : null;
              const streak = standing.streak ?? 0;
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
                  <div className="grid grid-cols-4 gap-2 text-center text-xs sm:gap-4">
                    <div><div className="font-bold text-foreground">{standing.wins}</div><div className="text-muted-foreground">W</div></div>
                    <div><div className="font-bold text-foreground">{standing.losses}</div><div className="text-muted-foreground">L</div></div>
                    <div>
                      <div className={`flex items-center justify-center gap-1 font-bold ${streak > 0 ? "text-primary" : streak < 0 ? "text-destructive" : "text-foreground"}`}>
                        {streak > 0 && <Flame className="h-3 w-3" />}
                        {streak < 0 && <Snowflake className="h-3 w-3" />}
                        {streak === 0 ? "—" : Math.abs(streak)}
                      </div>
                      <div className="text-muted-foreground">Streak</div>
                    </div>
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
