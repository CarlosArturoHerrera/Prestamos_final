/**
 * Centralized Framer Motion animation config.
 * Philosophy (Emil Kowalski): subtle, purposeful, GPU-accelerated.
 * Only animates `opacity` and `transform` — never width/height/top/left.
 */

// ── Easing curves ─────────────────────────────────────────
export const EASE = {
  /** Expo-like deceleration — snappy start, floats to rest */
  out: [0.16, 1, 0.3, 1] as const,
  /** Fast acceleration — for exit transitions */
  in: [0.4, 0, 1, 0.6] as const,
  /** Standard material curve */
  std: [0.4, 0, 0.2, 1] as const,
  /** Subtle spring feel without overshoot */
  spring: {
    type: "spring" as const,
    stiffness: 380,
    damping: 30,
    mass: 0.8,
  },
};

// ── Duration constants (seconds) ──────────────────────────
export const DUR = {
  fast: 0.14, // hover micro-feedback
  base: 0.22, // standard enter/exit
  page: 0.26, // page transitions
  modal: 0.24, // dialog open/close
  slow: 0.32, // complex staggered entrance
};

// ── Reusable variants ─────────────────────────────────────

/** Fade + slide up — primary entrance for content blocks */
export const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 4 },
  transition: { duration: DUR.base, ease: EASE.out },
};

/** Pure fade — for overlays, loading states */
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: DUR.base, ease: EASE.out },
};

/** Scale + fade — for popping elements (dropdowns, modals) */
export const scaleIn = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.97 },
  transition: { duration: DUR.base, ease: EASE.out },
};

/** Page-level transition */
export const pageFade = {
  initial: { opacity: 0, y: 7 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DUR.page, ease: EASE.out },
};

/**
 * Stagger container — wrap a list; children animate sequentially.
 * Usage:
 *   <motion.ul variants={stagger()} initial="initial" animate="animate">
 *     <motion.li variants={staggerChild} />
 *   </motion.ul>
 */
export const stagger = (childDelay = 0.055, initialDelay = 0.04) => ({
  initial: {},
  animate: {
    transition: {
      staggerChildren: childDelay,
      delayChildren: initialDelay,
    },
  },
});

/** Stagger child — use inside a `stagger()` container */
export const staggerChild = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: DUR.base, ease: EASE.out },
  },
};

/** List row entrance — subtle x slide for table rows */
export const listItem = {
  initial: { opacity: 0, x: -4 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: DUR.fast, ease: EASE.out },
  },
};

/** KPI / stat card entrance */
export const statCard = (index = 0) => ({
  initial: { opacity: 0, y: 12, scale: 0.99 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: DUR.slow,
      ease: EASE.out,
      delay: index * 0.055,
    },
  },
});
