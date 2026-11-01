import Reveal from "@/components/shared/Reveal";

export default function SectionHeading({ eyebrow, title, subtitle, align = "center", tone = "dark", className = "" }) {
  const center = align === "center";
  return (
    <div className={`${center ? "mx-auto max-w-3xl text-center" : "max-w-xl"} ${className}`}>
      {eyebrow && (
        <Reveal>
          <span className={`eyebrow ${tone === "light" ? "!text-brand-muted" : ""}`}>{eyebrow}</span>
        </Reveal>
      )}
      <Reveal delay={80}>
        <h2
          className={`display mt-4 text-[34px] sm:text-[44px] lg:text-[52px] ${tone === "light" ? "!text-white" : ""}`}
        >
          {title}
        </h2>
      </Reveal>
      {subtitle && (
        <Reveal delay={160}>
          <p
            className={`mt-5 text-[16px] leading-relaxed sm:text-[18px] ${
              tone === "light" ? "text-white/60" : "text-stone-500"
            } ${center ? "mx-auto max-w-2xl" : ""}`}
          >
            {subtitle}
          </p>
        </Reveal>
      )}
    </div>
  );
}
