import { useState } from "react";
import { Copy, Loader2, MessageCircle, RefreshCw, Share2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { buildShareText } from "@/components/CreatePrivateLeagueButton";
import { supabase } from "@/integrations/supabase/client";

interface PrivateLeagueInvitePanelProps {
  inviteUrl: string;
  memberCount: number;
  hideHeader?: boolean;
  leagueId?: string;
  canManage?: boolean;
  onInviteGenerated?: (token: string, url: string) => void;
}

const PrivateLeagueInvitePanel = ({
  inviteUrl,
  memberCount,
  hideHeader = false,
  leagueId,
  canManage = false,
  onInviteGenerated,
}: PrivateLeagueInvitePanelProps) => {
  const { toast } = useToast();
  const shareText = buildShareText(inviteUrl);
  const [generating, setGenerating] = useState(false);

  const generateInvite = async (deactivateOthers: boolean) => {
    if (!leagueId) return;
    setGenerating(true);
    try {
      const { data, error } = await (supabase as any).rpc("generate_pod_invite", {
        p_league_id: leagueId,
        p_deactivate_others: deactivateOthers,
      });
      if (error) throw error;
      const token = data?.token as string;
      const url = token ? `${window.location.origin}/join/${token}` : "";
      onInviteGenerated?.(token, url);
      toast({
        title: deactivateOthers ? "New invite link ready" : "Invite link generated",
        description: deactivateOthers
          ? "The previous link has been revoked."
          : "Share it with your friends.",
      });
    } catch (error: any) {
      toast({ title: "Couldn't generate invite", description: error.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join my Spider League pod", text: shareText, url: inviteUrl });
        return;
      } catch (error: any) {
        if (error?.name === "AbortError") return;
      }
    }

    await navigator.clipboard?.writeText(shareText);
    toast({ title: "Invite copied", description: "Paste it into your group chat." });
  };

  const copyInvite = async () => {
    await navigator.clipboard?.writeText(shareText);
    toast({ title: "Invite copied", description: "Paste it into your group chat." });
  };

  const hasInvite = !!inviteUrl;

  const body = (
    <div className="space-y-3">
      {hasInvite ? (
        <>
          <p className="text-sm text-muted-foreground">Reusable link. No account needed until someone chooses to join.</p>
          <div className="break-all rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">{inviteUrl}</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" onClick={nativeShare}><Share2 className="h-4 w-4" />Share</Button>
            <Button type="button" variant="outline" onClick={copyInvite}><Copy className="h-4 w-4" />Copy</Button>
            <Button type="button" variant="outline" asChild>
              <a href={`sms:?&body=${encodeURIComponent(shareText)}`}><MessageCircle className="h-4 w-4" />SMS</a>
            </Button>
            <Button type="button" variant="outline" asChild>
              <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" />WhatsApp</a>
            </Button>
          </div>
          {canManage && leagueId && (
            <div className="rounded-md border border-dashed border-border bg-muted/20 p-3">
              <p className="mb-2 text-xs text-muted-foreground">
                Lost track of who has the link? Generate a fresh one and the old link stops working immediately.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => generateInvite(true)}
                disabled={generating}
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Generate new link
              </Button>
            </div>
          )}
        </>
      ) : canManage && leagueId ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This pod doesn't have an active invite link yet. Generate one to share with friends.
          </p>
          <Button
            type="button"
            className="w-full"
            onClick={() => generateInvite(true)}
            disabled={generating}
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate invite link
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No active invite link. Ask the pod owner to generate one.</p>
      )}
    </div>
  );

  if (hideHeader) return body;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Share2 className="h-5 w-5 text-primary" />
          {memberCount < 2 ? "Invite friends" : "Group-chat invite"}
        </CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
};

export default PrivateLeagueInvitePanel;
