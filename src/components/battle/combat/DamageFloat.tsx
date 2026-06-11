import { motion, AnimatePresence } from "framer-motion";

export interface FloatItem {
  id: string;
  kind: "damage" | "crit" | "miss";
  value?: number;
  /** -1 = above the left token, +1 = above the right token */
  side: -1 | 1;
  reducedMotion?: boolean;
}

export default function DamageFloatLayer({ items }: { items: FloatItem[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      <AnimatePresence>
        {items.map((it) => {
          const left = it.side === -1 ? "25%" : "75%";
          const reduced = !!it.reducedMotion;
          const isCrit = it.kind === "crit";
          const isMiss = it.kind === "miss";
          const text = isMiss ? "MISS!" : `-${it.value ?? 0}`;
          return (
            <motion.div
              key={it.id}
              initial={{ opacity: 0, y: reduced ? 0 : 0, scale: isCrit ? 0.4 : 0.8 }}
              animate={{ opacity: 1, y: reduced ? 0 : -40, scale: isCrit ? 1.2 : 1 }}
              exit={{ opacity: 0, y: reduced ? 0 : -56 }}
              transition={{ duration: reduced ? 0.25 : isCrit ? 0.9 : 0.7, ease: "easeOut" }}
              className={
                "absolute -translate-x-1/2 select-none font-extrabold tracking-tight " +
                (isCrit
                  ? "text-3xl text-yellow-300 drop-shadow-[0_0_10px_rgba(250,204,21,0.55)]"
                  : isMiss
                    ? "text-lg text-emerald-300"
                    : "text-xl text-red-300 drop-shadow-[0_0_6px_rgba(248,113,113,0.5)]")
              }
              style={{ left, top: "30%" }}
            >
              {text}
              {isCrit && <span className="ml-1 text-yellow-200 text-xs align-top">CRIT</span>}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}