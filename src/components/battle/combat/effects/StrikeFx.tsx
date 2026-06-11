import { motion, AnimatePresence } from "framer-motion";
import type { AttackStyle } from "../combatFx";

interface Props {
  active: boolean;
  style: AttackStyle;
  /** Direction the strike travels: -1 = right→left, +1 = left→right */
  dir: 1 | -1;
  reducedMotion?: boolean;
}

/**
 * One component handling all 4 strike styles — kept together to avoid
 * file sprawl. Renders an overlay anchored to the arena center.
 */
export default function StrikeFx({ active, style, dir, reducedMotion }: Props) {
  if (reducedMotion) {
    return (
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <div className="text-xs font-bold text-foreground/70 uppercase tracking-widest">
              {style}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key={`fx-${style}-${dir}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="pointer-events-none absolute inset-0"
        >
          {style === "fang"  && <FangFx dir={dir} />}
          {style === "web"   && <WebFx dir={dir} />}
          {style === "blur"  && <BlurFx dir={dir} />}
          {style === "slam"  && <SlamFx dir={dir} />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* -------- fang: venom droplets streaking across -------- */
function FangFx({ dir }: { dir: 1 | -1 }) {
  const drops = Array.from({ length: 7 }, (_, i) => i);
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {drops.map((i) => (
        <motion.span
          key={i}
          initial={{ x: -60 * dir, y: -4 + i * 3, opacity: 0 }}
          animate={{ x: 60 * dir,  y: 10 + i * 4, opacity: [0, 1, 0] }}
          transition={{ duration: 0.5, delay: i * 0.03, ease: "easeOut" }}
          className="absolute h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
        />
      ))}
      <motion.span
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1.3, opacity: [0, 1, 0] }}
        transition={{ duration: 0.35 }}
        className="absolute h-3 w-3 rounded-full bg-emerald-300/80 blur-[2px]"
      />
    </div>
  );
}

/* -------- web: silk strands shoot across, wrap defender -------- */
function WebFx({ dir }: { dir: 1 | -1 }) {
  const strands = Array.from({ length: 5 }, (_, i) => i);
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {strands.map((i) => (
        <motion.span
          key={i}
          initial={{ scaleX: 0, x: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.35, delay: i * 0.02, ease: "easeOut" }}
          style={{
            transformOrigin: dir === 1 ? "left center" : "right center",
            top: `${44 + i * 3}%`,
          }}
          className="absolute left-[22%] right-[22%] h-px bg-gradient-to-r from-white/0 via-white/80 to-white/0"
        />
      ))}
    </div>
  );
}

/* -------- blur: afterimage trail across arena -------- */
function BlurFx({ dir }: { dir: 1 | -1 }) {
  const ghosts = [0, 0.06, 0.12];
  return (
    <div className="absolute inset-0">
      {ghosts.map((d, i) => (
        <motion.span
          key={i}
          initial={{ x: -120 * dir, opacity: 0 }}
          animate={{ x: 120 * dir, opacity: [0, 0.7, 0] }}
          transition={{ duration: 0.32, delay: d, ease: "easeOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-32 rounded-full bg-white/70 blur-[3px]"
        />
      ))}
    </div>
  );
}

/* -------- slam: impact starburst -------- */
function SlamFx({ dir }: { dir: 1 | -1 }) {
  const spokes = Array.from({ length: 8 }, (_, i) => (i * 360) / 8);
  const x = dir === 1 ? "70%" : "30%";
  return (
    <div className="absolute inset-0">
      <motion.span
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.2, 1.6], opacity: [0, 1, 0] }}
        transition={{ duration: 0.45 }}
        className="absolute h-10 w-10 rounded-full bg-orange-300/70 blur-[4px]"
        style={{ left: x, top: "48%", translate: "-50% -50%" }}
      />
      {spokes.map((angle, i) => (
        <motion.span
          key={i}
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: [0, 1, 0] }}
          transition={{ duration: 0.35, delay: 0.04 }}
          className="absolute h-10 w-0.5 bg-orange-200/90 origin-bottom"
          style={{
            left: x, top: "48%",
            transform: `translate(-50%, -100%) rotate(${angle}deg)`,
            transformOrigin: "50% 100%",
          }}
        />
      ))}
    </div>
  );
}