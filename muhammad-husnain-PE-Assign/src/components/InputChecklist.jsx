import { motion } from 'motion/react';
import { rise, stagger } from '../motion.js';
import { Icon } from './Icon.jsx';

/**
 * Waiting state for a calculator's result panel. Lists each input and whether
 * it is ready, so the user sees exactly what is missing; it reflects real
 * validation state and never simulates progress.
 * @param {{items: {key: string, label: string, state: 'ready'|'missing'|'error'}[]}} props
 */
export function InputChecklist({ title, description, items }) {
  return (
    <motion.div className="waiting" variants={stagger(0.05)} initial="initial" animate="animate">
      <motion.h3 className="waiting-title" variants={rise}>
        {title}
      </motion.h3>
      <motion.p className="waiting-text" variants={rise}>
        {description}
      </motion.p>
      <ul className="checklist">
        {items.map((item) => (
          <motion.li key={item.key} className={`check-item is-${item.state}`} variants={rise}>
            <span className="check-mark" aria-hidden="true">
              {item.state === 'ready' && <Icon name="check" size={14} strokeWidth={2.2} />}
              {item.state === 'error' && <Icon name="alert" size={14} strokeWidth={2} />}
            </span>
            <span>{item.label}</span>
            <span className="sr-only">
              {item.state === 'ready' ? ': ready' : item.state === 'error' ? ': needs fixing' : ': not entered yet'}
            </span>
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}

/** Maps a form field to a checklist state. */
export function checklistState(field) {
  if (field.result.ok) return 'ready';
  return field.error ? 'error' : 'missing';
}
