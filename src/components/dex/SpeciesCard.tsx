import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Star, Skull, HelpCircle } from "lucide-react";
import type { DexEntry } from "@/lib/spiderDex/useSpeciesProgress";

interface Props {
  entry: DexEntry;
  onOpen?: () => void;
}

/**
 * One dex card. Renders a real photo + count + best power when caught,
 * or a silhouette + hint when uncaught.
 */
export default function SpeciesCard({ entry, onOpen }: Props) {
  const palette = entry.species?.silhouettePalette ?? ["#1a1a1a", "#3f3f46"];
  const rarity = entry.species?.rarity ?? "uncommon";

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen?.()}
      className="relative overflow-hidden cursor-pointer transition-transform hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {/* Artwork tile */}
      <div
        className="relative aspect-square w-full overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${palette[0]} 0%, ${palette[1]} 100%)`,
        }}
      >
        {entry.caught && entry.bestSpider ? (
          <img
            src={entry.bestSpider.image_url}
            alt={entry.commonName}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <SilhouetteArt />
        )}

        {/* Top-right rarity tag */}
        <Badge
          variant="secondary"
          className="absolute top-1.5 right-1.5 text-[10px] capitalize backdrop-blur bg-black/40 text-white border-white/20"
        >
          {rarity}
        </Badge>

        {/* Count chip */}
        {entry.caught && (
          <span className="absolute top-1.5 left-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/55 text-white">
            ×{entry.count}
          </span>
        )}

        {/* Memorialized ribbon */}
        {entry.caught && entry.retired && (
          <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-900/80 text-amber-100">
            <Skull className="h-3 w-3" /> Memorialized
          </span>
        )}
      </div>

      {/* Caption */}
      <div className="p-2.5 space-y-0.5">
        <div className="text-sm font-semibold leading-tight truncate">
          {entry.caught ? entry.commonName : "???"}
        </div>
        {entry.species && (
          <div className="text-[10px] italic text-muted-foreground truncate">
            {entry.species.scientificName}
          </div>
        )}
        {entry.caught ? (
          <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Star className="h-3 w-3 text-yellow-500" />
            Best <span className="font-semibold text-foreground">{entry.bestPower}</span>
          </div>
        ) : (
          <div className="mt-1 flex items-start gap-1 text-[11px] text-muted-foreground leading-snug">
            <HelpCircle className="h-3 w-3 mt-0.5 shrink-0" />
            <span className="line-clamp-2">{entry.species?.hint ?? "Not yet documented."}</span>
          </div>
        )}
      </div>
    </Card>
  );
}

function SilhouetteArt() {
  // Generic spider silhouette — works for any uncaught entry.
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      className="absolute inset-0 h-full w-full opacity-65"
    >
      <g fill="#000">
        <ellipse cx="50" cy="55" rx="14" ry="11" />
        <circle cx="50" cy="43" r="6" />
        {[-1, 1].map((side) =>
          [0, 1, 2, 3].map((i) => {
            const baseY = 46 + i * 4;
            const angle = 12 + i * 9;
            const x2 = 50 + side * (28 + i * 4);
            const y2 = baseY + (i % 2 === 0 ? -10 : 12);
            return (
              <path
                key={`${side}-${i}`}
                d={`M50 ${baseY} Q ${50 + side * 18} ${baseY - angle} ${x2} ${y2}`}
                stroke="#000"
                strokeWidth="2.4"
                strokeLinecap="round"
                fill="none"
              />
            );
          })
        )}
      </g>
    </svg>
  );
}