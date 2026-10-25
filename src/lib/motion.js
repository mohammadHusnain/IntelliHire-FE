export const EASE = [0.22, 1, 0.36, 1];
export const SPRING = { type: "spring", stiffness: 320, damping: 30 };
export const SPRING_POPUP = { type: "spring", stiffness: 300, damping: 32 };
export const SPRING_POINTER = { stiffness: 140, damping: 20, mass: 0.6 };

export const tween = (duration = 0.6, delay = 0) => ({ duration, delay, ease: EASE });

export const wordContainer = (stagger = 0.055, delay = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren: delay } },
});

export const wordItem = {
  hidden: { opacity: 0, y: "0.5em", filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: tween(0.7) },
};

export const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: tween(0.6) },
};

export const stagger = (gap = 0.06, delay = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
});

export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0 || 1;
}
