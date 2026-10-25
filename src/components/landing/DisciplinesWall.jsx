import { useState } from "react";
import { AnimatePresence, m } from "motion/react";
import WordReveal from "./WordReveal";
import RoleArt from "./RoleArt";
import { ROLE_COUNT } from "./landingRoles";
import Reveal from "@/components/shared/Reveal";
import { ROLE_CATEGORIES } from "@/data/rolesData";
import { fadeUp, stagger, tween } from "@/lib/motion";

function Tile({ cat, open, onHover, onToggle }) {
  return (
    <m.li variants={fadeUp} className="min-w-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        onFocus={() => onHover(true)}
        onBlur={() => onHover(false)}
        className="surface surface-hover group relative flex h-full min-h-[236px] w-full flex-col overflow-hidden p-5 text-left sm:min-h-[220px] sm:p-6"
      >
        <RoleArt category={cat.category} size={48} className="transition-transform duration-500 ease-[var(--ease-premium)] group-hover:scale-110" />
        <span className="mt-auto pt-10">
          <span className="block font-display text-[40px] font-medium leading-none tracking-[-0.03em] text-ink sm:text-[48px]">
            {cat.roles.length}
          </span>
          <span className="mt-2 block text-[15px] font-semibold text-ink">{cat.category}</span>
          <span className="mt-0.5 block text-[12.5px] text-stone-500">{open ? "Close" : "See the roles"}</span>
        </span>

        <AnimatePresence>
          {open && (
            <m.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={tween(0.25)}
              className="absolute inset-0 flex flex-col bg-ink p-5 text-white sm:p-6"
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-muted">{cat.category}</span>
              <span className="mt-3 flex flex-col gap-1.5">
                {cat.roles.map((role, i) => (
                  <m.span
                    key={role}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={tween(0.3, i * 0.03)}
                    className="text-[13px] leading-tight text-white/85"
                  >
                    {role}
                  </m.span>
                ))}
              </span>
            </m.span>
          )}
        </AnimatePresence>
      </button>
    </m.li>
  );
}

export default function DisciplinesWall() {
  const [hover, setHover] = useState(null);
  const [pinned, setPinned] = useState(null);

  return (
    <section id="disciplines" className="scroll-mt-24 py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="eyebrow">Coverage</span>
          </Reveal>
          <WordReveal
            className="display mt-4 text-[34px] sm:text-[44px] lg:text-[56px]"
            segments={[{ t: `${ROLE_CATEGORIES.length} disciplines.` }, { t: `${ROLE_COUNT} roles.`, em: true }]}
          />
          <Reveal delay={150}>
            <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-stone-500 sm:text-[18px]">
              From engineering to design to product, every role gets questions written for the work it actually does.
            </p>
          </Reveal>
        </div>

        <m.ul
          variants={stagger(0.07)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          className="mt-14 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3"
        >
          {ROLE_CATEGORIES.map((cat) => (
            <Tile
              key={cat.category}
              cat={cat}
              open={hover === cat.category || pinned === cat.category}
              onHover={(on) => setHover(on ? cat.category : null)}
              onToggle={() => setPinned((p) => (p === cat.category ? null : cat.category))}
            />
          ))}
        </m.ul>
      </div>
    </section>
  );
}
