import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, Gift, Copy, Sparkles, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { toast } from "sonner";

interface Progress {
  qualified_count: number;
  pending_count: number;
  current_tier: string | null;
  next_tier: string | null;
  next_tier_target: number | null;
  extra_slot_expires_at: string | null;
  extra_slot_active: boolean;
}

const tierEmoji: Record<string, string> = {
  "Bronze Recruiter": "🥉",
  "Silver Recruiter": "🥈",
  "Gold Recruiter": "🥇",
  "Legendary Recruiter": "👑",
};

const ReferralProgressCard = () => {
  const { user } = useAuth();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (supabase.rpc as any)("get_referral_progress", { p_user_id: user.id })
      .then(({ data }: any) => setProgress(data as Progress))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;

  const referralLink = `${window.location.origin}/?ref=${user.id}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      toast.success("Referral link copied!");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join me in Spider League",
          text: "Come battle spiders with me — we both get rewards when you fight your first battle!",
          url: referralLink,
        });
        return;
      } catch {
        // fall through to copy
      }
    }
    copyLink();
  };

  const qualified = progress?.qualified_count ?? 0;
  const nextTarget = progress?.next_tier_target ?? null;
  const pct = nextTarget ? Math.min(100, Math.round((qualified / nextTarget) * 100)) : 100;

  const slotExpires = progress?.extra_slot_expires_at
    ? new Date(progress.extra_slot_expires_at)
    : null;
  const slotDaysLeft = slotExpires
    ? Math.max(0, Math.ceil((slotExpires.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Recruit Rewards</CardTitle>
          {progress?.current_tier && (
            <Badge variant="secondary" className="ml-auto">
              {tierEmoji[progress.current_tier]} {progress.current_tier}
            </Badge>
          )}
        </div>
        <CardDescription>
          Invite friends. When they battle for the first time, you both unlock a 6th
          active roster slot for 30 days and earn recruiter badges.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="h-20 animate-pulse rounded bg-muted/40" />
        ) : (
          <>
            {progress?.next_tier ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {qualified} of {nextTarget} friends recruited toward{" "}
                    <span className="font-semibold text-foreground">
                      {tierEmoji[progress.next_tier!]} {progress.next_tier}
                    </span>
                  </span>
                  <span className="font-medium">{pct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Sparkles className="h-4 w-4" />
                You've reached the top tier — Legendary Recruiter!
              </div>
            )}

            {(progress?.pending_count ?? 0) > 0 && (
              <p className="text-xs text-muted-foreground">
                {progress!.pending_count} friend{progress!.pending_count === 1 ? "" : "s"} signed
                up — waiting for their first battle to count.
              </p>
            )}

            <div
              className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
                progress?.extra_slot_active
                  ? "border-green-500/40 bg-green-500/10"
                  : "border-dashed border-muted-foreground/30 bg-muted/20 text-muted-foreground"
              }`}
            >
              {progress?.extra_slot_active ? (
                <>
                  <Gift className="h-4 w-4 text-green-500" />
                  <span>
                    <strong>Bonus 6th roster slot active</strong> —{" "}
                    {slotDaysLeft} day{slotDaysLeft === 1 ? "" : "s"} left
                  </span>
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4" />
                  <span>No bonus slot active. Recruit a friend to unlock one for 30 days.</span>
                </>
              )}
            </div>

            <div className="flex gap-2">
              <Button onClick={shareLink} className="flex-1 gap-2">
                <Users className="h-4 w-4" />
                Share your link
              </Button>
              <Button variant="outline" size="icon" onClick={copyLink} aria-label="Copy link">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="break-all rounded bg-muted/30 p-2 text-xs text-muted-foreground">
              {referralLink}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ReferralProgressCard;