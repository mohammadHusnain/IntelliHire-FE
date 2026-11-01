import { Link } from "react-router-dom";
import { ArrowRight, Mic } from "lucide-react";
import illustration from "@/assets/auth-illustration.webp";
import Reveal from "@/components/shared/Reveal";

export default function FinalCta() {
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-24">
      <Reveal className="mx-auto max-w-6xl" y={24}>
        <div className="relative isolate grid grid-cols-1 overflow-hidden rounded-[32px] bg-brand-art text-white lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div aria-hidden className="bg-dot-grid-light pointer-events-none absolute inset-0 -z-10 opacity-70" />
          <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 -z-10 h-80 w-80 rounded-full bg-white/10 blur-3xl" />

          <div className="min-w-0 px-7 py-14 sm:px-12 sm:py-16 lg:py-20">
            <h2 className="display max-w-xl text-[36px] !text-white sm:text-[48px] lg:text-[56px]">
              Your next great hire is <em className="!text-white/85">one interview away.</em>
            </h2>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-white/80">
              Set up a role in minutes and let IntelliHire run the first rounds, or start practising
              for the interview you want.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link to="/register?role=company" className="btn-dark btn-lg">
                Start hiring <ArrowRight size={18} className="btn-arrow" />
              </Link>
              <Link to="/register?role=individual" className="btn-on-dark btn-lg">
                <Mic size={17} /> Practise free
              </Link>
            </div>
          </div>

          <div className="relative h-72 sm:h-80 lg:h-auto lg:min-h-[360px]">
            <img
              src={illustration}
              alt="A candidate in an interview with an AI interviewer"
              width={765}
              height={1024}
              loading="lazy"
              className="absolute bottom-0 left-1/2 h-full w-auto max-w-none -translate-x-1/2 object-contain transition-transform duration-700 ease-[var(--ease-premium)] hover:scale-[1.02]"
            />
          </div>
        </div>
      </Reveal>
    </section>
  );
}
