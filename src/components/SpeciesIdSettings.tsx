import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";

/** Admin panel: tune when species ID escalates to the slower, stronger model + view feedback accuracy. */
export default function SpeciesIdSettings() {
  const [minConfidence, setMinConfidence] = useState(70);
  const [minMargin, setMinMargin] = useState(10);
  const [enabled, setEnabled] = useState(true);
  const [stats, setStats] = useState<{ total: number; correct: number; byTier: Record<string, [number, number]> } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("species_id_config").select("*").eq("id", 1).maybeSingle();
      if (data) { setMinConfidence(data.min_confidence); setMinMargin(data.min_margin); setEnabled(data.escalation_enabled); }
      const { data: fb } = await supabase.from("species_id_feedback").select("is_correct, tier_used").neq("confirmed_species", "unknown").limit(1000);
      if (fb) {
        const byTier: Record<string, [number, number]> = {};
        let correct = 0;
        for (const r of fb) {
          const t = r.tier_used ?? "unknown";
          byTier[t] ??= [0, 0];
          byTier[t][1]++;
          if (r.is_correct) { byTier[t][0]++; correct++; }
        }
        setStats({ total: fb.length, correct, byTier });
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n || 0)));
    const { error } = await supabase.from("species_id_config")
      .update({ min_confidence: clamp(minConfidence), min_margin: clamp(minMargin), escalation_enabled: enabled, updated_at: new Date().toISOString() })
      .eq("id", 1);
    setSaving(false);
    toast({ title: error ? "Save failed" : "Thresholds saved", description: error?.message });
  };

  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

  return (
    <Card>
      <CardHeader><CardTitle>Species identification tuning</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="esc">Escalate uncertain photos to the stronger model</Label>
          <Switch id="esc" checked={enabled} onCheckedChange={setEnabled} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Escalate if top match below (%)</Label>
            <Input type="number" min={0} max={100} value={minConfidence} onChange={(e) => setMinConfidence(Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label>…or top-2 gap below (pts)</Label>
            <Input type="number" min={0} max={100} value={minMargin} onChange={(e) => setMinMargin(Number(e.target.value))} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Lower numbers = faster, fewer escalations. Higher = more accurate, slower.</p>
        <Button onClick={save} disabled={saving}>Save</Button>

        {stats && (
          <div className="border-t pt-3 text-sm space-y-1">
            <p className="font-medium">User feedback: {stats.total} answers, {pct(stats.correct, stats.total)} correct</p>
            {Object.entries(stats.byTier).map(([t, [c, n]]) => (
              <p key={t} className="text-muted-foreground">{t}: {pct(c, n)} correct ({n})</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
