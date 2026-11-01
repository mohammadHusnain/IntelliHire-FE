import { m } from "motion/react";
import useReducedMotion from "@/hooks/useReducedMotion";
import { wordContainer, wordItem } from "@/lib/motion";

const TAGS = { h1: m.h1, h2: m.h2 };

/**
 * Word-by-word headline reveal. `segments` is [{ t: "text", em?: true }].
 * `trigger="mount"` plays on load; otherwise when scrolled into view.
 */
export default function WordReveal({
  as = "h2",
  segments,
  className = "",
  trigger = "view",
  play = true,
  delay = 0,
  stagger = 0.055,
}) {
  const reduced = useReducedMotion();
  const Tag = TAGS[as];
  const words = segments.flatMap((s, si) =>
    s.br
      ? [{ br: true, key: `br-${si}` }]
      : s.t
          .split(" ")
          .filter(Boolean)
          .map((w, wi) => ({ w, em: s.em, key: `${si}-${wi}` })),
  );
  const motionProps =
    trigger === "mount"
      ? { animate: play ? "show" : "hidden" }
      : { whileInView: "show", viewport: { once: true, amount: 0.6 } };

  return (
    <Tag
      className={className}
      variants={wordContainer(stagger, delay)}
      initial={reduced ? "show" : "hidden"}
      {...(reduced ? {} : motionProps)}
    >
      {words.map(({ w, em, br, key }) =>
        br ? (
          <br key={key} className="hidden sm:block" />
        ) : (
        <span key={key} className="inline-block whitespace-pre">
          <m.span variants={wordItem} className="inline-block">
            {em ? <em>{w}</em> : w}
          </m.span>{" "}
        </span>
        ),
      )}
    </Tag>
  );
}
