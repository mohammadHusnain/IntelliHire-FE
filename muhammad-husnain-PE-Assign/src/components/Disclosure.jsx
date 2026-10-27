import { useId, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { collapse, spring } from '../motion.js';
import { Icon } from './Icon.jsx';

/** Expandable section with an animated height reveal. */
export function Disclosure({ title, children }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className={`disclosure${open ? ' is-open' : ''}`}>
      <button type="button" className="disclosure-trigger" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
        <span>{title}</span>
        <motion.span className="disclosure-chevron" animate={{ rotate: open ? 180 : 0 }} transition={spring.press}>
          <Icon name="chevron" size={18} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="panel" id={panelId} className="disclosure-panel" variants={collapse} initial="initial" animate="animate" exit="exit">
            <div className="disclosure-body">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
