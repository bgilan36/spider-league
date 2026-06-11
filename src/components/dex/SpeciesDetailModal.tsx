import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skull } from "lucide-react";
import type { DexEntry } from "@/lib/spiderDex/useSpeciesProgress";

interface Props {
  entry: DexEntry | null;
  open: boolean;
  onClose: () => void;
}

/**
 * Full history of one species: every spider the user has ever caught
 * of this species, retired alongside active.
 */
export default function SpeciesDetailModal({ entry, open, onClose }: Props) {
  if (!entry) return null;
  const def = entry.species;
  const now = Date.now();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{entry.commonName}</DialogTitle>
          {def && (
            <div className="text-xs italic text-muted-foreground">
              {def.scientificName} · <span className="not-italic">{def.family}</span>
            </div>
          )}
        </DialogHeader>

        {def && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            {def.hint} <span className="text-xs ml-1">({def.region})</span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 text-center my-3">
          <Stat label="Caught" value={entry.count} />
          <Stat label="Best Power" value={entry.bestPower} />
          <Stat label="Retired" value={entry.catches.filter((s) => !!s.eligible_until && new Date(s.eligible_until).getTime() < now).length} />
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Catch history</h3>
          <div className="grid sm:grid-cols-2 gap-2">
            {entry.catches.map((s) => {
              const retired = !!s.eligible_until && new Date(s.eligible_until).getTime() < now;
              return (
                <div key={s.id} className="flex items-center gap-3 p-2 rounded-md border bg-card">
                  <img src={s.image_url} alt={s.nickname} className="w-12 h-12 rounded object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm font-medium truncate">
                      {s.nickname}
                      {retired && (
                        <Badge variant="outline" className="h-4 px-1 text-[10px] gap-0.5">
                          <Skull className="h-2.5 w-2.5" /> Retired
                        </Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Power {s.power_score} · HP {s.hit_points} · DMG {s.damage} · SPD {s.speed}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      VNM {s.venom} · WEB {s.webcraft} · DEF {s.defense}
                    </div>
                  </div>
                </div>
              );
            })}
            {entry.catches.length === 0 && (
              <div className="col-span-full text-sm text-muted-foreground text-center py-6">
                You haven't caught one of these yet. {def?.hint}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-2">
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}