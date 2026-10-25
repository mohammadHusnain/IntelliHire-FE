import { useCallback, useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import WordReveal from "./WordReveal";
import RolePopup from "./RolePopup";
import { RoleArtPanel } from "./RoleArt";
import { CAROUSEL_ROLES, sampleQuestions } from "./landingRoles";
import Reveal from "@/components/shared/Reveal";
import { SPRING_POPUP, tween } from "@/lib/motion";

const TILES = CAROUSEL_ROLES.map((r) => ({ ...r, question: sampleQuestions(r.name, 3)[1].text }));
const LAST = TILES.length - 1;

function RoleTile({ role, onOpen }) {
  return (
    <m.button
      type="button"
      layoutId={`role-card-${role.name}`}
      transition={SPRING_POPUP}
      style={{ borderRadius: 24 }}
      onClick={(e) => onOpen(role, e.currentTarget)}
      aria-haspopup="dialog"
      className="group flex h-full w-full flex-col overflow-hidden border border-[var(--line)] bg-white text-left shadow-[0_1px_2px_rgba(13,13,13,0.03)] transition-[border-color,box-shadow] duration-300 hover:border-brand/30 hover:shadow-[0_28px_50px_-30px_rgba(13,13,13,0.3)]"
    >
      <RoleArtPanel category={role.category} className="h-44 transition-transform duration-700 ease-[var(--ease-premium)] group-hover:scale-[1.03]" />
      <span className="flex flex-1 flex-col p-5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-400">{role.category}</span>
        <span className="mt-1.5 font-display text-[22px] font-medium leading-tight tracking-[-0.015em] text-ink">{role.name}</span>
        <span className="mt-4 line-clamp-3 rounded-2xl bg-[#FBFAF9] p-3 text-[13px] leading-relaxed text-stone-500">
          &ldquo;{role.question}&rdquo;
        </span>
        <span className="mt-auto flex items-center gap-1.5 pt-4 text-[13px] font-semibold text-ink">
          Preview this interview <ArrowRight size={14} className="btn-arrow text-brand" />
        </span>
      </span>
    </m.button>
  );
}

export default function RoleCarousel() {
  const scrollerRef = useRef(null);
  const trigger = useRef(null);
  const drag = useRef({ active: false, moved: false, startX: 0, startLeft: 0, lastX: 0, lastT: 0, v: 0 });
  const [index, setIndex] = useState(0);
  const [edge, setEdge] = useState({ start: true, end: false });
  const [touched, setTouched] = useState(false);
  const [selected, setSelected] = useState(null);

  const lefts = () => {
    const s = scrollerRef.current;
    const pad = parseFloat(getComputedStyle(s).paddingLeft) || 0;
    return [...s.querySelectorAll("[data-slide]")].map((el) => el.offsetLeft - pad);
  };
  const nearest = (left) => {
    const all = lefts();
    let best = 0;
    all.forEach((l, i) => {
      if (Math.abs(l - left) < Math.abs(all[best] - left)) best = i;
    });
    return best;
  };
  const goTo = (i) => {
    const s = scrollerRef.current;
    const target = lefts()[Math.max(0, Math.min(LAST, i))];
    s.scrollTo({ left: target, behavior: "smooth" });
  };
  const step = (dir) => {
    setTouched(true);
    goTo(nearest(scrollerRef.current.scrollLeft) + dir);
  };

  const onScroll = () => {
    const s = scrollerRef.current;
    const start = s.scrollLeft < 4;
    const end = s.scrollLeft + s.clientWidth >= s.scrollWidth - 4;
    setEdge((e) => (e.start === start && e.end === end ? e : { start, end }));
    setIndex(end ? LAST : nearest(s.scrollLeft));
    if (s.scrollLeft > 12) setTouched(true);
  };

  const onPointerDown = (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const s = scrollerRef.current;
    Object.assign(drag.current, { active: true, moved: false, startX: e.clientX, startLeft: s.scrollLeft, lastX: e.clientX, lastT: performance.now(), v: 0 });
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d.active) return;
    const s = scrollerRef.current;
    const dx = e.clientX - d.startX;
    if (!d.moved) {
      if (Math.abs(dx) < 6) return;
      d.moved = true;
      s.style.scrollSnapType = "none";
      s.setPointerCapture(e.pointerId);
      setTouched(true);
    }
    s.scrollLeft = d.startLeft - dx;
    const now = performance.now();
    if (now > d.lastT) d.v = (e.clientX - d.lastX) / (now - d.lastT);
    d.lastX = e.clientX;
    d.lastT = now;
  };
  const onPointerUp = (e) => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    if (!d.moved) return;
    const s = scrollerRef.current;
    s.releasePointerCapture?.(e.pointerId);
    const projected = s.scrollLeft - d.v * 280;
    s.style.scrollSnapType = "";
    goTo(nearest(projected));
    setTimeout(() => {
      d.moved = false;
    }, 0);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    }
  };

  const open = useCallback((role, el) => {
    if (drag.current.moved) return;
    trigger.current = el;
    setSelected(role);
  }, []);
  const close = useCallback(() => setSelected(null), []);
  const restoreFocus = useCallback(() => trigger.current?.focus({ preventScroll: true }), []);

  return (
    <section id="roles" className="scroll-mt-24 py-24 sm:py-28">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <Reveal>
          <span className="eyebrow">Discover</span>
        </Reveal>
        <WordReveal
          className="display mt-4 text-[34px] sm:text-[44px] lg:text-[56px]"
          segments={[{ t: "Every role has its own" }, { t: "interview.", em: true }]}
        />
        <Reveal delay={150}>
          <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-stone-500 sm:text-[18px]">
            Questions, scenarios and skills change with the position. Open any card to see what a real session asks.
          </p>
        </Reveal>
      </div>

      <div
        role="region"
        aria-roledescription="carousel"
        aria-label="Role interviews"
        onKeyDown={onKeyDown}
        className="relative mt-14"
      >
        <m.div
          layoutScroll
          ref={scrollerRef}
          onScroll={onScroll}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="no-scrollbar snap-x snap-mandatory overflow-x-auto overscroll-x-contain px-6 pb-8 pt-2 md:cursor-grab md:active:cursor-grabbing lg:px-[max(24px,calc((100vw-1152px)/2+32px))]"
        >
          <ul className="flex w-max select-none gap-4">
            {TILES.map((role, i) => (
              <li
                key={role.name}
                data-slide
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${TILES.length}`}
                className="w-[272px] snap-start sm:w-[300px]"
              >
                <RoleTile role={role} onOpen={open} />
              </li>
            ))}
          </ul>
        </m.div>

        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-white to-transparent transition-opacity duration-300 sm:w-24 ${edge.start ? "opacity-0" : "opacity-100"}`}
        />
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent transition-opacity duration-300 sm:w-24 ${edge.end ? "opacity-0" : "opacity-100"}`}
        />
      </div>

      <div className="mx-auto mt-2 flex max-w-6xl items-center justify-between gap-4 px-6 lg:px-8">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={edge.start}
            aria-label="Previous roles"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-white text-ink transition-colors hover:border-brand/40 hover:text-brand disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ArrowLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={edge.end}
            aria-label="Next roles"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-white text-ink transition-colors hover:border-brand/40 hover:text-brand disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ArrowRight size={18} />
          </button>
        </div>

        <div className="relative flex h-6 min-w-0 flex-1 items-center justify-center">
          <AnimatePresence initial={false}>
            {!touched && (
              <m.p
                key="hint"
                exit={{ opacity: 0, y: -6 }}
                transition={tween(0.3)}
                className="absolute text-[13px] text-stone-500"
              >
                Swipe to explore {TILES.length} roles
              </m.p>
            )}
          </AnimatePresence>
          {touched && (
            <ul className="hidden items-center sm:flex" aria-label="Carousel progress">
              {TILES.map((t, i) => (
                <li key={t.name}>
                  <button
                    type="button"
                    onClick={() => {
                      setTouched(true);
                      goTo(i);
                    }}
                    aria-label={`Go to ${t.name}`}
                    aria-current={i === index}
                    className="group flex h-6 w-4 items-center justify-center"
                  >
                    <span
                      className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? "w-5 bg-brand" : "w-1.5 bg-stone-300 group-hover:bg-stone-400"}`}
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <span aria-hidden className="w-[94px] shrink-0 max-sm:hidden" />
      </div>

      <RolePopup role={selected} onClose={close} onExited={restoreFocus} />
    </section>
  );
}
