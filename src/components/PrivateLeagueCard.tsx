import { Link } from "react-router-dom";
import { ArrowRight, Crown, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PodThumbnail from "@/components/PodThumbnail";

interface PrivateLeagueCardProps {
  league: {
    id: string;
    name: string;
    owner_id: string;
    image_url?: string | null;
    private_league_members?: { count: number }[];
  };
  currentUserId?: string;
}

const PrivateLeagueCard = ({ league, currentUserId }: PrivateLeagueCardProps) => {
  const memberCount = league.private_league_members?.[0]?.count ?? 1;
  const isOwner = currentUserId === league.owner_id;

  return (
    <Link
      to={`/leagues/${league.id}`}
      className="group block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="transition-all hover:border-primary/60 hover:shadow-md">
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <PodThumbnail imageUrl={league.image_url} podName={league.name} className="h-12 w-12" iconClassName="h-5 w-5" />
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <h3 className="truncate font-semibold group-hover:text-primary">{league.name}</h3>
              {isOwner && <Badge variant="secondary" className="gap-1"><Crown className="h-3 w-3" />Commissioner</Badge>}
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              {memberCount} member{memberCount === 1 ? "" : "s"}
            </div>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
        </CardContent>
      </Card>
    </Link>
  );
};

export default PrivateLeagueCard;
