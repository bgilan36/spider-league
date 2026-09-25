import { ExternalLink } from "lucide-react";
import { findReference, useSpeciesLibrary } from "@/lib/spiderDex/useSpeciesReference";

interface Props {
  /** Species text from the AI, a scientific name, or a common name. */
  species?: string | null;
  compact?: boolean;
}

/** Real-world reference card (photo, habitat, range, size, key features) to compare against an AI guess. */
export default function SpeciesReferencePanel({ species, compact }: Props) {
  const { data } = useSpeciesLibrary();
  const ref = findReference(data, species);
  if (!ref) return null;

  return (
    <div
      className="mt-2 flex gap-3 rounded-md border border-border bg-muted/40 p-2 text-left"
      onClick={(e) => e.stopPropagation()}
    >
      {ref.image_url && (
        <img
          src={ref.image_url}
          alt={`Reference photo of ${ref.common_name}`}
          loading="lazy"
          className={`${compact ? "h-14 w-14" : "h-20 w-20"} shrink-0 rounded object-cover`}
        />
      )}
      <div className="min-w-0 flex-1 space-y-0.5 text-[11px] leading-snug text-muted-foreground">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-foreground/70">Real reference</div>
        <div><span className="font-medium text-foreground">Looks like:</span> {ref.diagnostic_features}</div>
        {!compact && <div><span className="font-medium text-foreground">Habitat:</span> {ref.habitat}</div>}
        <div>
          <span className="font-medium text-foreground">Range:</span> {ref.us_range} · {ref.size_min_mm}–{ref.size_max_mm} mm
        </div>
        {(ref.image_credit || ref.wikipedia_url) && (
          <div className="truncate text-[10px] opacity-80">
            {ref.image_credit && <span>Photo: {ref.image_credit}</span>}
            {ref.wikipedia_url && (
              <a href={ref.wikipedia_url} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 underline">
                Wikipedia <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
