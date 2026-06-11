import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface JoinRequest {
  id: string;
  user_id: string;
  message: string | null;
  created_at: string;
  profiles?: { display_name: string | null; avatar_url: string | null } | null;
}

interface Props {
  leagueId: string;
  onApproved?: () => void;
}

const PodJoinRequestsPanel = ({ leagueId, onApproved }: Props) => {
  const { toast } = useToast();
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("private_league_join_requests")
      .select("id,user_id,message,created_at,profiles(display_name,avatar_url)")
      .eq("league_id", leagueId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) {
      toast({ title: "Couldn't load requests", description: error.message, variant: "destructive" });
    } else {
      setRequests((data || []) as JoinRequest[]);
    }
    setLoading(false);
  }, [leagueId, toast]);

  useEffect(() => { load(); }, [load]);

  const respond = async (id: string, approve: boolean) => {
    setActingId(id);
    const { error } = await (supabase as any).rpc("respond_to_join_request", {
      p_request_id: id,
      p_approve: approve,
    });
    setActingId(null);
    if (error) {
      toast({ title: "Action failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: approve ? "Member added" : "Request rejected" });
    setRequests((prev) => prev.filter((r) => r.id !== id));
    if (approve) onApproved?.();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserPlus className="h-5 w-5 text-primary" />
          Join requests
          {requests.length > 0 && <Badge variant="secondary">{requests.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending requests.</p>
        ) : (
          requests.map((req) => (
            <div key={req.id} className="flex items-center gap-3 rounded-md border border-border p-3">
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-muted">
                {req.profiles?.avatar_url ? (
                  <img src={req.profiles.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span>{(req.profiles?.display_name || "P").charAt(0)}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                  {req.profiles?.display_name || `Player ${req.user_id.slice(0, 6)}`}
                </div>
                {req.message && (
                  <div className="truncate text-xs text-muted-foreground">"{req.message}"</div>
                )}
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => respond(req.id, false)}
                  disabled={actingId === req.id}
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => respond(req.id, true)}
                  disabled={actingId === req.id}
                >
                  {actingId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default PodJoinRequestsPanel;