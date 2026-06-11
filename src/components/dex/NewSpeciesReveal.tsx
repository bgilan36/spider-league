import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, BookOpen, Award } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onClose: () => void;
  commonName: string;
  scientificName?: string;
  imageUrl: string;
  xpAwarded: number;
  badgeUnlocked?: string | null;
  distinctSpecies: number;
}

/**
 * Holographic dex-page reveal that plays once when a user catches a new species.
 * Silhouette → photo dissolve, tick-up XP counter, optional badge unlock chip.
 */
export default function NewSpeciesReveal({
  open, onClose, commonName, scientificName, imageUrl,
  xpAwarded, badgeUnlocked, distinctSpecies,
}: Props) {
  const [xpShown, setXpShown] = useState(0);

  useEffect(() => {
    if (!open) { setXpShown(0); return; }
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 900);
      const eased = 1 - Math.pow(1 - p, 3);
      setXpShown(Math.round(eased * xpAwarded));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, xpAwarded]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ rotateY: -90, opacity: 0, scale: 0.9 }}
            animate={{ rotateY: 0, opacity: 1, scale: 1 }}
            exit={{ rotateY: 90, opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-2xl overflow-hidden border border-yellow-400/40 shadow-[0_0_80px_rgba(250,204,21,0.25)]"
            style={{
              background:
                "radial-gradient(circle at 30% 0%, rgba(250,204,21,0.18), transparent 60%), linear-gradient(180deg, #0a0a0f 0%, #18181b 100%)",
              perspective: 1000,
            }}
          >
            {/* Sweeping holo shimmer */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 1.6, delay: 0.5, repeat: Infinity, repeatDelay: 2, ease: "linear" }}
              style={{
                background:
                  "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)",
              }}
            />

            <div className="relative p-6 text-center text-white">
              <div className="flex items-center justify-center gap-2 text-yellow-300 text-xs font-bold tracking-[0.2em] uppercase">
                <BookOpen className="h-3.5 w-3.5" />
                SpiderDex · New Entry
              </div>
              <div className="mt-1 text-3xl font-extrabold flex items-center justify-center gap-2">
                <Sparkles className="h-6 w-6 text-yellow-300 animate-pulse" />
                New Species!
              </div>

              {/* Silhouette → photo dissolve */}
              <div className="relative mx-auto mt-5 h-44 w-44 rounded-full overflow-hidden ring-4 ring-yellow-400/40 shadow-xl">
                <motion.div
                  className="absolute inset-0 bg-black"
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.9, delay: 0.6 }}
                />
                <motion.img
                  src={imageUrl}
                  alt={commonName}
                  className="absolute inset-0 h-full w-full object-cover"
                  initial={{ scale: 1.1, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.9, delay: 0.6 }}
                />
              </div>

              <div className="mt-5 text-xl font-bold">{commonName}</div>
              {scientificName && (
                <div className="text-xs italic text-white/70">{scientificName}</div>
              )}

              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-400/20 text-yellow-200 border border-yellow-400/40">
                <Sparkles className="h-4 w-4" />
                <span className="font-bold tabular-nums">+{xpShown} XP</span>
                <span className="text-xs">collection bonus</span>
              </div>

              <div className="mt-3 text-xs text-white/70">
                {distinctSpecies} distinct species collected
              </div>

              {badgeUnlocked && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.2 }}
                  className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-500/20 text-amber-200 border border-amber-400/40"
                >
                  <Award className="h-4 w-4" />
                  Badge unlocked: <strong className="font-semibold">{badgeUnlocked}</strong>
                </motion.div>
              )}

              <Button onClick={onClose} className="mt-6 w-full">Add to my Dex</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}