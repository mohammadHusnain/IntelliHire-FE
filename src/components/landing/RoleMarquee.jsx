import { ROLE_CATEGORIES } from "@/data/rolesData";
import Reveal from "@/components/shared/Reveal";

const ROLES = ROLE_CATEGORIES.flatMap((c) => c.roles);
const HALF = Math.ceil(ROLES.length / 2);
const ROWS = [ROLES.slice(0, HALF), ROLES.slice(HALF)];

const ROLE_COUNT = ROLES.length;

export default function RoleMarquee() {
  return (
    <section className="py-16 sm:py-20" aria-label="Supported roles">
      <Reveal>
        <p className="text-center text-[13px] font-medium text-stone-500">
          Role-specific interviews across{" "}
          <span className="font-semibold text-ink">{ROLE_COUNT} roles</span> in{" "}
          <span className="font-semibold text-ink">{ROLE_CATEGORIES.length} disciplines</span>
        </p>
      </Reveal>
      <div className="mask-fade-x mt-7 space-y-3">
        {ROWS.map((row, r) => (
          <div key={r} className="marquee">
            <div
              className="marquee-track gap-3 pr-3"
              data-reverse={r === 1}
              style={{ "--marquee-duration": `${row.length * 3.2}s` }}
            >
              {[...row, ...row].map((role, i) => (
                <span
                  key={`${role}-${i}`}
                  aria-hidden={i >= row.length}
                  className="inline-flex h-11 shrink-0 items-center gap-2.5 rounded-full border border-[var(--line)] bg-white px-5 text-[14px] font-medium text-stone-600 transition-colors hover:border-brand/40 hover:text-ink"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-brand/70" />
                  {role}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
