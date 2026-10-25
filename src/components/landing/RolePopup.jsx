import { useEffect, useId, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { AnimatePresence, m } from "motion/react";
import { ArrowRight, X } from "lucide-react";
import { RoleArtPanel } from "./RoleArt";
import { sampleQuestions } from "./landingRoles";
import { INTERVIEW_TYPES, skillsForRole } from "@/lib/interview/questionBank";
import { SPRING_POPUP, tween } from "@/lib/motion";

const FOCUSABLE = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';

function Dialog({ role, onClose }) {
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const titleId = useId();
  const questions = useMemo(() => sampleQuestions(role.name, 3), [role.name]);
  const skills = useMemo(() => skillsForRole(role.name).slice(0, 8), [role.name]);

  useEffect(() => {
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    const prevPad = document.body.style.paddingRight;
    const gap = window.innerWidth - root.clientWidth;
    root.style.overflow = "hidden";
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    closeRef.current?.focus({ preventScroll: true });

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Tab" && panelRef.current) {
        const items = [...panelRef.current.querySelectorAll(FOCUSABLE)];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      root.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPad;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-3 sm:items-center sm:p-6">
      <m.div
        aria-hidden
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={tween(0.25)}
        className="absolute inset-0 bg-ink/45 backdrop-blur-[6px]"
      />
      <m.div
        ref={panelRef}
        layoutId={`role-card-${role.name}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        transition={SPRING_POPUP}
        style={{ borderRadius: 28 }}
        className="relative flex max-h-[calc(100dvh-24px)] w-full max-w-2xl flex-col overflow-hidden bg-white shadow-[0_50px_100px_-30px_rgba(13,13,13,0.55)] sm:max-h-[min(720px,calc(100dvh-48px))]"
      >
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: tween(0.3, 0.12) }}
          exit={{ opacity: 0, transition: { duration: 0.08 } }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="relative shrink-0">
            <RoleArtPanel category={role.category} className="h-28 sm:h-36" />
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close role preview"
              className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm backdrop-blur transition-colors hover:bg-white"
            >
              <X size={18} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-6 sm:px-8 sm:pb-8">
            <p className="eyebrow">{role.category}</p>
            <h3 id={titleId} className="display mt-3 text-[30px] sm:text-[36px]">
              {role.name}
            </h3>
            <p className="mt-2 text-[14px] text-stone-500">
              Sample questions from a role-specific, mid-level interview.
            </p>

            <ol className="mt-6 space-y-3">
              {questions.map((q, i) => (
                <li key={q.id} className="flex gap-4 rounded-2xl border border-[var(--line)] bg-[#FBFAF9] p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-semibold text-white">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[15px] leading-relaxed text-ink">{q.text}</p>
                    <span className="mt-2 inline-block rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-stone-500 ring-1 ring-[var(--line)]">
                      {INTERVIEW_TYPES.find((t) => t.id === q.kind)?.title ?? "General"}
                    </span>
                  </div>
                </li>
              ))}
            </ol>

            <p className="mt-7 text-[12px] font-semibold uppercase tracking-[0.08em] text-stone-400">
              Skills this role is assessed on
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {skills.map((s) => (
                <li key={s} className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-[13px] font-medium text-stone-600">
                  {s}
                </li>
              ))}
            </ul>

          </div>

          <div className="flex shrink-0 flex-col gap-3 border-t border-[var(--line)] bg-white px-6 py-4 sm:flex-row sm:px-8">
            <Link to="/register?role=individual" className="btn-primary btn-lg flex-1 sm:flex-none">
              Practise this interview <ArrowRight size={18} className="btn-arrow" />
            </Link>
            <button type="button" onClick={onClose} className="btn-secondary btn-lg hidden sm:inline-flex">
              Keep browsing
            </button>
          </div>
        </m.div>
      </m.div>
    </div>
  );
}

export default function RolePopup({ role, onClose, onExited }) {
  return createPortal(
    <AnimatePresence onExitComplete={onExited}>{role && <Dialog key={role.name} role={role} onClose={onClose} />}</AnimatePresence>,
    document.body,
  );
}
