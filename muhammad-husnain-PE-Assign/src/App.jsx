import { useReducer, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { reduce, initialState } from './lib/calculatorState.js';
import { validateLoanAmount, validateLoanRate, validateLoanYears } from './lib/loan.js';
import { validateBill, validateTip, validatePeople } from './lib/billSplit.js';
import { useValidatedForm } from './hooks/useValidatedForm.js';
import { useCalculatorKeyboard } from './hooks/useCalculatorKeyboard.js';
import { Calculator } from './modules/Calculator.jsx';
import { Loan } from './modules/Loan.jsx';
import { SplitBill } from './modules/SplitBill.jsx';
import { Icon } from './components/Icon.jsx';
import { moduleVariants, spring, swap } from './motion.js';

const MODULES = [
  { id: 'basic', title: 'Basic', summary: 'Everyday sums', description: 'Add, subtract, multiply and divide, with brackets and percent.' },
  { id: 'scientific', title: 'Scientific', summary: 'Functions & angles', description: 'Powers, roots, logarithms and trigonometry in degrees or radians.' },
  { id: 'loan', title: 'Loan', summary: 'Monthly & total cost', description: 'What a fixed-rate loan costs each month, and in total.' },
  { id: 'split', title: 'Split bill', summary: 'Tip & fair shares', description: 'The tip, the total and each person’s share, to the cent.' },
];

// Basic and Scientific are one calculator with one state, so they share a
// transition group: switching between them reshapes the keypad in place.
const groupOf = (id) => (id === 'basic' || id === 'scientific' ? 'calculator' : id);

const LOAN_VALIDATORS = { amount: validateLoanAmount, rate: validateLoanRate, years: validateLoanYears };
const SPLIT_VALIDATORS = { bill: validateBill, tip: validateTip, people: validatePeople };

export function App() {
  const [active, setActive] = useState('basic');
  const [calcState, dispatch] = useReducer(reduce, initialState);
  // Form state lives here so values survive switching modules.
  const loanForm = useValidatedForm({ amount: '', rate: '', years: '' }, LOAN_VALIDATORS);
  const splitForm = useValidatedForm({ bill: '', tip: '15', people: '2' }, SPLIT_VALIDATORS);

  const current = MODULES.find((m) => m.id === active);
  const group = groupOf(active);
  // Listens here rather than inside the calculator, so keys typed while the
  // previous module is still animating out are not lost.
  const flashKey = useCalculatorKeyboard(group === 'calculator', dispatch);

  return (
    <MotionConfig reducedMotion="user">
      <div className="shell" data-module={active}>
        <aside className="sidebar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <Icon name="basic" size={18} strokeWidth={1.9} />
            </span>
            <div>
              <p className="brand-name">Everyday Calculator</p>
              <p className="brand-tag">Four calculators. No wrong numbers.</p>
            </div>
          </div>
          <ModuleNav modules={MODULES} active={active} onSelect={setActive} />
          <p className="sidebar-note">Runs entirely in your browser. Nothing you type is sent anywhere.</p>
        </aside>

        <main className="workspace" id="workspace" role="tabpanel" aria-labelledby={`tab-${active}`}>
          <header className="module-header">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={active} variants={swap} initial="initial" animate="animate" exit="exit">
                <h1 className="module-title">{current.title}</h1>
                <p className="module-description">{current.description}</p>
              </motion.div>
            </AnimatePresence>
          </header>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={group} className="module-body" variants={moduleVariants} initial="initial" animate="animate" exit="exit">
              {group === 'calculator' && <Calculator mode={active} state={calcState} dispatch={dispatch} flashKey={flashKey} />}
              {group === 'loan' && <Loan form={loanForm} />}
              {group === 'split' && <SplitBill form={splitForm} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </MotionConfig>
  );
}

/** Tab list: vertical in the sidebar on wide screens, a segmented bar on small ones. */
function ModuleNav({ modules, active, onSelect }) {
  const refs = useRef({});

  const onKeyDown = (event) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
    const jump = { Home: 0, End: modules.length - 1 }[event.key];
    if (step === undefined && jump === undefined) return;
    event.preventDefault();
    const index = modules.findIndex((m) => m.id === active);
    const nextIndex = jump ?? (index + step + modules.length) % modules.length;
    const next = modules[nextIndex].id;
    onSelect(next);
    refs.current[next]?.focus();
  };

  return (
    <nav className="module-nav" aria-label="Calculators">
      <div role="tablist" aria-label="Calculator type" aria-orientation="vertical" onKeyDown={onKeyDown}>
        {modules.map((module) => {
          const selected = module.id === active;
          return (
            <button
              key={module.id}
              ref={(el) => {
                refs.current[module.id] = el;
              }}
              id={`tab-${module.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="workspace"
              tabIndex={selected ? 0 : -1}
              data-module={module.id}
              className={`nav-item${selected ? ' is-active' : ''}`}
              onClick={() => onSelect(module.id)}
            >
              {selected && <motion.span layoutId="nav-indicator" className="nav-indicator" transition={spring.indicator} />}
              <span className="nav-icon">
                <Icon name={module.id} />
              </span>
              <span className="nav-text">
                <span className="nav-title">{module.title}</span>
                <span className="nav-summary">{module.summary}</span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
