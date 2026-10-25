import { DISCIPLINE_ICON } from "./landingRoles";

const TONES = {
  Engineering: "from-brand to-brand-hover text-white",
  "AI & Data": "from-ink to-ink-soft text-white",
  "DevOps & Cloud": "from-brand-muted to-brand text-white",
  Design: "from-brand-soft to-brand-muted text-brand-hover",
  "Product & Management": "from-stone-100 to-stone-200 text-ink",
  Other: "from-white to-brand-soft text-brand",
};

export default function RoleArt({ category, emoji, size = 40, rounded = "rounded-xl", className = "" }) {
  const Icon = DISCIPLINE_ICON[category] || DISCIPLINE_ICON.Other;
  return (
    <span
      aria-hidden
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br ${TONES[category] || TONES.Other} ${rounded} ${className}`}
      style={{ width: size, height: size }}
    >
      <span className="bg-dot-grid-light absolute inset-0 opacity-60" />
      {emoji ? (
        <span className="relative leading-none" style={{ fontSize: Math.round(size * 0.52) }}>
          {emoji}
        </span>
      ) : (
        <Icon size={Math.round(size * 0.46)} className="relative" />
      )}
    </span>
  );
}

const EXTRA_SPOTS = [
  { cls: "left-[14%] top-[18%]", amp: 9, dur: 5.6, delay: -1.2, size: "text-[28px]" },
  { cls: "right-[15%] bottom-[16%]", amp: 11, dur: 6.8, delay: -3.1, size: "text-[32px]" },
];

export function RoleArtPanel({ category, emojis, className = "" }) {
  const Icon = DISCIPLINE_ICON[category] || DISCIPLINE_ICON.Other;
  return (
    <div
      aria-hidden
      className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br ${TONES[category] || TONES.Other} ${className}`}
    >
      <span className="bg-dot-grid-light absolute inset-0 opacity-70" />
      <span className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/15 blur-2xl" />
      <span className="absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-black/10 blur-2xl" />
      {emojis ? (
        <>
          <span
            className="float-amp relative text-[64px] leading-none drop-shadow-[0_8px_16px_rgba(13,13,13,0.25)]"
            style={{ "--float-amp": "8px", "--float-dur": "5s" }}
          >
            {emojis[0]}
          </span>
          {emojis.slice(1, 3).map((e, i) => (
            <span
              key={e + i}
              className={`float-amp absolute leading-none opacity-90 ${EXTRA_SPOTS[i].cls} ${EXTRA_SPOTS[i].size}`}
              style={{ "--float-amp": `${EXTRA_SPOTS[i].amp}px`, "--float-dur": `${EXTRA_SPOTS[i].dur}s`, "--float-delay": `${EXTRA_SPOTS[i].delay}s` }}
            >
              {e}
            </span>
          ))}
        </>
      ) : (
        <Icon size={64} strokeWidth={1.4} className="relative" />
      )}
    </div>
  );
}
