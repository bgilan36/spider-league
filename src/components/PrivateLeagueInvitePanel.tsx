import { Copy, MessageCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { buildShareText } from "@/components/CreatePrivateLeagueButton";

interface PrivateLeagueInvitePanelProps {
  inviteUrl: string;
  memberCount: number;
}

const PrivateLeagueInvitePanel = ({ inviteUrl, memberCount }: PrivateLeagueInvitePanelProps) => {
  const { toast } = useToast();
  const shareText = buildShareText(inviteUrl);

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
    toast({ title: "Invite copied", description: "The share sheet was blocked, so the invite was copied instead." });
  };

  const copyInvite = async () => {
    await navigator.clipboard?.writeText(shareText);
    toast({ title: "Invite copied", description: "Paste it into your group chat." });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Share2 className="h-5 w-5 text-primary" />
          {memberCount < 2 ? "Invite friends" : "Group-chat invite"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
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
      </CardContent>
    </Card>
  );
};

export default PrivateLeagueInvitePanel;
