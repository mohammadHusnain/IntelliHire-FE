import { DISCIPLINE_ICON } from "./landingRoles";

const TONES = {
  Engineering: "from-brand to-brand-hover text-white",
  "AI & Data": "from-ink to-ink-soft text-white",
  "DevOps & Cloud": "from-brand-muted to-brand text-white",
  Design: "from-brand-soft to-brand-muted text-brand-hover",
  "Product & Management": "from-stone-100 to-stone-200 text-ink",
  Other: "from-white to-brand-soft text-brand",
};

export default function RoleArt({ category, size = 40, rounded = "rounded-xl", className = "" }) {
  const Icon = DISCIPLINE_ICON[category] || DISCIPLINE_ICON.Other;
  return (
    <span
      aria-hidden
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br ${TONES[category] || TONES.Other} ${rounded} ${className}`}
      style={{ width: size, height: size }}
    >
      <span className="bg-dot-grid-light absolute inset-0 opacity-60" />
      <Icon size={Math.round(size * 0.46)} className="relative" />
    </span>
  );
}

export function RoleArtPanel({ category, className = "" }) {
  const Icon = DISCIPLINE_ICON[category] || DISCIPLINE_ICON.Other;
  return (
    <div
      aria-hidden
      className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br ${TONES[category] || TONES.Other} ${className}`}
    >
      <span className="bg-dot-grid-light absolute inset-0 opacity-70" />
      <span className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/15 blur-2xl" />
      <span className="absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-black/10 blur-2xl" />
      <Icon size={64} strokeWidth={1.4} className="relative" />
    </div>
  );
}
