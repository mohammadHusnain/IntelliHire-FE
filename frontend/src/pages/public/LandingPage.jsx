import { lazy, Suspense, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { LazyMotion } from "motion/react";
import PublicNavbar from "@/components/layout/PublicNavbar";
import PublicFooter from "@/components/layout/PublicFooter";
import RoleSearchHero from "@/components/landing/RoleSearchHero";
import { scrollToSection } from "@/hooks/useSectionNav";

const loadFeatures = () => import("@/lib/motionFeatures").then((mod) => mod.default);

const RoleCarousel = lazy(() => import("@/components/landing/RoleCarousel"));
const PlatformTabs = lazy(() => import("@/components/landing/PlatformTabs"));
const ReportAnatomy = lazy(() => import("@/components/landing/ReportAnatomy"));
const PipelineSection = lazy(() => import("@/components/landing/PipelineSection"));
const PrinciplesBand = lazy(() => import("@/components/landing/PrinciplesBand"));
const DisciplinesWall = lazy(() => import("@/components/landing/DisciplinesWall"));
const FaqSection = lazy(() => import("@/components/landing/FaqSection"));
const FinalCta = lazy(() => import("@/components/landing/FinalCta"));

function Slot({ minHeight, children }) {
  return <Suspense fallback={<div aria-hidden style={{ minHeight }} />}>{children}</Suspense>;
}

export default function LandingPage() {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const id = decodeURIComponent(hash.slice(1));
    let tries = 0;
    const timer = setInterval(() => {
      if (scrollToSection(id) || ++tries > 25) clearInterval(timer);
    }, 80);
    return () => clearInterval(timer);
  }, [hash]);

  return (
    <div className="min-h-screen overflow-x-clip bg-white font-sans text-stone-700 antialiased selection:bg-brand/15 selection:text-ink">
      <PublicNavbar showProgress />
      <LazyMotion features={loadFeatures} strict>
      <main>
        <RoleSearchHero />
        <Slot minHeight={900}>
          <RoleCarousel />
          <PlatformTabs />
          <ReportAnatomy />
          <PipelineSection />
          <PrinciplesBand />
          <DisciplinesWall />
          <FaqSection />
          <FinalCta />
        </Slot>
      </main>
      </LazyMotion>
      <PublicFooter />
    </div>
  );
}
