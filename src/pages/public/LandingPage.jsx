import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import PublicNavbar from "@/components/layout/PublicNavbar";
import PublicFooter from "@/components/layout/PublicFooter";
import Hero from "@/components/landing/Hero";
import RoleMarquee from "@/components/landing/RoleMarquee";
import PlatformTabs from "@/components/landing/PlatformTabs";
import PipelineSection from "@/components/landing/PipelineSection";
import FeatureBento from "@/components/landing/FeatureBento";
import PrinciplesBand from "@/components/landing/PrinciplesBand";
import Testimonials from "@/components/landing/Testimonials";
import FaqSection from "@/components/landing/FaqSection";
import FinalCta from "@/components/landing/FinalCta";
import { scrollToSection } from "@/hooks/useSectionNav";

export default function LandingPage() {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const id = decodeURIComponent(hash.slice(1));
    const t = setTimeout(() => scrollToSection(id), 60);
    return () => clearTimeout(t);
  }, [hash]);

  return (
    <div className="min-h-screen overflow-x-clip bg-white font-sans text-stone-700 antialiased selection:bg-brand/15 selection:text-ink">
      <PublicNavbar showProgress />
      <main>
        <Hero />
        <RoleMarquee />
        <PlatformTabs />
        <PipelineSection />
        <FeatureBento />
        <PrinciplesBand />
        <Testimonials />
        <FaqSection />
        <FinalCta />
      </main>
      <PublicFooter />
    </div>
  );
}
