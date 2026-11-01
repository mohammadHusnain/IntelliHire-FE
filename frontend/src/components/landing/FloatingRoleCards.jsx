import { m, useTransform } from "motion/react";
import RoleArt from "./RoleArt";
import { FLOATING_ROLES, emojisFor } from "./landingRoles";
import { tween } from "@/lib/motion";

const SLOTS = [
  { side: "left", x: 1, y: 6, d: 1, amp: 12, dur: 7.5, s: 1, o: 1 },
  { side: "left", x: 8, y: 27, d: 0.5, amp: 8, dur: 9, s: 0.86, o: 0.7 },
  { side: "left", x: 1.5, y: 46, d: 0.85, amp: 14, dur: 8, s: 0.96, o: 1 },
  { side: "left", x: 7, y: 66, d: 0.4, amp: 7, dur: 10, s: 0.82, o: 0.65 },
  { side: "left", x: 2, y: 84, d: 1, amp: 11, dur: 7, s: 1, o: 1 },
  { side: "right", x: 3, y: 12, d: 0.55, amp: 9, dur: 9.5, s: 0.86, o: 0.7 },
  { side: "right", x: 1.5, y: 32, d: 1, amp: 13, dur: 7.8, s: 1, o: 1 },
  { side: "right", x: 8, y: 52, d: 0.45, amp: 8, dur: 10.5, s: 0.82, o: 0.65 },
  { side: "right", x: 1, y: 68, d: 0.9, amp: 12, dur: 8.4, s: 0.98, o: 1 },
  { side: "right", x: 6, y: 86, d: 0.5, amp: 9, dur: 9.2, s: 0.86, o: 0.7 },
];

export function RoleCard({ role, className = "" }) {
  return (
    <div className={`surface flex w-[208px] items-center gap-3 p-3 shadow-[0_18px_36px_-22px_rgba(13,13,13,0.35)] ${className}`}>
      <RoleArt category={role.category} emoji={emojisFor(role.name)[0]} size={44} />
      <div className="min-w-0 text-left">
        <p className="line-clamp-2 text-[13px] font-semibold leading-tight text-ink">{role.name}</p>
        <p className="mt-0.5 truncate text-[11px] text-stone-500">{role.category}</p>
        <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Interview ready
        </span>
      </div>
    </div>
  );
}

function FloatCard({ role, slot, index, px, py, paused, reduced }) {
  const x = useTransform(px, [-1, 1], [-14 * slot.d, 14 * slot.d]);
  const y = useTransform(py, [-1, 1], [-14 * slot.d, 14 * slot.d]);
  return (
    <m.div className="absolute" style={{ [slot.side]: `${slot.x}%`, top: `${slot.y}%`, x, y, scale: slot.s }}>
      <m.div
        initial={reduced ? false : { opacity: 0, scale: 0.9, y: 22 }}
        animate={{ opacity: slot.o, scale: 1, y: 0 }}
        transition={tween(0.8, 0.45 + index * 0.07)}
      >
        <div
          className="float-amp"
          style={{
            "--float-amp": `${slot.amp}px`,
            "--float-dur": `${slot.dur}s`,
            "--float-delay": `${-index * 1.3}s`,
            animationPlayState: paused ? "paused" : "running",
          }}
        >
          <RoleCard role={role} />
        </div>
      </m.div>
    </m.div>
  );
}

export function RoleStrip() {
  return (
    <ul aria-hidden className="no-scrollbar relative z-10 mt-12 flex snap-x gap-3 overflow-x-auto px-6 pb-3 xl:hidden">
      {FLOATING_ROLES.map((role) => (
        <li key={role.name} className="shrink-0 snap-start first:ml-auto last:mr-auto">
          <RoleCard role={role} />
        </li>
      ))}
    </ul>
  );
}

export default function FloatingRoleCards({ px, py, paused, reduced }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-28 top-24 z-0 hidden xl:block">
      {SLOTS.map((slot, i) => (
        <FloatCard
          key={FLOATING_ROLES[i].name}
          role={FLOATING_ROLES[i]}
          slot={slot}
          index={i}
          px={px}
          py={py}
          paused={paused}
          reduced={reduced}
        />
      ))}
    </div>
  );
}
