import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, Loader2, MessageCircle, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";

const buildShareText = (inviteUrl: string) =>
  `🕷️ Join my Spider League for digital battles with real spiders! 🕷️\n\n${inviteUrl}`;

const buildInviteUrl = (inviteToken?: string) =>
  inviteToken ? `${window.location.origin}/join/${inviteToken}` : "";

const getDefaultPodName = (user: ReturnType<typeof useAuth>["user"]) => {
  const displayName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.user_metadata?.name;
  const emailName = user?.email?.split("@")[0];
  const name = String(displayName || emailName || "My").trim();

  return `${name}'s Spider Pod`;
};

interface CreatePrivateLeagueButtonProps {
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
  onCreated?: () => void;
}

const CreatePrivateLeagueButton = ({ variant = "default", size = "default", className, onCreated }: CreatePrivateLeagueButtonProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("My Spider Pod");
  const [loading, setLoading] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [leagueId, setLeagueId] = useState("");

  useEffect(() => {
    if (open && user && !inviteUrl) {
      setName(getDefaultPodName(user));
    }
  }, [inviteUrl, open, user]);

  const createLeague = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("create_private_league_with_invite", { name });
      if (error) throw error;

      const url = buildInviteUrl(data?.invite_token) || data?.invite_url || "";
      setInviteUrl(url);
      setLeagueId(data?.league_id || "");
      onCreated?.();

      toast({ title: "Pod created", description: "Invite link is ready for the group chat." });
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        toast({ title: "Could not create pod", description: error.message, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  const copyInvite = async () => {
    await navigator.clipboard?.writeText(buildShareText(inviteUrl));
    toast({ title: "Invite copied", description: "Paste it into your group chat." });
  };

  const shareInvite = async () => {
    const shareText = buildShareText(inviteUrl);
    if (!navigator.share) {
      await copyInvite();
      return;
    }

    try {
      await navigator.share({ title: "Join my Spider League pod", text: shareText, url: inviteUrl });
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        await copyInvite();
        toast({ title: "Share sheet blocked", description: "Invite copied instead. Paste it into your group chat." });
      }
    }
  };

  const smsUrl = inviteUrl ? `sms:?&body=${encodeURIComponent(buildShareText(inviteUrl))}` : "#";
  const whatsappUrl = inviteUrl ? `https://wa.me/?text=${encodeURIComponent(buildShareText(inviteUrl))}` : "#";

  return (
    <>
      <Button type="button" variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        <Users className="h-4 w-4" />
        Create league from group chat
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Start a friend pod</DialogTitle>
            <DialogDescription>Make a reusable invite link for your group chat.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pod-name">Pod name</Label>
              <Input id="pod-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
            </div>

            <Button type="button" className="w-full" onClick={createLeague} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Create and share
            </Button>

            {inviteUrl && (
              <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
                <div className="text-sm font-medium">Invite the group chat</div>
                <div className="break-all text-xs text-muted-foreground">{inviteUrl}</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Button type="button" variant="outline" size="sm" onClick={shareInvite}>
                    <Send className="h-4 w-4" />
                    Share
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={copyInvite}>
                    <Copy className="h-4 w-4" />
                    Copy
                  </Button>
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a href={smsUrl}><MessageCircle className="h-4 w-4" />SMS</a>
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="sm:col-span-3" asChild>
                    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" />WhatsApp</a>
                  </Button>
                </div>
                {leagueId && (
                  <Button type="button" variant="secondary" className="w-full" onClick={() => navigate(`/leagues/${leagueId}`)}>
                    Open pod
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CreatePrivateLeagueButton;
export { buildShareText };
