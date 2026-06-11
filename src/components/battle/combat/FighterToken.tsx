import { motion } from "framer-motion";
import type { AttackStyle } from "./combatFx";

export type TokenState = "idle" | "lunge" | "hit" | "dead" | "winner";

interface Props {
  imageUrl: string;
  name: string;
  side: "left" | "right";
  state: TokenState;
  /** Set when the token should display a status chip (e.g. WRAPPED). */
  statusChip?: string | null;
  reducedMotion?: boolean;
  style?: AttackStyle;
}

/**
 * Circular masked photo. The CombatStage drives `state` to play
 * lunge → hit → idle → winner / dead transitions.
 */
export default function FighterToken({
  imageUrl, name, side, state, statusChip, reducedMotion, style,
}: Props) {
  const dir = side === "left" ? 1 : -1;

  // Reduced motion: only opacity/scale, no translate.
  const variants = reducedMotion
    ? {
        idle:   { x: 0, y: 0, scale: 1,    rotate: 0, opacity: 1, filter: "grayscale(0)" },
        lunge:  { x: 0, y: 0, scale: 1.02, rotate: 0, opacity: 1, filter: "grayscale(0)" },
        hit:    { x: 0, y: 0, scale: 0.98, rotate: 0, opacity: 0.85, filter: "grayscale(0)" },
        dead:   { x: 0, y: 0, scale: 0.95, rotate: 0, opacity: 0.5,  filter: "grayscale(1)" },
        winner: { x: 0, y: 0, scale: 1.04, rotate: 0, opacity: 1, filter: "grayscale(0)" },
      }
    : {
        idle:   { x: 0,           y: 0,  scale: 1,    rotate: 0,        opacity: 1,   filter: "grayscale(0)" },
        lunge:  { x: 90 * dir,    y: -4, scale: 1.15, rotate: 0,        opacity: 1,   filter: "grayscale(0)" },
        hit:    { x: -12 * dir,   y: 2,  scale: 0.96, rotate: -4 * dir, opacity: 1,   filter: "grayscale(0)" },
        dead:   { x: 0,           y: 12, scale: 0.92, rotate: 35 * dir, opacity: 0.7, filter: "grayscale(1)" },
        winner: { x: 0,           y: 0,  scale: 1.1,  rotate: 0,        opacity: 1,   filter: "grayscale(0)" },
      };

  return (
    <div className="relative flex flex-col items-center">
      <motion.div
        animate={state}
        variants={variants}
        transition={{
          type: state === "lunge" ? "tween" : "spring",
          duration: state === "lunge" ? 0.22 : undefined,
          ease: state === "lunge" ? "easeIn" : undefined,
          stiffness: 320, damping: 18,
        }}
        className={
          "relative h-24 w-24 sm:h-28 sm:w-28 rounded-full overflow-hidden " +
          "ring-2 ring-border shadow-lg " +
          (state === "winner" ? "shadow-[0_0_32px_rgba(250,204,21,0.55)] ring-yellow-400" : "") +
          (state === "hit" ? " animate-recoil-shake" : "")
        }
      >
        <img
          src={imageUrl}
          alt={name}
          className="h-full w-full object-cover"
          loading="lazy"
          draggable={false}
        />
        {/* Red flash on hit */}
        {state === "hit" && (
          <span className="absolute inset-0 bg-red-500/55 mix-blend-screen animate-fade-out" />
        )}
        {/* Subtle hex/border overlay */}
        <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-white/10" />
      </motion.div>
      <div className="mt-2 text-xs font-semibold text-foreground/90 max-w-[7rem] truncate text-center">
        {name}
      </div>
      {statusChip && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800/90 text-white ring-1 ring-white/20">
          {statusChip}
        </div>
      )}
      {style && state !== "idle" && state !== "dead" && (
        <div className="sr-only">attack style: {style}</div>
      )}
    </div>
  );
}