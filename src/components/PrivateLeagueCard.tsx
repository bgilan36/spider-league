import { Link } from "react-router-dom";
import { Crown, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PrivateLeagueCardProps {
  league: {
    id: string;
    name: string;
    owner_id: string;
    private_league_members?: { count: number }[];
  };
  currentUserId?: string;
}

const PrivateLeagueCard = ({ league, currentUserId }: PrivateLeagueCardProps) => {
  const memberCount = league.private_league_members?.[0]?.count ?? 1;
  const isOwner = currentUserId === league.owner_id;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <h3 className="truncate font-semibold">{league.name}</h3>
            {isOwner && <Badge variant="secondary" className="gap-1"><Crown className="h-3 w-3" />Owner</Badge>}
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {memberCount} member{memberCount === 1 ? "" : "s"}
          </div>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to={`/leagues/${league.id}`}>Open pod</Link>
        </Button>
      </CardContent>
    </Card>
  );
};

export default PrivateLeagueCard;
