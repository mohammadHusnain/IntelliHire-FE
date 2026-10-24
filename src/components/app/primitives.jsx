import { useId, useMemo, useState } from "react";
import useInView from "@/hooks/useInView";
import useCounter from "@/hooks/useCounter";
import Reveal from "@/components/shared/Reveal";

// Portal-wide building blocks. Pages compose these instead of hand-rolling cards.

export function Card({ as: Tag = "section", className = "", interactive = false, children, ...rest }) {
  return (
    <Tag
      className={`rounded-[20px] border border-[var(--line)] bg-white shadow-[0_1px_2px_rgba(13,13,13,0.03)] ${
        interactive ? "surface-hover transition-all duration-300 ease-[var(--ease-premium)]" : ""
      } ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({ title, subtitle, action, icon: Icon, className = "" }) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <Icon size={17} />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="font-sans text-[15px] font-semibold text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-stone-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <Reveal className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between" y={10}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h1 className="display text-[30px] sm:text-[36px]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-[15px] text-stone-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </Reveal>
  );
}

export function Badge({ tone = "neutral", children, className = "" }) {
  const tones = {
    neutral: "bg-stone-100 text-stone-600",
    brand: "bg-brand-soft text-brand",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-red-50 text-red-700",
    dark: "bg-ink text-white",
  };
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function StatTile({ icon: Icon, label, value, suffix = "", delta, hint, delay = 0 }) {
  const [ref, inView] = useInView({ threshold: 0.3 });
  const n = useCounter(typeof value === "number" ? value : 0, 1100, inView);
  return (
    <Reveal delay={delay}>
      <Card interactive className="group relative h-full overflow-hidden p-5">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-brand/5 transition-transform duration-500 group-hover:scale-125" />
        <div className="relative flex items-start justify-between">
          <p className="text-[13px] font-medium text-stone-500">{label}</p>
          {Icon && (
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-50 text-stone-500 transition-colors duration-300 group-hover:bg-brand-soft group-hover:text-brand">
              <Icon size={17} />
            </span>
          )}
        </div>
        <p ref={ref} className="relative mt-3 font-display text-[34px] font-medium leading-none tracking-[-0.03em] text-ink tabular-nums">
          {typeof value === "number" ? n : value}
          {suffix && <span className="ml-0.5 text-[18px] text-stone-400">{suffix}</span>}
        </p>
        {(delta != null || hint) && (
          <div className="relative mt-3 flex items-center gap-2 text-[12px]">
            {delta != null && (
              <span className={`rounded-full px-2 py-0.5 font-semibold ${delta > 0 ? "bg-emerald-50 text-emerald-700" : delta < 0 ? "bg-red-50 text-red-700" : "bg-stone-100 text-stone-600"}`}>
                {delta > 0 ? "+" : ""}
                {delta}
              </span>
            )}
            {hint && <span className="text-stone-500">{hint}</span>}
          </div>
        )}
      </Card>
    </Reveal>
  );
}

export function ScoreRing({ score, size = 120, stroke = 9, color, label = "/100", animate = true }) {
  const [ref, inView] = useInView({ threshold: 0.3 });
  const value = useCounter(score, 1300, animate ? inView : true);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const tone = color || (score >= 70 ? "#059669" : score >= 55 ? "#D97706" : "#DC2626");
  return (
    <span ref={ref} className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F1EFEC" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display font-medium leading-none tracking-[-0.03em] text-ink tabular-nums" style={{ fontSize: size * 0.3 }}>
          {value}
        </span>
        {label && <span className="mt-1 text-[11px] font-medium text-stone-400">{label}</span>}
      </span>
    </span>
  );
}

export function ProgressBar({ value, className = "", tone = "bg-brand" }) {
  const [ref, inView] = useInView({ threshold: 0.2 });
  return (
    <div ref={ref} className={`h-2 overflow-hidden rounded-full bg-stone-100 ${className}`}>
      <div
        className={`h-full rounded-full ${tone} transition-[width] duration-1000 ease-[var(--ease-premium)]`}
        style={{ width: inView ? `${Math.max(0, Math.min(100, value))}%` : "0%" }}
      />
    </div>
  );
}

export function Segmented({ options, value, onChange, size = "md", className = "", ariaLabel }) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`relative inline-grid rounded-xl border border-[var(--line)] bg-stone-50 p-1 ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="absolute bottom-1 top-1 rounded-lg bg-white shadow-[0_2px_8px_-2px_rgba(13,13,13,0.18)] transition-transform duration-300 ease-[var(--ease-premium)]"
        style={{ width: `calc((100% - 8px) / ${options.length})`, left: 4, transform: `translateX(${idx * 100}%)` }}
      />
      {options.map((o) => {
        const on = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.ariaLabel}
            onClick={() => onChange(o.value)}
            className={`relative z-10 flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-semibold transition-colors ${
              size === "sm" ? "h-8 px-3 text-[12.5px]" : "h-9 px-4 text-[13px]"
            } ${on ? "text-ink" : "text-stone-500 hover:text-ink"}`}
          >
            {Icon && <Icon size={14} className={on ? "text-brand" : ""} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-300 ease-[var(--ease-premium)] disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-brand" : "bg-stone-300"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform duration-300 ease-[var(--ease-spring)] ${
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export function EmptyState({ icon: Icon, title, message, action, className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-[20px] border border-dashed border-stone-300 bg-white/60 px-6 py-14 text-center ${className}`}>
      {Icon && (
        <span className="float-y flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
          <Icon size={24} />
        </span>
      )}
      <h3 className="display mt-5 text-[22px]">{title}</h3>
      {message && <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-stone-500">{message}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** Responsive SVG line/area chart for score trends. points: [{ label, value, sub }] */
export function TrendChart({ points, height = 200, max = 100 }) {
  const id = useId().replace(/:/g, "");
  const [hover, setHover] = useState(null);
  const [ref, inView] = useInView({ threshold: 0.2 });
  const W = 600;
  const H = height;
  const pad = { t: 16, r: 16, b: 28, l: 32 };

  const coords = useMemo(() => {
    const n = points.length;
    return points.map((p, i) => ({
      ...p,
      x: pad.l + (n === 1 ? (W - pad.l - pad.r) / 2 : (i / (n - 1)) * (W - pad.l - pad.r)),
      y: pad.t + (1 - p.value / max) * (H - pad.t - pad.b),
    }));
  }, [points, H, max, pad.l, pad.r, pad.t, pad.b]);

  if (!points.length) return null;
  const line = coords.map((c, i) => `${i ? "L" : "M"}${c.x},${c.y}`).join(" ");
  const area = `${line} L${coords[coords.length - 1].x},${H - pad.b} L${coords[0].x},${H - pad.b} Z`;
  const active = hover != null ? coords[hover] : null;

  return (
    <div ref={ref} className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`area-${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#F04E23" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#F04E23" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 25, 50, 75, 100].map((g) => {
          const y = pad.t + (1 - g / max) * (H - pad.t - pad.b);
          return (
            <g key={g}>
              <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="#EFEDEA" strokeDasharray={g === 0 ? "0" : "3 4"} />
              <text x={pad.l - 8} y={y + 4} textAnchor="end" className="fill-stone-400" style={{ fontSize: 10 }}>
                {g}
              </text>
            </g>
          );
        })}
        <path d={area} fill={`url(#area-${id})`} className="transition-opacity duration-700" style={{ opacity: inView ? 1 : 0 }} />
        <path
          d={line}
          fill="none"
          stroke="#F04E23"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength="1"
          strokeDasharray="1"
          strokeDashoffset={inView ? 0 : 1}
          style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.22,1,0.36,1)" }}
        />
        {active && <line x1={active.x} x2={active.x} y1={pad.t} y2={H - pad.b} stroke="#D6D3D1" strokeDasharray="3 3" />}
        {coords.map((c, i) => (
          <g key={i}>
            <circle cx={c.x} cy={c.y} r={hover === i ? 6 : 4} fill="#fff" stroke="#F04E23" strokeWidth="2.5" style={{ transition: "r 150ms" }} />
            <rect
              x={c.x - (W / Math.max(points.length, 2)) / 2}
              y={0}
              width={W / Math.max(points.length, 2)}
              height={H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
            {(points.length <= 8 || i % Math.ceil(points.length / 8) === 0) && (
              <text x={c.x} y={H - 8} textAnchor="middle" className="fill-stone-400" style={{ fontSize: 10 }}>
                {c.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      {active && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl bg-ink px-3 py-2 text-center text-white shadow-lg animate-fade-in"
          style={{ left: `${(active.x / W) * 100}%`, top: `${(active.y / H) * 100}%`, marginTop: -10 }}
        >
          <p className="font-display text-[18px] leading-none">{active.value}</p>
          {active.sub && <p className="mt-1 whitespace-nowrap text-[11px] text-white/60">{active.sub}</p>}
        </div>
      )}
    </div>
  );
}
