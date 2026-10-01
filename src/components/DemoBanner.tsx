import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { RotateCcw, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth/AuthProvider";
import { toast } from "sonner";

/** Shown only to demo accounts: explains isolation and offers a one-tap fresh start. */
const DemoBanner = () => {
  const { isDemo, resetDemo } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  if (!isDemo) return null;

  const handleReset = async () => {
    setBusy(true);
    const { error } = await resetDemo();
    setBusy(false);
    if (error) {
      toast.error("Couldn't restart the demo. Tap “demo access” on the home screen to try again.", { id: "demo-reset" });
      navigate("/", { replace: true });
      return;
    }
    toast.success("Fresh demo started", { id: "demo-reset" });
    navigate("/", { replace: true });
  };

  return (
    <div className="w-full border-b border-border bg-muted/60 text-xs">
      <div className="mx-auto max-w-6xl px-3 py-1.5 flex items-center gap-2 min-w-0">
        <FlaskConical className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          Demo mode — your spiders and battles stay out of rankings and public feeds.
        </span>
        <Button size="sm" variant="ghost" className="h-8 gap-1 shrink-0" onClick={handleReset} disabled={busy}>
          <RotateCcw className="h-3.5 w-3.5" /> {busy ? "Resetting…" : "Reset demo"}
        </Button>
      </div>
    </div>
  );
};

export default DemoBanner;
