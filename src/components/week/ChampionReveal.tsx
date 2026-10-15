import { useEffect } from "react";
import { Crown, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useConfetti } from "@/hooks/useConfetti";
import { STAT_KEYS, STAT_LABELS, type Participant } from "@/lib/tournament";

interface Props {
  champion: Participant;
  title: string;
  recap: string | null;
  onShare?: () => void;
}

export default function ChampionReveal({ champion, title, recap, onShare }: Props) {
  const { fireConfetti } = useConfetti();
  useEffect(() => { fireConfetti("victory"); }, [champion.id, fireConfetti]);
  const maxStat = Math.max(1, ...STAT_KEYS.map((k) => champion.stats?.[k] ?? 0));

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-amber-400/60 bg-gradient-to-b from-amber-400/20 via-card to-card animate-in zoom-in-95 fade-in duration-700">
      <div className="p-4 text-center">
        <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-amber-300">
          <Crown className="h-4 w-4" /> {title}
        </div>
      </div>
      {champion.image_url ? (
        <img src={champion.image_url} alt={champion.name} className="aspect-square w-full object-cover" />
      ) : (
        <div className="aspect-[2/1] w-full grid place-items-center bg-muted text-6xl">🕷️</div>
      )}
      <div className="p-4 space-y-3">
        <div className="text-center">
          <h3 className="text-2xl font-black">{champion.name}</h3>
          <div className="text-sm text-muted-foreground">
            {champion.species}
            {champion.is_wild ? <> · <Badge variant="outline">Wild Challenger</Badge></> : champion.owner_name ? ` · caught by ${champion.owner_name}` : ""}
          </div>
          <div className="mt-1 text-sm font-bold">Power {champion.power}</div>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {STAT_KEYS.map((k) => (
            <div key={k}>
              <div className="flex justify-between text-[11px] text-muted-foreground capitalize"><span>{STAT_LABELS[k]}</span><span className="tabular-nums">{champion.stats?.[k] ?? 0}</span></div>
              <div className="h-1.5 rounded bg-muted"><div className="h-1.5 rounded bg-amber-400" style={{ width: `${((champion.stats?.[k] ?? 0) / maxStat) * 100}%` }} /></div>
            </div>
          ))}
        </div>
        {recap && <p className="text-sm leading-relaxed border-l-2 border-amber-400/60 pl-3 italic">{recap}</p>}
        {onShare && <Button className="w-full" variant="outline" onClick={onShare}><Share2 className="mr-2 h-4 w-4" />Share</Button>}
      </div>
    </div>
  );
}
