import { motion } from 'motion/react';
import { duration, ease } from '../motion.js';

/**
 * Horizontal bar showing how parts make up a whole.
 * Each segment is a full-width layer scaled on the X axis to its cumulative
 * share, so the animation uses transforms only (no width/layout changes).
 * @param {{segments: {key: string, value: number, className: string}[], label: string}} props
 */
export function ProportionBar({ segments, label }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  let cumulative = 0;
  const layers = segments.map((segment) => {
    cumulative += segment.value;
    return { ...segment, end: total === 0 ? 0 : cumulative / total };
  });

  return (
    <div className="proportion-bar" role="img" aria-label={label}>
      {/* Later segments render first so earlier ones sit on top. */}
      {[...layers].reverse().map((layer) => (
        <motion.span
          key={layer.key}
          className={`proportion-layer ${layer.className}`}
          style={{ originX: 0 }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: layer.end }}
          transition={{ duration: duration.slow, ease: ease.out }}
        />
      ))}
    </div>
  );
}
