import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X } from "lucide-react";

interface Candidate { species: string; confidence: number }

interface Props {
  predictedSpecies: string;
  predictedConfidence?: number;
  tierUsed?: string | null;
  candidates: Candidate[];
}

/** Quick "Did we get it right?" prompt that logs feedback for model tuning. */
export default function SpeciesFeedback({ predictedSpecies, predictedConfidence, tierUsed, candidates }: Props) {
  const [mode, setMode] = useState<"ask" | "pick" | "done">("ask");
  const [other, setOther] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setMode("ask"); setOther(""); }, [predictedSpecies]);

  const submit = async (confirmed: string) => {
    const value = confirmed.trim().slice(0, 120);
    if (!value) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("species_id_feedback").insert({
        user_id: user.id,
        predicted_species: predictedSpecies,
        predicted_confidence: predictedConfidence ?? null,
        tier_used: tierUsed ?? null,
        candidates: candidates.slice(0, 3).map((c) => ({ species: c.species, confidence: c.confidence })),
        confirmed_species: value,
        is_correct: value.toLowerCase() === predictedSpecies.toLowerCase(),
      });
    }
    setSaving(false);
    setMode("done");
  };

  if (!predictedSpecies) return null;

  if (mode === "done") {
    return <p className="text-xs text-muted-foreground">Thanks — your answer helps improve identification.</p>;
  }

  return (
    <div className="rounded-lg border border-dashed p-3 space-y-2">
      {mode === "ask" ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm flex-1 min-w-0">Is this a <strong>{predictedSpecies}</strong>?</span>
          <Button size="sm" variant="secondary" disabled={saving} onClick={() => submit(predictedSpecies)}>
            <Check className="h-4 w-4 mr-1" /> Yes
          </Button>
          <Button size="sm" variant="outline" disabled={saving} onClick={() => setMode("pick")}>
            <X className="h-4 w-4 mr-1" /> No
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm">What species is it?</p>
          <div className="flex flex-wrap gap-2">
            {candidates.filter((c) => c.species !== predictedSpecies).slice(0, 2).map((c) => (
              <Button key={c.species} size="sm" variant="outline" disabled={saving} onClick={() => submit(c.species)}>
                {c.species}
              </Button>
            ))}
            <Button size="sm" variant="ghost" disabled={saving} onClick={() => submit("unknown")}>Not sure</Button>
          </div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); submit(other); }}>
            <Input value={other} onChange={(e) => setOther(e.target.value)} placeholder="Other species…" maxLength={120} />
            <Button size="sm" type="submit" disabled={saving || !other.trim()}>Send</Button>
          </form>
        </div>
      )}
    </div>
  );
}
