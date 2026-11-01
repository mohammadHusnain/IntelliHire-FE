import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, m, useMotionValue, useSpring, useTransform } from "motion/react";
import { ArrowRight, Search } from "lucide-react";
import WordReveal from "./WordReveal";
import FloatingRoleCards, { RoleStrip } from "./FloatingRoleCards";
import { FLOATING_ROLES, ROLE_COUNT } from "./landingRoles";
import { ROLE_CATEGORIES } from "@/data/rolesData";
import useInView from "@/hooks/useInView";
import useReducedMotion from "@/hooks/useReducedMotion";
import { SPRING_POINTER, fadeUp, stagger, tween } from "@/lib/motion";

const TYPED_ROLES = [
  "Frontend Developer",
  "Data Analyst",
  "DevOps Engineer",
  "Product Designer",
  "Machine Learning Engineer",
  "Security Engineer",
];

const ALL = ROLE_CATEGORIES.flatMap((c) => c.roles.map((name) => ({ name, category: c.category })));

const TICKER = [
  ["🧭", String(ROLE_COUNT), "roles supported"],
  ["🗂️", String(ROLE_CATEGORIES.length), "disciplines"],
  ["🤖", "3", "AI evaluation stages"],
  ["🪜", "6", "steps from job post to offer"],
  ["🙋", "100%", "human final decisions"],
];

const HERO_EMOJIS = [
  { e: "💻", x: 4, y: 12, size: 30, dur: 9, delay: -1, dx: 12, dy: -26 },
  { e: "🤖", x: 89, y: 9, size: 34, dur: 11, delay: -4, dx: -14, dy: -24 },
  { e: "🎨", x: 9, y: 37, size: 28, dur: 10, delay: -6, dx: 16, dy: -22, md: true },
  { e: "📊", x: 87, y: 41, size: 30, dur: 8.5, delay: -2, dx: -12, dy: -28, md: true },
  { e: "☁️", x: 3, y: 60, size: 32, dur: 12, delay: -8, dx: 14, dy: -24 },
  { e: "🚀", x: 91, y: 63, size: 34, dur: 9.5, delay: -5, dx: -16, dy: -30 },
  { e: "🧠", x: 21, y: 9, size: 34, dur: 10.5, delay: -3, dx: 10, dy: -28, md: true },
  { e: "🔐", x: 76, y: 13, size: 30, dur: 8, delay: -7, dx: -10, dy: -24, md: true },
  { e: "🛠️", x: 24, y: 71, size: 30, dur: 11.5, delay: -9, dx: 12, dy: -26, md: true },
  { e: "🎯", x: 72, y: 73, size: 32, dur: 9, delay: -2.5, dx: -12, dy: -28, md: true },
];

function HeroEmojis() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {HERO_EMOJIS.map((h) => (
        <span
          key={h.e}
          className={`emoji-float absolute leading-none drop-shadow-[0_6px_10px_rgba(13,13,13,0.12)] ${h.md ? "hidden md:block" : ""}`}
          style={{
            left: `${h.x}%`,
            top: `${h.y}%`,
            fontSize: h.size,
            "--ef-dur": `${h.dur}s`,
            "--ef-delay": `${h.delay}s`,
            "--ef-dx": `${h.dx}px`,
            "--ef-dy": `${h.dy}px`,
          }}
        >
          {h.e}
        </span>
      ))}
    </div>
  );
}

function useTypedPlaceholder(active) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (!active) return;
    let word = 0;
    let n = 0;
    let dir = 1;
    let timer;
    const tick = () => {
      const target = TYPED_ROLES[word];
      n += dir;
      setText(target.slice(0, n));
      let wait = dir === 1 ? 85 : 38;
      if (dir === 1 && n === target.length) {
        dir = -1;
        wait = 1500;
      } else if (dir === -1 && n === 0) {
        dir = 1;
        word = (word + 1) % TYPED_ROLES.length;
        wait = 380;
      }
      timer = setTimeout(tick, wait);
    };
    timer = setTimeout(tick, 700);
    return () => clearTimeout(timer);
  }, [active]);
  return text;
}

function useFontsReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    const done = () => live && setReady(true);
    const fonts = typeof document !== "undefined" ? document.fonts : null;
    if (fonts?.load) {
      Promise.all([
        fonts.load('500 40px "Fraunces"'),
        fonts.load('italic 400 40px "Fraunces"'),
        fonts.load('400 16px "Inter"'),
      ]).then(done, done);
    } else {
      Promise.resolve().then(done);
    }
    const timer = setTimeout(done, 1500);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, []);
  return ready;
}

function RoleSearch() {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const typed = useTypedPlaceholder(!reduced && !focused && !query);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return focused ? ALL.filter((r) => FLOATING_ROLES.some((f) => f.name === r.name)).slice(0, 6) : [];
    return ALL.filter((r) => r.name.toLowerCase().includes(q)).slice(0, 6);
  }, [query, focused]);
  const open = focused && results.length > 0;

  const choose = () => navigate("/register?role=individual");

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!results.length) return;
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + results.length) % results.length);
    } else if (e.key === "Escape") {
      setFocused(false);
      e.currentTarget.blur();
    }
  };

  const placeholder = !focused && !query && !reduced ? typed || "\u200b" : "Search a role, e.g. Frontend Developer";

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        choose();
      }}
      className="relative mx-auto w-full max-w-2xl"
    >
      <div className="relative">
        <Search size={20} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          type="text"
          role="combobox"
          aria-label="Search for a role to practise"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(-1);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          className="h-16 w-full rounded-full border border-[var(--line)] bg-white pl-14 pr-20 text-[16px] text-ink shadow-[0_24px_48px_-28px_rgba(13,13,13,0.35)] outline-none transition-[border-color,box-shadow] duration-300 placeholder:text-stone-400 focus:border-brand focus:shadow-[0_0_0_4px_rgba(240,78,35,0.12),0_24px_48px_-28px_rgba(13,13,13,0.35)] sm:h-[68px] sm:text-[17px]"
        />
        <button
          type="submit"
          aria-label="Start practising this role"
          className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-ink text-white transition-colors duration-200 hover:bg-brand sm:h-[52px] sm:w-[52px]"
        >
          <ArrowRight size={20} />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <m.ul
            id={listId}
            role="listbox"
            aria-label="Matching roles"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={tween(0.22)}
            className="absolute inset-x-3 top-[calc(100%+8px)] z-30 overflow-hidden rounded-3xl border border-[var(--line)] bg-white p-2 text-left shadow-[0_30px_60px_-24px_rgba(13,13,13,0.4)]"
          >
            {results.map((r, i) => (
              <li
                key={r.name}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose();
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-2xl px-4 py-2.5 transition-colors ${
                  i === active ? "bg-brand-soft" : ""
                }`}
              >
                <span className="text-[15px] font-medium text-ink">{r.name}</span>
                <span className="shrink-0 text-[12px] text-stone-500">{r.category}</span>
              </li>
            ))}
          </m.ul>
        )}
      </AnimatePresence>
    </form>
  );
}

function Ticker() {
  const [ref, inView] = useInView({ once: false, threshold: 0 });
  const group = (hidden) => (
    <ul aria-hidden={hidden} className="flex shrink-0 items-center">
      {[...TICKER, ...TICKER].map(([emoji, value, label], i) => (
        <li key={i} className="flex shrink-0 items-center gap-2.5 px-7">
          <span aria-hidden className="text-[22px] leading-none">{emoji}</span>
          <span className="font-display text-[26px] font-medium tracking-[-0.02em] text-ink">{value}</span>
          <span className="text-[13px] text-stone-500">{label}</span>
          <span className="ml-7 h-1 w-1 rounded-full bg-stone-300" />
        </li>
      ))}
    </ul>
  );
  return (
    <div ref={ref} data-paused={!inView} className="marquee mask-fade-x relative z-10 mt-10 border-y border-[var(--line)] bg-white/70 py-5 backdrop-blur-sm sm:mt-14">
      <div className="marquee-track" style={{ "--marquee-duration": "48s" }}>
        {group(false)}
        {group(true)}
      </div>
    </div>
  );
}

export default function RoleSearchHero() {
  const reduced = useReducedMotion();
  const fontsReady = useFontsReady();
  const [ref, inView] = useInView({ once: false, threshold: 0 });
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, SPRING_POINTER);
  const sy = useSpring(py, SPRING_POINTER);
  const glowX = useTransform(sx, [-1, 1], [-70, 70]);
  const glowY = useTransform(sy, [-1, 1], [-40, 40]);
  const sectionRef = useRef(null);

  const onPointerMove = (e) => {
    if (reduced || e.pointerType !== "mouse") return;
    const r = sectionRef.current?.getBoundingClientRect();
    if (!r) return;
    px.set(((e.clientX - r.left) / r.width - 0.5) * 2);
    py.set(((e.clientY - r.top) / r.height - 0.5) * 2);
  };
  const onPointerLeave = () => {
    px.set(0);
    py.set(0);
  };

  return (
    <section
      id="top"
      ref={sectionRef}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className="relative overflow-hidden pt-32 sm:pt-36 lg:pt-40"
    >
      <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-dot-grid mask-radial absolute inset-0" />
        <m.div
          style={{ x: glowX, y: glowY }}
          className="absolute left-1/2 top-[-10%] h-[620px] w-[min(1000px,140vw)] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(240,78,35,0.16),transparent)]"
        />
      </div>

      <HeroEmojis />
      <FloatingRoleCards px={sx} py={sy} paused={!inView} reduced={reduced} />

      <m.div
        variants={stagger(0.09, 0.5)}
        initial={reduced ? "show" : "hidden"}
        animate={fontsReady ? "show" : "hidden"}
        style={{ visibility: fontsReady ? "visible" : "hidden" }}
        className="relative z-20 mx-auto max-w-4xl px-6 text-center"
      >
        <m.span variants={fadeUp} className="eyebrow">
          AI interview platform
        </m.span>

        <WordReveal
          as="h1"
          trigger="mount"
          play={fontsReady}
          delay={0.15}
          className="display mx-auto mt-6 min-h-[3.12em] text-[46px] xs:text-[52px] sm:text-[72px] md:min-h-0 lg:text-[92px]"
          segments={[{ t: "Interviews" }, { t: "that find" }, { br: true }, { t: "real talent.", em: true }]}
        />

        <m.p variants={fadeUp} className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-stone-500 sm:text-[19px]">
          Practise the interview for the role you want, or let AI run your first rounds. People make every final call.
        </m.p>

        <m.div variants={fadeUp} className="mt-10">
          <RoleSearch />
        </m.div>

        <m.p variants={fadeUp} className="mt-6 text-[14px] text-stone-500">
          Hiring?{" "}
          <Link to="/register?role=company" className="link-brand">
            Post a role
          </Link>
        </m.p>
      </m.div>

      <RoleStrip />
      <Ticker />
    </section>
  );
}
