import { useEffect, useState, useRef } from "react";
import heroSectionImg from "../../assets/herosection image intellihire.png";
import integrationsImg from "../../assets/section 2 image intellihire.png";
import saveTimeImg from "../../assets/save time and money image section intellihire.png";
import automateImg from "../../assets/automate process image intellihire .png";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ArrowRight,
  Play,
  Sparkles,
  Video,
  Mic,
  Share2,
  Search,
  Filter,
  Star,
  Clock,
  Zap,
  Shield,
  Globe,
  Users,
  BarChart3,
  TrendingUp,
  MessageSquare,
  FileText,
  Calendar,
  Award,
  Lock,
  Eye,
  ThumbsUp,
  Heart,
  ExternalLink,
  Layers,
  Monitor,
  Settings,
  Check,
  X,
  Menu,
  Mail,
  Phone,
  MapPin
} from "lucide-react";

/* ─── Logo ─── */
const IntelliHireLogo = ({ className = "", color = "#F04E23" }) => (
  <svg viewBox="0 0 40 40" className={className} fill="none">
    <rect width="40" height="40" rx="10" fill={color} fillOpacity="0.1" />
    <path d="M12 12h4v16h-4zM18 16h4v12h-4zM24 8h4v20h-4z" fill={color} />
    <circle cx="30" cy="30" r="4" fill={color} />
  </svg>
);

/* ─── Animated Typing Headline ─── */
const AnimatedHeadline = () => {
  const phrases = ["Hire Faster", "Hire Smarter", "Hire Better"];
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const phrase = phrases[idx];
    if (paused) {
      const t = setTimeout(() => setPaused(false) || setDeleting(true), 1800);
      return () => clearTimeout(t);
    }
    const speed = deleting ? 70 : 130;
    const t = setTimeout(() => {
      if (!deleting) {
        if (text.length < phrase.length) setText(phrase.slice(0, text.length + 1));
        else setPaused(true);
      } else {
        if (text.length > 0) setText(text.slice(0, -1));
        else { setDeleting(false); setIdx((p) => (p + 1) % phrases.length); }
      }
    }, speed);
    return () => clearTimeout(t);
  }, [text, idx, deleting, paused, phrases]);

  return (
    <h1 className="text-[34px] sm:text-[42px] md:text-[50px] lg:text-[58px] font-extrabold leading-[1.08] tracking-tight text-slate-900">
      The AI Platform to
      <br />
      <span className="text-[#F04E23] relative inline-flex items-center min-h-[1.2em]">
        {text}
        <span className="ml-1 inline-block w-[3px] h-[0.85em] bg-[#F04E23] animate-pulse" />
      </span>
    </h1>
  );
};

/* ─── Interactive Feature Cards (Hireflix-style) ─── */
const interactiveCards = [
  {
    icon: Calendar,
    title: "No more scheduling",
    desc: "Candidates record responses whenever suits them — no back-and-forth emails or calendar chaos, ever.",
  },
  {
    icon: Users,
    title: "More candidates, less time",
    desc: "Screen 10× more applicants in the same window. Our AI automatically surfaces your highest-potential candidates.",
  },
  {
    icon: Share2,
    title: "Share recorded interviews",
    desc: "Share candidate videos with any stakeholder via a secure, private link — no login or account required.",
  },
  {
    icon: Layers,
    title: "Integrated with your ATS",
    desc: "Connects directly with Greenhouse, Lever, BambooHR, and 50+ platforms with a single one-click setup.",
  },
  {
    icon: ThumbsUp,
    title: "Great candidate experience",
    desc: "Candidates love the freedom to record on any device, at any hour, from any time zone worldwide.",
  },
];

const cardTestimonials = [
  { quote: "No more back-and-forth. We moved our entire screening process to IntelliHire in a weekend — and never looked back.", person: "Amara Diallo", role: "HR Director", company: "TechForward Inc.", avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=AmaraDiallo&backgroundColor=fde8e4" },
  { quote: "We screened 400 candidates in under a week. IntelliHire made it feel effortless — the AI ranking alone saved us 30+ hours.", person: "Marcus Lee", role: "Head of Recruitment", company: "Scalr Labs", avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=MarcusLee&backgroundColor=dde8f8" },
  { quote: "Sharing candidate videos with our CEO used to take days of coordination. Now it's a single link, done in seconds.", person: "Sophie Andersen", role: "Talent Acquisition Lead", company: "Meridian Group", avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=SophieAndersen&backgroundColor=d4f0e8" },
  { quote: "Plugged into our Greenhouse ATS in 10 minutes. The integration was seamless — our whole pipeline moved faster immediately.", person: "Raj Patel", role: "VP of People Ops", company: "Nexus Software", avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=RajPatel&backgroundColor=e8e4f8" },
  { quote: "Candidates consistently rate the process a 5 out of 5. Flexible, respectful of their time — it sets us apart as an employer.", person: "Chloe Martin", role: "Senior Recruiter", company: "BrightPath HR", avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=ChloeMartin&backgroundColor=fef3e2" },
];

const InteractiveCards = () => {
  const [active, setActive] = useState(1);
  const t = cardTestimonials[active];
  return (
    <section id="why" className="py-24 bg-white border-t border-slate-100">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl lg:text-[46px] font-extrabold text-slate-900 leading-[1.1] tracking-tight">
            Why use IntelliHire's one-way<br className="hidden md:block" /> video interview software?
          </h2>
        </div>

        {/* Cards row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          {interactiveCards.map((card, i) => {
            const Icon = card.icon;
            const isActive = active === i;
            return (
              <button
                key={i}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                className={`relative p-6 rounded-2xl border-2 text-center transition-all duration-250 cursor-default outline-none
                  ${isActive
                    ? "border-[#F04E23] bg-[#FFF4F1] shadow-xl shadow-[#F04E23]/12 scale-[1.04]"
                    : "border-slate-200 bg-white hover:border-[#FCA68A]/60 hover:shadow-md hover:scale-[1.01]"
                  }`}
              >
                {/* Large icon with orange transparent circle bg */}
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 transition-all duration-250
                  ${isActive
                    ? "bg-[#F04E23]/15 shadow-inner shadow-[#F04E23]/10"
                    : "bg-[#F04E23]/6"
                  }`}
                >
                  <Icon
                    size={36}
                    className={`transition-colors duration-250 ${isActive ? "text-[#F04E23]" : "text-[#F04E23]/40"}`}
                    strokeWidth={isActive ? 2 : 1.5}
                  />
                </div>
                <p className={`text-[14px] font-bold leading-snug transition-colors duration-200 ${isActive ? "text-[#F04E23]" : "text-slate-600"}`}>
                  {card.title}
                </p>
                {isActive && (
                  <span className="absolute -bottom-[6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-[#F04E23] rotate-45 rounded-sm shadow-sm" />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Hireflix-style testimonial block ── */}
        <div
          key={`testi-${active}`}
          className="grid lg:grid-cols-2 gap-10 items-center pt-10 border-t border-slate-100"
          style={{ animation: "fadeSlideUp 0.3s ease both" }}
        >
          {/* Left: Big quote marks + quote text */}
          <div className="relative pl-4">
            {/* Big opening double-quote */}
            <div
              className="absolute -top-6 -left-2 select-none pointer-events-none"
              style={{ fontSize: "110px", lineHeight: 1, color: "#F04E23", opacity: 0.18, fontFamily: "Georgia, serif", fontWeight: 900 }}
            >
              ❝❝
            </div>
            <p className="relative z-10 text-[20px] md:text-[24px] font-semibold text-slate-800 leading-[1.4] pt-10">
              {t.quote}
            </p>
          </div>

          {/* Right: Avatar + name + role + company */}
          <div className="flex items-center gap-5 lg:justify-end">
            <img
              src={t.avatar}
              alt={t.person}
              className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-xl flex-shrink-0"
            />
            <div>
              <p className="text-[19px] font-extrabold text-slate-900 leading-tight">{t.person}</p>
              <p className="text-[12px] font-bold text-[#F04E23] uppercase tracking-widest mt-0.5">{t.role}</p>
              <div className="flex items-center gap-1.5 mt-2">
                <div className="w-5 h-5 rounded-full bg-[#FFF4F1] border border-[#F04E23]/20 flex items-center justify-center">
                  <span className="text-[8px] font-black text-[#F04E23]">{t.company.split(" ").map(w => w[0]).slice(0,2).join("")}</span>
                </div>
                <span className="text-[13px] text-slate-500 font-medium">{t.company}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ─── Brand Icons ─── */
const BrandIcon = ({ name, size = 32 }) => {
  const r = size;
  switch (name) {
    case "Slack":
      return (
        <svg width={r} height={r} viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="white" stroke="#F1F5F9" strokeWidth="1"/>
          <rect x="4" y="13.5" width="7.5" height="5" rx="2.5" fill="#E01E5A"/>
          <rect x="20.5" y="13.5" width="7.5" height="5" rx="2.5" fill="#36C5F0"/>
          <rect x="13.5" y="4" width="5" height="7.5" rx="2.5" fill="#2EB67D"/>
          <rect x="13.5" y="20.5" width="5" height="7.5" rx="2.5" fill="#ECB22E"/>
          <rect x="11.5" y="13.5" width="4" height="5" rx="2" fill="#E01E5A" opacity="0.5"/>
          <rect x="16.5" y="13.5" width="4" height="5" rx="2" fill="#36C5F0" opacity="0.5"/>
          <rect x="13.5" y="11.5" width="5" height="4" rx="2" fill="#2EB67D" opacity="0.5"/>
          <rect x="13.5" y="16.5" width="5" height="4" rx="2" fill="#ECB22E" opacity="0.5"/>
        </svg>
      );
    case "Framer":
      return (
        <svg width={r} height={r} viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="#EFF6FF"/>
          <path d="M8 5h16v11H16L8 5z" fill="#0055FF"/>
          <path d="M8 16h8v11L8 16z" fill="#0055FF" opacity="0.55"/>
          <path d="M16 16h8L16 27V16z" fill="#0055FF" opacity="0.8"/>
        </svg>
      );
    case "Raycast":
      return (
        <svg width={r} height={r} viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="#FEF2F2"/>
          <path d="M7 25L15 17M15 17L23 9M15 17H7M15 17V25" stroke="#FF6363" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="23" cy="9" r="3" fill="#FF6363"/>
        </svg>
      );
    case "BambooHR":
      return (
        <svg width={r} height={r} viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="16" fill="#89C540"/>
          <path d="M13 26V17M13 17C13 14 11 12 11 12M13 17C13 14 15 12 15 12" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
          <path d="M19 26V14M19 14C19 11 17 9 17 9M19 14C19 11 21 9 21 9" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
        </svg>
      );
    case "Zapier":
      return (
        <svg width={r} height={r} viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="#FFF4F0"/>
          <path d="M8 10h16M8 10L24 22M8 22h16" stroke="#FF4A00" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case "Greenhouse":
      return (
        <svg width={r} height={r} viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="#24A47F"/>
          <path d="M22 15H16V19H22C21 21.5 18.5 23 16 23C12.5 23 9.5 20 9.5 16C9.5 12 12.5 9 16 9C18.5 9 20.5 10.5 21.5 12L23.5 10C22 7.5 19.2 6 16 6C10.5 6 6.5 10.5 6.5 16C6.5 21.5 10.5 26 16 26C21.5 26 25.5 22 25.5 16.5V15H22Z" fill="white"/>
        </svg>
      );
    case "Workable":
      return (
        <svg width={r} height={r} viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="#EFF6FF"/>
          <path d="M6 8l3.5 16 4.5-10 4.5 10L22 8" stroke="#2B5BE0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M22 8l4 16" stroke="#2B5BE0" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      );
    case "Stripe":
      return (
        <svg width={r} height={r} viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="#EEF2FF"/>
          <path d="M16 8c-3.5 0-6 1.8-6 5 0 7 10 5 10 10.5 0 3.5-2.5 5.5-6 5.5" stroke="#635BFF" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M13.5 5.5v3M13.5 23.5v3" stroke="#635BFF" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      );
    case "Notion":
      return (
        <svg width={r} height={r} viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="#F3F4F6"/>
          <path d="M9 7v18M9 7l14 18M23 7v18" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case "Linear":
      return (
        <svg width={r} height={r} viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="#EEF2FF"/>
          <path d="M7 25L25 7" stroke="#5E6AD2" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M7 17L17 7" stroke="#5E6AD2" strokeWidth="2" strokeLinecap="round" opacity="0.55"/>
          <path d="M15 25L25 15" stroke="#5E6AD2" strokeWidth="2" strokeLinecap="round" opacity="0.55"/>
          <circle cx="25" cy="7" r="3" fill="#5E6AD2"/>
        </svg>
      );
    case "Vercel":
      return (
        <svg width={r} height={r} viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="#F3F4F6"/>
          <path d="M16 6L28 26H4L16 6z" fill="#111827"/>
        </svg>
      );
    case "Figma":
      return (
        <svg width={r} height={r} viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="#FFF8F7"/>
          <rect x="11" y="6" width="5" height="10" rx="2.5" fill="#F24E1E"/>
          <rect x="16" y="6" width="5" height="10" rx="2.5" fill="#A259FF"/>
          <rect x="11" y="16" width="5" height="10" rx="2.5" fill="#0ACF83"/>
          <circle cx="18.5" cy="21" r="2.5" fill="#1ABCFE"/>
        </svg>
      );
    case "Pitch":
      return (
        <svg width={r} height={r} viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="#F5F3FF"/>
          <circle cx="13" cy="16" r="6" fill="#7B68EE"/>
          <circle cx="21" cy="12" r="5" fill="#7B68EE" opacity="0.45"/>
        </svg>
      );
    default:
      return (
        <svg width={r} height={r} viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="#F3F4F6"/>
        </svg>
      );
  }
};

/* ─── Data ─── */
const trustedCompanies = [
  { name: "Stripe",     color: "#635BFF", bg: "#EEF2FF",  letter: "S"  },
  { name: "Notion",     color: "#374151", bg: "#F3F4F6",  letter: "N"  },
  { name: "Linear",     color: "#5E6AD2", bg: "#EEF2FF",  letter: "L"  },
  { name: "Vercel",     color: "#111827", bg: "#F3F4F6",  letter: "▲"  },
  { name: "Figma",      color: "#F24E1E", bg: "#FFF4F1",  letter: "F"  },
  { name: "Framer",     color: "#0055FF", bg: "#EFF6FF",  letter: "Fr" },
  { name: "Pitch",      color: "#7B68EE", bg: "#F5F3FF",  letter: "P"  },
  { name: "Raycast",    color: "#FF6363", bg: "#FEF2F2",  letter: "R"  },
  { name: "BambooHR",   color: "#89C540", bg: "#F0FDF4",  letter: "B"  },
  { name: "Workable",   color: "#2B5BE0", bg: "#EFF6FF",  letter: "W"  },
  { name: "Greenhouse", color: "#24A47F", bg: "#F0FDF4",  letter: "G"  },
  { name: "Zapier",     color: "#FF4A00", bg: "#FFF4F1",  letter: "Z"  },
];

const whyFeatures = [
  { icon: Video, title: "Eliminate scheduling", desc: "Remove the back-and-forth of interview scheduling. Candidates record when they're ready." },
  { icon: Search, title: "Screen faster", desc: "Review 10x more candidates in the same amount of time with structured video responses." },
  { icon: Share2, title: "Share effortlessly", desc: "Share standout candidates with hiring managers via simple links or full exports." },
  { icon: Filter, title: "Compare easily", desc: "Side-by-side candidate comparison with structured responses and team ratings." },
  { icon: Clock, title: "Save time", desc: "Reduce time-to-hire by 65% with asynchronous screening and AI-powered insights." },
];

const features = [
  { icon: Video, title: "One-way video interviews", desc: "Candidates record responses on their own time. No scheduling required." },
  { icon: Mic, title: "AI-powered assessments", desc: "Our AI analyzes tone, content, and confidence to give you deeper candidate insights." },
  { icon: Globe, title: "Multi-language support", desc: "Conduct interviews in 30+ languages with automatic translation and transcription." },
  { icon: Shield, title: "GDPR compliant", desc: "Enterprise-grade security and full GDPR compliance built-in from day one." },
  { icon: BarChart3, title: "Advanced analytics", desc: "Get detailed insights on candidate responses, team feedback, and hiring funnel metrics." },
  { icon: Users, title: "Collaborative hiring", desc: "Enable unlimited team collaboration with shared notes, ratings, and structured reviews." },
];

const howSteps = [
  { num: "01", title: "Create your interview", desc: "Set up custom questions or let our AI generate role-specific questions in seconds." },
  { num: "02", title: "Invite candidates", desc: "Send links via email, embed on your careers page, or integrate with your ATS." },
  { num: "03", title: "Review & decide", desc: "Watch responses, see AI scores, collaborate with your team, and make confident hires." },
];

const analytics = [
  { label: "Interviews conducted", value: "1.2M+", icon: Video },
  { label: "Avg. time saved", value: "12 hrs", icon: Clock },
  { label: "Customer satisfaction", value: "4.9/5", icon: Star },
  { label: "Companies using us", value: "3,500+", icon: Users },
];

const benefits = [
  { icon: Zap, title: "Lightning fast setup", desc: "Go from sign-up to your first interview in under 5 minutes. No engineering required." },
  { icon: Lock, title: "Bank-level security", desc: "SOC 2 Type II certified with end-to-end encryption for all video and data storage." },
  { icon: Eye, title: "Unbiased evaluation", desc: "AI evaluates responses objectively based on content and skills, removing unconscious bias." },
  { icon: ThumbsUp, title: "Better candidate experience", desc: "Candidates love the flexibility. Complete interviews on their schedule, from any device." },
];

const testimonials = [
  { quote: "IntelliHire reduced our time-to-hire by 70%. The async format lets us screen 10x more candidates without adding headcount.", author: "Sarah Chen",   role: "Head of Talent",      company: "Stripe", avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=SarahChen&backgroundColor=fde8e4"   },
  { quote: "Finally, a screening tool that our engineering team actually wants to use. The video responses give real signal.",                                     author: "Michael Ross",  role: "VP of Engineering",  company: "Notion", avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=MichaelRoss&backgroundColor=dde8f8"  },
  { quote: "We've cut our recruiting costs in half while improving candidate quality. The ROI was immediate and measurable.",                                      author: "Emma Wilson",   role: "People Director",    company: "Linear", avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=EmmaWilson&backgroundColor=d4f0e8"   },
  { quote: "The collaborative features transformed how we hire. Every stakeholder can review candidates on their own schedule.",                                   author: "David Park",    role: "CEO",                company: "Vercel", avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=DavidPark&backgroundColor=e8e4f8"    },
  { quote: "Best candidate experience we've ever offered. Candidates love the flexibility and transparency of the process.",                                      author: "Lisa Johnson",  role: "Recruiting Lead",    company: "Figma",  avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=LisaJohnson&backgroundColor=fef3e2"  },
  { quote: "From 3 weeks to 3 days. That's how much faster we now move top candidates through our pipeline.",                                                     author: "James Miller",  role: "Talent Partner",     company: "Framer", avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=JamesMiller&backgroundColor=e2f0fe"  },
];

const faqData = [
  { q: "What is a one-way video interview?", a: "One-way video interviews allow candidates to record their responses to your questions on their own time. There's no need for live scheduling — candidates respond when convenient, and your team reviews when ready." },
  { q: "How long does it take to set up?", a: "You can create your first interview and start inviting candidates in under 5 minutes. Our templates and AI-generated questions make it incredibly fast to get started." },
  { q: "Can I use my own questions?", a: "Absolutely. You can create fully custom interviews, use our templates, or let our AI generate questions based on the role and skills you're hiring for." },
  { q: "How do candidates complete interviews?", a: "Candidates receive a simple link, click to start, and record responses using any device with a camera. No app download or account creation required." },
  { q: "Is IntelliHire GDPR compliant?", a: "Yes, we're fully GDPR compliant with EU data residency, right-to-be-forgotten features, and enterprise-grade security. We're SOC 2 Type II certified." },
  { q: "What integrations do you support?", a: "We integrate with all major ATS platforms including Greenhouse, Lever, Workday, Ashby, and BambooHR. We also offer a robust API and Zapier connection." },
  { q: "Can team members collaborate on reviews?", a: "Yes, unlimited team members can watch, rate, comment, and share feedback on candidates. All feedback is centralized in one place." },
];

const footerLinks = {
  Product: ["Features", "Pricing", "Integrations", "API", "Security"],
  Solutions: ["For Startups", "For Enterprise", "For Agencies", "For Tech", "For Retail"],
  Resources: ["Blog", "Guides", "Webinars", "Case Studies", "Help Center"],
  Company: ["About", "Careers", "Contact", "Press", "Partners"],
};

/* ─── Main Component ─── */
function LandingPage() {
  const [shadow, setShadow] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setShadow(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased selection:bg-orange-100 selection:text-orange-900">

      {/* ===== NAVIGATION ===== */}
      <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${shadow ? "bg-white/90 backdrop-blur-md shadow-sm border-b border-slate-100" : "bg-transparent"}`}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
          <a href="/" className="flex items-center gap-2.5">
            <IntelliHireLogo className="w-8 h-8" />
            <span className="text-[20px] font-bold text-slate-900" style={{ fontFamily: 'Times New Roman, serif' }}>IntelliHire</span>
          </a>

          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-500 lg:flex">
            <button onClick={() => scrollTo("why")} className="hover:text-slate-900 transition-colors">Why IntelliHire</button>
            <button onClick={() => scrollTo("features")} className="hover:text-slate-900 transition-colors">Features</button>
            <button onClick={() => scrollTo("how-it-works")} className="hover:text-slate-900 transition-colors">How it works</button>
            <button onClick={() => scrollTo("testimonials")} className="hover:text-slate-900 transition-colors">Reviews</button>
            <button onClick={() => scrollTo("faq")} className="hover:text-slate-900 transition-colors">FAQ</button>
          </nav>

          <div className="flex items-center gap-3">
            <a href="/login" className="hidden sm:block text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">Log in</a>
            <a href="/register" className="rounded-full bg-[#F04E23] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#F04E23]/20 transition hover:bg-[#D43D14] hover:shadow-lg">Get started free</a>
            <button className="lg:hidden p-2 text-slate-600" onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X size={22} /> : <Menu size={22} />}</button>
          </div>
        </div>

        {mobileOpen && (
          <div className="lg:hidden bg-white border-t border-slate-100 px-6 py-4 shadow-lg">
            <nav className="flex flex-col gap-3 text-sm font-medium text-slate-600">
              <button onClick={() => scrollTo("why")} className="text-left py-1">Why IntelliHire</button>
              <button onClick={() => scrollTo("features")} className="text-left py-1">Features</button>
              <button onClick={() => scrollTo("how-it-works")} className="text-left py-1">How it works</button>
              <button onClick={() => scrollTo("testimonials")} className="text-left py-1">Reviews</button>
              <button onClick={() => scrollTo("faq")} className="text-left py-1">FAQ</button>
            </nav>
          </div>
        )}
      </header>

      {/* ===== HERO ===== */}
      <section className="relative pt-28 pb-20 lg:pt-36 lg:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#FFF4F1]/60 via-white to-white -z-10" />
        <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-[#FCA68A]/20 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-20 w-[400px] h-[400px] bg-emerald-200/15 rounded-full blur-3xl -z-10" />

        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          {/* Two-column hero */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: Text + CTAs */}
            <div>
              <AnimatedHeadline />
              <p className="mt-6 text-lg md:text-xl text-slate-500 leading-relaxed max-w-xl">
                The modern way to screen and interview candidates. AI-powered, asynchronous, and loved by hiring teams worldwide.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <a href="/register" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#F04E23] px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#F04E23]/25 transition hover:bg-[#D43D14] hover:shadow-xl hover:-translate-y-0.5">
                  Get started free <ArrowRight size={18} />
                </a>
                <a href="#demo" className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-8 py-3.5 text-base font-semibold text-slate-700 transition hover:border-[#FFA07A] hover:text-[#F04E23] bg-white">
                  <Play size={18} className="fill-current" /> Watch demo
                </a>
              </div>
              <div className="mt-6 flex items-center gap-5 text-sm text-slate-400">
                <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> No credit card</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> 14-day free trial</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> Cancel anytime</span>
              </div>
            </div>

            {/* Right: Hero screenshot */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-tr from-[#FCA68A]/20 via-transparent to-emerald-200/20 rounded-3xl blur-2xl -z-10" />
              <img
                src={heroSectionImg}
                alt="IntelliHire interview review interface"
                className="w-full rounded-2xl shadow-2xl shadow-slate-900/10 border border-slate-200/80 object-cover"
              />
              {/* Floating AI badge */}
              <div className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-lg border border-slate-200 px-4 py-2.5 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center text-white text-sm">⭐</div>
                <div>
                  <p className="text-xs font-bold text-slate-900">AI Score: 96/100</p>
                  <p className="text-[10px] text-slate-500">Perfect candidate match</p>
                </div>
              </div>
              {/* Floating stat */}
              <div className="absolute -top-4 -right-4 bg-white rounded-xl shadow-lg border border-slate-200 px-4 py-2.5">
                <p className="text-xs font-bold text-emerald-600">+65% faster hiring</p>
                <p className="text-[10px] text-slate-500">vs traditional process</p>
              </div>
            </div>
          </div>

          {/* Trusted By — Animated Belt */}
          <div className="mt-16">
            <p className="text-center text-xs font-semibold text-slate-400 uppercase tracking-widest mb-6">Trusted by innovative teams at</p>
            <div className="relative overflow-hidden">
              {/* Left/right fade masks */}
              <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
              <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
              <div className="flex items-center py-2" style={{ animation: "marquee 32s linear infinite" }}>
                {[...trustedCompanies, ...trustedCompanies].map((c, i) => (
                  <div key={i} className="flex items-center gap-2.5 mx-7 flex-shrink-0 group cursor-default select-none">
                    <div className="transition-transform group-hover:scale-110 flex-shrink-0">
                      <BrandIcon name={c.name} size={32} />
                    </div>
                    <span className="text-[15px] font-semibold whitespace-nowrap transition-opacity group-hover:opacity-80" style={{ color: c.color, opacity: 0.55 }}>
                      {c.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ===== WHY USE — Interactive Cards ===== */}
      <InteractiveCards />

      {/* ===== SAVE TIME & MONEY ===== */}
      <section className="py-24 bg-slate-50/50 border-t border-slate-100">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Text */}
            <div>
              <span className="text-xs font-extrabold text-[#F04E23] uppercase tracking-[0.18em]">Save Time and Money</span>
              <h2 className="mt-4 text-[40px] md:text-[52px] lg:text-[60px] font-extrabold text-slate-900 leading-[1.04] tracking-tight">
                Record once,<br /> interview 1000
              </h2>
              <p className="mt-6 text-[17px] text-slate-500 leading-relaxed max-w-lg">
                Build your digital interview <span className="text-[#F04E23] font-semibold">once</span> and invite as many candidates as you need. Harness the power of <span className="text-[#F04E23] font-semibold">asynchronous interviews</span> and reclaim hundreds of hours in your search for <span className="text-[#F04E23] font-semibold">top talent</span>.
              </p>
              <a href="/register" className="mt-9 inline-flex items-center gap-2 rounded-full bg-[#F04E23] px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#F04E23]/25 transition hover:bg-[#D43D14] hover:shadow-xl hover:-translate-y-0.5">
                Start for free <ArrowRight size={16} />
              </a>
            </div>
            {/* Right: Image */}
            <div className="relative">
              <div className="absolute -inset-5 bg-gradient-to-tr from-[#FCA68A]/15 via-transparent to-amber-100/15 rounded-3xl blur-2xl -z-10" />
              <img
                src={saveTimeImg}
                alt="Record once, interview thousands of candidates"
                className="w-full rounded-2xl shadow-2xl shadow-slate-900/10 border border-slate-200/80 object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ===== AUTOMATE YOUR PROCESS ===== */}
      <section className="py-24 bg-white border-t border-slate-100">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Image */}
            <div className="relative order-2 lg:order-1">
              <div className="absolute -inset-5 bg-gradient-to-tl from-[#FCA68A]/15 via-transparent to-emerald-100/15 rounded-3xl blur-2xl -z-10" />
              <img
                src={automateImg}
                alt="Automate your hiring process — no more scheduling"
                className="w-full rounded-2xl shadow-2xl shadow-slate-900/10 border border-slate-200/80 object-cover"
              />
            </div>
            {/* Right: Text */}
            <div className="order-1 lg:order-2">
              <span className="text-xs font-extrabold text-[#F04E23] uppercase tracking-[0.18em]">Automate Your Process</span>
              <h2 className="mt-4 text-[40px] md:text-[52px] lg:text-[60px] font-extrabold text-slate-900 leading-[1.04] tracking-tight">
                No more<br /> scheduling
              </h2>
              <p className="mt-6 text-[17px] text-slate-500 leading-relaxed max-w-lg">
                Eliminate the chaos of coordinating <span className="text-[#F04E23] font-semibold">interviews across time zones</span>. Candidates watch each question from the hiring manager and record their answers <span className="text-[#F04E23] font-semibold">at their own pace</span>, on any device, whenever they're ready.
              </p>
              <a href="/register" className="mt-9 inline-flex items-center gap-2 rounded-full bg-[#F04E23] px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#F04E23]/25 transition hover:bg-[#D43D14] hover:shadow-xl hover:-translate-y-0.5">
                Start for free <ArrowRight size={16} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section id="features" className="py-20 bg-slate-50/60">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl lg:text-[42px] font-bold text-slate-900 leading-tight mb-4">Everything you need to<br className="hidden md:block" /> hire smarter</h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">From screening to offer, our AI streamlines every step of your interview process.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => {
              const Icon = f.icon;
              const palettes = [
                { bg: "bg-[#FFF4F1]", icon: "text-[#F04E23]", hover: "group-hover:bg-[#F04E23]" },
                { bg: "bg-violet-50", icon: "text-violet-600", hover: "group-hover:bg-violet-600" },
                { bg: "bg-emerald-50", icon: "text-emerald-600", hover: "group-hover:bg-emerald-600" },
                { bg: "bg-rose-50", icon: "text-rose-500", hover: "group-hover:bg-rose-500" },
                { bg: "bg-amber-50", icon: "text-amber-600", hover: "group-hover:bg-amber-600" },
                { bg: "bg-sky-50", icon: "text-sky-600", hover: "group-hover:bg-sky-600" },
              ];
              const p = palettes[i];
              return (
                <div key={i} className="group p-6 rounded-2xl border border-slate-200 bg-white hover:border-[#FCA68A] hover:shadow-lg hover:shadow-[#F04E23]/5 transition-all duration-300">
                  <div className={`w-11 h-11 ${p.bg} rounded-xl flex items-center justify-center mb-4 ${p.hover} transition-colors`}>
                    <Icon size={22} className={`${p.icon} group-hover:text-white transition-colors`} />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-1.5">{f.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-xs font-bold text-[#F04E23] uppercase tracking-widest">How it works</span>
            <h2 className="mt-3 text-3xl md:text-4xl lg:text-[42px] font-bold text-slate-900 leading-tight">Set up in minutes, hire in days</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-10 relative">
            {howSteps.map((step, i) => (
              <div key={i} className="relative">
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-5xl font-extrabold text-slate-100">{step.num}</span>
                  {i < 2 && <div className="hidden md:block h-px flex-1 bg-slate-200 mt-2" />}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-slate-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ===== ANALYTICS / HIGHLIGHTS ===== */}
      <section className="py-16 bg-[#F04E23]">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {analytics.map((a, i) => {
              const Icon = a.icon;
              return (
                <div key={i} className="text-center">
                  <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center mx-auto mb-3"><Icon size={20} className="text-white" /></div>
                  <p className="text-3xl font-extrabold text-white mb-1">{a.value}</p>
                  <p className="text-sm text-orange-100">{a.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== BENEFITS ===== */}
      <section className="py-20 bg-slate-50/60">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            <div>
              <span className="text-xs font-bold text-[#F04E23] uppercase tracking-widest">Why teams love us</span>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold text-slate-900 leading-tight mb-6">Built for modern<br className="hidden md:block" /> hiring teams</h2>
              <p className="text-slate-500 leading-relaxed mb-8">We've designed every feature with recruiters, hiring managers, and candidates in mind. The result is a platform that everyone actually enjoys using.</p>
              <div className="space-y-5">
                {benefits.map((b, i) => {
                  const Icon = b.icon;
                  return (
                    <div key={i} className="flex gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl border border-slate-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <Icon size={18} className="text-[#F04E23]" />
                      </div>
                      <div>
                        <h4 className="text-base font-semibold text-slate-900 mb-0.5">{b.title}</h4>
                        <p className="text-sm text-slate-500 leading-relaxed">{b.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Integrations Screenshot */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-br from-[#FCA68A]/15 via-transparent to-emerald-100/20 rounded-3xl blur-2xl -z-10" />
              <img
                src={integrationsImg}
                alt="IntelliHire integrations — BambooHR, Slack, Zapier and more"
                className="w-full rounded-2xl shadow-2xl shadow-slate-900/10 border border-slate-200/80 object-cover"
              />
              {/* Floating integration count */}
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-lg border border-slate-200 px-5 py-2.5 flex items-center gap-3 whitespace-nowrap">
                <div className="flex -space-x-1.5">
                  {[{ bg: "#89C540", l: "B" }, { bg: "#E01E5A", l: "S" }, { bg: "#FF4A00", l: "Z" }, { bg: "#24A47F", l: "G" }].map((ic, i) => (
                    <div key={i} className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-white text-[9px] font-bold" style={{ background: ic.bg }}>{ic.l}</div>
                  ))}
                </div>
                <span className="text-xs font-semibold text-slate-700">50+ integrations available</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section id="testimonials" className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl lg:text-[42px] font-bold text-slate-900 leading-tight mb-4">Loved by hiring teams<br className="hidden md:block" /> everywhere</h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">See what industry leaders are saying about their experience with IntelliHire.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-slate-200 hover:shadow-lg hover:shadow-slate-900/5 hover:border-orange-100 transition-all duration-300">
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, j) => <Star key={j} size={14} className="text-amber-400 fill-amber-400" />)}
                </div>
                <p className="text-[15px] text-slate-600 leading-relaxed mb-6">"{t.quote}"</p>
                <div className="flex items-center gap-3 pt-5 border-t border-slate-100">
                  <img src={t.avatar} alt={t.author} className="w-10 h-10 rounded-full object-cover border-2 border-slate-100 shadow-sm flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{t.author}</p>
                    <p className="text-xs text-slate-500">{t.role} · {t.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA / PRICING ===== */}
      <section className="py-20 bg-[#F04E23] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-white/5 rounded-full blur-3xl" />
        <div className="mx-auto max-w-4xl px-6 lg:px-8 text-center relative">
          <h2 className="text-3xl md:text-4xl lg:text-[42px] font-bold text-white leading-tight mb-4">Ready to transform your hiring?</h2>
          <p className="text-lg text-orange-100 max-w-2xl mx-auto mb-8">Join thousands of companies already using IntelliHire to hire faster, fairer, and smarter. No credit card required.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="/register" className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-semibold text-[#F04E23] shadow-xl transition hover:bg-slate-50 hover:shadow-2xl hover:-translate-y-0.5">Get started free <ArrowRight size={18} /></a>
            <a href="#demo" className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/30 px-8 py-3.5 text-base font-semibold text-white transition hover:border-white hover:bg-white/10"><Play size={18} className="fill-current" /> Watch demo</a>
          </div>
          <p className="mt-6 text-sm text-[#FCA68A]">No credit card required · 14-day free trial · Cancel anytime</p>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="py-20 bg-slate-50/60">
        <div className="mx-auto max-w-3xl px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight mb-3">Frequently Asked Questions</h2>
            <p className="text-slate-500">Everything you need to know about IntelliHire.</p>
          </div>
          <div className="space-y-3">
            {faqData.map((faq, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? -1 : i)} className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 transition-colors">
                  <span className="text-[15px] font-semibold text-slate-900 pr-4">{faq.q}</span>
                  {openFaq === i ? <ChevronUp size={18} className="text-slate-400 flex-shrink-0" /> : <ChevronDown size={18} className="text-slate-400 flex-shrink-0" />}
                </button>
                {openFaq === i && <div className="px-5 pb-5"><p className="text-[15px] text-slate-500 leading-relaxed">{faq.a}</p></div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-white border-t border-slate-100">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-5 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <IntelliHireLogo className="w-8 h-8" />
                <span className="text-lg font-bold text-slate-900">IntelliHire</span>
              </div>
              <p className="text-sm text-slate-500 mb-5 max-w-xs leading-relaxed">The modern way to screen and interview candidates. AI-powered, async, and loved by hiring teams worldwide.</p>
              <div className="flex gap-2.5">
                {[
                  { icon: Mail, label: "Email" },
                  { icon: ExternalLink, label: "Website" },
                  { icon: Phone, label: "Phone" },
                ].map((s) => (
                  <a key={s.label} href="#" className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-[#F04E23] hover:text-white transition-all" title={s.label}>
                    <s.icon size={16} />
                  </a>
                ))}
              </div>
            </div>
            {Object.entries(footerLinks).map(([title, links]) => (
              <div key={title}>
                <h4 className="text-sm font-semibold text-slate-900 mb-4">{title}</h4>
                <ul className="space-y-2.5">
                  {links.map((item) => (
                    <li key={item}><a href="#" className="text-sm text-slate-500 hover:text-[#F04E23] transition-colors">{item}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-slate-400">© 2026 IntelliHire. All rights reserved.</p>
            <div className="flex gap-6">
              {["Privacy Policy", "Terms of Service", "Cookie Policy"].map((item) => (
                <a key={item} href="#" className="text-xs text-slate-400 hover:text-slate-700 transition-colors">{item}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}

export default LandingPage;
