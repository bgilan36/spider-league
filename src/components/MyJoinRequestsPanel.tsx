import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, Loader2, XCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";

interface JoinRequestRow {
  id: string;
  league_id: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  message: string | null;
  created_at: string;
  responded_at: string | null;
  private_leagues?: { id: string; name: string; slug: string | null } | null;
}

const statusMeta: Record<string, { label: string; icon: any; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  pending: { label: "Pending", icon: Clock, variant: "secondary" },
  approved: { label: "Approved", icon: CheckCircle2, variant: "default" },
  rejected: { label: "Rejected", icon: XCircle, variant: "destructive" },
  cancelled: { label: "Cancelled", icon: X, variant: "outline" },
};

const MyJoinRequestsPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<JoinRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("private_league_join_requests")
      .select("id,league_id,status,message,created_at,responded_at,private_leagues(id,name,slug)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Couldn't load your requests", description: error.message, variant: "destructive" });
    } else {
      setRows((data || []) as JoinRequestRow[]);
    }
    setLoading(false);
  }, [user, toast]);

  useEffect(() => { load(); }, [load]);

  const cancel = async (id: string) => {
    setCancelingId(id);
    const { error } = await (supabase as any).rpc("cancel_join_request", { p_request_id: id });
    setCancelingId(null);
    if (error) {
      toast({ title: "Couldn't cancel", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Request cancelled" });
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: "cancelled" } : r)));
  };

  if (!user) return null;
  if (!loading && rows.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Your join requests</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          rows.map((r) => {
            const meta = statusMeta[r.status] || statusMeta.pending;
            const Icon = meta.icon;
            const podName = r.private_leagues?.name || "Unknown pod";
            return (
              <div key={r.id} className="flex items-center gap-3 rounded-md border border-border p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {r.status === "approved" && r.private_leagues?.id ? (
                      <Link to={`/leagues/${r.private_leagues.id}`} className="truncate font-medium hover:underline">
                        {podName}
                      </Link>
                    ) : (
                      <span className="truncate font-medium">{podName}</span>
                    )}
                    <Badge variant={meta.variant} className="gap-1">
                      <Icon className="h-3 w-3" />
                      {meta.label}
                    </Badge>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Sent {new Date(r.created_at).toLocaleDateString()}
                    {r.responded_at && r.status !== "pending" && r.status !== "cancelled" && (
                      <> · {meta.label.toLowerCase()} {new Date(r.responded_at).toLocaleDateString()}</>
                    )}
                  </div>
                </div>
                {r.status === "pending" && (
                  <Button variant="outline" size="sm" onClick={() => cancel(r.id)} disabled={cancelingId === r.id}>
                    {cancelingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel"}
                  </Button>
                )}
                {r.status === "approved" && r.private_leagues?.id && (
                  <Button size="sm" asChild>
                    <Link to={`/leagues/${r.private_leagues.id}`}>Open</Link>
                  </Button>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};

export default MyJoinRequestsPanel;
