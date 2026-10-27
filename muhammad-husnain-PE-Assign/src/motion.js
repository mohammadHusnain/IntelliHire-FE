// Shared motion language. Every animation in the app uses these values so
// timing and feel stay consistent. Durations are short on purpose: the
// calculations are instant, so animation only clarifies what changed.

export const ease = {
  out: [0.22, 1, 0.36, 1],
  inOut: [0.65, 0, 0.35, 1],
};

export const duration = {
  fast: 0.16,
  base: 0.24,
  slow: 0.5, // number counters and proportion bars
};

export const spring = {
  // Sliding selection indicators (tabs, segmented controls)
  indicator: { type: 'spring', stiffness: 520, damping: 40, mass: 0.8 },
  // Key presses and small toggles
  press: { type: 'spring', stiffness: 700, damping: 30 },
  // Size changes of whole panels
  layout: { type: 'spring', stiffness: 380, damping: 38 },
};

/** Module enter/exit when switching tabs. */
export const moduleVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.out } },
  exit: { opacity: 0, y: -6, transition: { duration: duration.fast, ease: ease.inOut } },
};

/** Parent that staggers its children in. */
export const stagger = (step = 0.04, delay = 0) => ({
  initial: {},
  animate: { transition: { staggerChildren: step, delayChildren: delay } },
});

/** Child of a stagger parent. */
export const rise = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.out } },
};

/** Content that swaps in place (result states, messages). */
export const swap = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.out } },
  exit: { opacity: 0, y: -4, transition: { duration: duration.fast, ease: ease.inOut } },
};

/** Height reveal for inline messages and disclosures. */
export const collapse = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1, transition: { duration: duration.base, ease: ease.out } },
  exit: { height: 0, opacity: 0, transition: { duration: duration.fast, ease: ease.inOut } },
};

/** Tactile feedback for pressable controls. */
export const pressable = {
  whileTap: { scale: 0.95 },
  transition: spring.press,
};
