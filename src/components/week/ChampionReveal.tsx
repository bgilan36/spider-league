import { useEffect } from "react";
import { motion } from "framer-motion";
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
  /** "full" = cinematic reveal (results pages). "compact" = quiet one-line banner (home). */
  variant?: "full" | "compact";
}

export default function ChampionReveal({ champion, title, recap, onShare, variant = "full" }: Props) {
  const { fireConfetti } = useConfetti();
  useEffect(() => {
    if (variant !== "full") return;
    const t = setTimeout(() => fireConfetti("victory"), 1100);
    return () => clearTimeout(t);
  }, [champion.id, fireConfetti, variant]);

  if (variant === "compact") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="flex items-center gap-3 rounded-xl border border-champion/25 bg-champion/5 p-3"
      >
        {champion.image_url ? (
          <img
            src={champion.image_url}
            alt={champion.name}
            className="h-12 w-12 shrink-0 rounded-lg object-cover"
            loading="lazy"
          />
        ) : (
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-muted text-xl">🕷️</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-champion">
            <Crown className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{title}</span>
          </div>
          <div className="truncate text-sm font-semibold">{champion.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {champion.species}
            {champion.owner_name ? ` · ${champion.owner_name}` : ""}
          </div>
        </div>
        {onShare && (
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onShare} aria-label="Share champion">
            <Share2 className="h-4 w-4" />
          </Button>
        )}
      </motion.div>
    );
  }

  const maxStat = Math.max(1, ...STAT_KEYS.map((k) => champion.stats?.[k] ?? 0));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 28 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 1, ease: "easeOut" }}
      className="overflow-hidden rounded-2xl border-2 border-amber-400/60 bg-gradient-to-b from-amber-400/20 via-card to-card"
    >
      <div className="p-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: -22, scale: 0.5 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.7, type: "spring", bounce: 0.5 }}
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-amber-300"
        >
          <Crown className="h-4 w-4" /> {title}
        </motion.div>
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9, duration: 0.9 }}>
        {champion.image_url ? (
          <img src={champion.image_url} alt={champion.name} className="aspect-square w-full object-cover" />
        ) : (
          <div className="aspect-[2/1] w-full grid place-items-center bg-muted text-6xl">🕷️</div>
        )}
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.4, duration: 0.7 }}
        className="p-4 space-y-3"
      >
        <div className="text-center">
          <h3 className="text-2xl font-black">{champion.name}</h3>
          <div className="text-sm text-muted-foreground">
            {champion.species}
            {champion.is_wild ? <> · <Badge variant="outline">Wild Challenger</Badge></> : champion.owner_name ? ` · caught by ${champion.owner_name}` : ""}
          </div>
          <div className="mt-1 text-sm font-bold">Power {champion.power}</div>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {STAT_KEYS.map((k, i) => (
            <div key={k}>
              <div className="flex justify-between text-[11px] text-muted-foreground capitalize"><span>{STAT_LABELS[k]}</span><span className="tabular-nums">{champion.stats?.[k] ?? 0}</span></div>
              <div className="h-1.5 rounded bg-muted">
                <motion.div
                  className="h-1.5 rounded bg-amber-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${((champion.stats?.[k] ?? 0) / maxStat) * 100}%` }}
                  transition={{ delay: 1.9 + i * 0.14, duration: 0.7, ease: "easeOut" }}
                />
              </div>
            </div>
          ))}
        </div>
        {recap && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.8, duration: 0.8 }}
            className="text-sm leading-relaxed border-l-2 border-amber-400/60 pl-3 italic"
          >
            {recap}
          </motion.p>
        )}
        {onShare && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.1, duration: 0.6 }}>
            <Button className="w-full" variant="outline" onClick={onShare}><Share2 className="mr-2 h-4 w-4" />Share</Button>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
