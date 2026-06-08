import { Loader2, Trophy, Users, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Standing {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  wins: number;
  losses: number;
  battles: number;
  win_rate: number;
  streak: number;
  power_diff?: number;
  top_spider: any;
}

interface PrivateLeagueStandingsProps {
  standings: Standing[];
  timeframe: "weekly" | "all_time";
  onTimeframeChange: (value: "weekly" | "all_time") => void;
  loading?: boolean;
  refreshing?: boolean;
}

const PrivateLeagueStandings = ({
  standings,
  timeframe,
  onTimeframeChange,
  loading = false,
  refreshing = false,
}: PrivateLeagueStandingsProps) => {
  const hasBattles = standings.some((standing) => standing.battles > 0);

  // PCT in MLB style (e.g. .643), no leading zero
  const formatPct = (wins: number, losses: number) => {
    const total = wins + losses;
    if (total === 0) return ".000";
    const pct = wins / total;
    return pct.toFixed(3).replace(/^0/, "");
  };

  // Games Behind: ((leaderW - W) + (L - leaderL)) / 2, "—" for the leader
  const computeGB = (s: Standing, leader: Standing | undefined) => {
    if (!leader) return "—";
    if (s.user_id === leader.user_id) return "—";
    const gb = ((leader.wins - s.wins) + (s.losses - leader.losses)) / 2;
    if (gb <= 0) return "—";
    return Number.isInteger(gb) ? gb.toFixed(0) : gb.toFixed(1);
  };

  // STRK: W3, L2, "—" for none
  const formatStreak = (streak: number) => {
    if (!streak) return "—";
    return `${streak > 0 ? "W" : "L"}${Math.abs(streak)}`;
  };

  // DIFF: signed integer with sign and color
  const formatDiff = (diff: number) => {
    if (!diff) return "0";
    const sign = diff > 0 ? "+" : "";
    return `${sign}${diff}`;
  };

  const leader = standings[0];

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-5 w-5 text-primary" />
          Pod standings
          {refreshing && !loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label="Refreshing" />
          ) : null}
        </CardTitle>
        <Tabs value={timeframe} onValueChange={(v) => onTimeframeChange(v as "weekly" | "all_time")}>
          <TabsList>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="all_time">All time</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {loading && standings.length === 0 ? (
          <StandingsSkeleton />
        ) : !hasBattles ? (
          <div className="py-8 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <h3 className="font-semibold">No {timeframe === "weekly" ? "battles this week" : "battles yet"}.</h3>
            <p className="text-sm text-muted-foreground">
              {timeframe === "weekly" ? "Try All time, or kick off a pod battle." : "Invite friends, then battle inside this pod."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm tabular-nums">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 py-2 text-left font-medium">Team</th>
                  <th className="px-2 py-2 text-right font-medium">
                    <Tooltip>
                      <TooltipTrigger className="inline-flex items-center gap-1 cursor-help">
                        WPD <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-center">
                        Win Point Differential — earn points only by beating higher-power opponents; lose points only when a stronger spider of yours loses to a weaker one. Primary standings sort.
                      </TooltipContent>
                    </Tooltip>
                  </th>
                  <th className="px-2 py-2 text-right font-medium">W</th>
                  <th className="px-2 py-2 text-right font-medium">L</th>
                  <th className="px-2 py-2 text-right font-medium">PCT</th>
                  <th className="px-2 py-2 text-right font-medium">GB</th>
                  <th className="px-2 py-2 text-right font-medium">STRK</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((standing, index) => {
                  const diff = standing.power_diff ?? 0;
                  return (
                    <tr
                      key={standing.user_id}
                      className="border-b border-border/60 last:border-b-0 hover:bg-muted/40"
                    >
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-3">
                          <span className="w-5 shrink-0 text-right text-xs font-semibold text-muted-foreground">
                            {index + 1}
                          </span>
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                            {standing.avatar_url ? (
                              <img src={standing.avatar_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-xs font-semibold">
                                {(standing.display_name || "P").charAt(0)}
                              </span>
                            )}
                          </div>
                          <span className="truncate font-medium">
                            {standing.display_name || `Player ${standing.user_id.slice(0, 6)}`}
                          </span>
                        </div>
                      </td>
                      <td
                        className={`px-2 py-2 text-right font-semibold ${
                          diff > 0 ? "text-primary" : diff < 0 ? "text-destructive" : "text-foreground"
                        }`}
                      >
                        {formatDiff(diff)}
                      </td>
                      <td className="px-2 py-2 text-right">{standing.wins}</td>
                      <td className="px-2 py-2 text-right">{standing.losses}</td>
                      <td className="px-2 py-2 text-right">{formatPct(standing.wins, standing.losses)}</td>
                      <td className="px-2 py-2 text-right text-muted-foreground">
                        {computeGB(standing, leader)}
                      </td>
                      <td
                        className={`px-2 py-2 text-right font-medium ${
                          standing.streak > 0
                            ? "text-primary"
                            : standing.streak < 0
                            ? "text-destructive"
                            : "text-muted-foreground"
                        }`}
                      >
                        {formatStreak(standing.streak ?? 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PrivateLeagueStandings;

const StandingsSkeleton = () => (
  <div className="overflow-x-auto">
    <table className="w-full border-collapse text-sm tabular-nums">
      <thead>
        <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
          <th className="px-2 py-2 text-left font-medium">Team</th>
          <th className="px-2 py-2 text-right font-medium">WPD</th>
          <th className="px-2 py-2 text-right font-medium">W</th>
          <th className="px-2 py-2 text-right font-medium">L</th>
          <th className="px-2 py-2 text-right font-medium">PCT</th>
          <th className="px-2 py-2 text-right font-medium">GB</th>
          <th className="px-2 py-2 text-right font-medium">STRK</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: 4 }).map((_, i) => (
          <tr key={i} className="border-b border-border/60 last:border-b-0">
            <td className="px-2 py-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-3 w-3" />
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-28" />
              </div>
            </td>
            {Array.from({ length: 6 }).map((__, j) => (
              <td key={j} className="px-2 py-2 text-right">
                <Skeleton className="ml-auto h-4 w-8" />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
