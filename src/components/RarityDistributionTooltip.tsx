import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { normalizeRarity, rarityMeta, type RarityTier } from "@/lib/rarity";

interface DistRow {
  rarity: string;
  count: number;
  percentage: number;
}

let cache: DistRow[] | null = null;
let inflight: Promise<DistRow[]> | null = null;

async function loadDistribution(): Promise<DistRow[]> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const { data, error } = await (supabase as any).rpc("get_rarity_distribution");
    if (error || !data) return [];
    cache = (data as DistRow[]).map((d) => ({
      ...d,
      count: Number(d.count),
      percentage: Number(d.percentage),
    }));
    return cache;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

interface Props {
  rarity?: string | null;
  children: React.ReactNode;
}

const TIER_ORDER: RarityTier[] = [
  "COMMON",
  "UNCOMMON",
  "RARE",
  "EPIC",
  "LEGENDARY",
];

const RarityDistributionTooltip = ({ rarity, children }: Props) => {
  const tier = normalizeRarity(rarity);
  const [dist, setDist] = useState<DistRow[] | null>(cache);

  useEffect(() => {
    let alive = true;
    if (!cache) {
      loadDistribution().then((d) => {
        if (alive) setDist(d);
      });
    }
    return () => {
      alive = false;
    };
  }, []);

  const ownRow = dist?.find((d) => d.rarity === tier);
  const meta = rarityMeta(tier);

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <span className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[220px] p-3">
        <div className="space-y-2">
          <div className="text-xs font-semibold">
            {ownRow
              ? `Only ${ownRow.percentage}% of spiders are ${meta.label}`
              : `${meta.label} tier`}
          </div>
          <div className="space-y-1">
            {TIER_ORDER.map((t) => {
              const row = dist?.find((d) => d.rarity === t);
              const m = rarityMeta(t);
              const pct = row?.percentage ?? 0;
              const active = t === tier;
              return (
                <div
                  key={t}
                  className={`flex items-center justify-between text-[11px] ${
                    active ? "font-semibold" : "text-muted-foreground"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{
                        background: `hsl(var(--${m.cssVar}))`,
                      }}
                    />
                    {m.label}
                  </span>
                  <span className="tabular-nums">{pct}%</span>
                </div>
              );
            })}
          </div>
          <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/60">
            Tier is set by power-score percentile across all spiders.
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

export default RarityDistributionTooltip;