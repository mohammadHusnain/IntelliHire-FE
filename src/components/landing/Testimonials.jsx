
import { Star } from "lucide-react";
import SectionHeading from "./SectionHeading";

const avatar = (seed, bg) =>
  `https://api.dicebear.com/9.x/notionists/svg?seed=${seed}&backgroundColor=${bg}`;

const STORIES = [
  { quote: "We screened four hundred applicants in under a week. The CV ranking alone gave us back thirty hours.", name: "Marcus Lee", role: "Head of Recruitment", org: "Scalr Labs", avatar: avatar("MarcusLee", "dde8f8") },
  { quote: "I practised the frontend interview six times. By the real one, nothing surprised me and I got the offer.", name: "Ayesha Raza", role: "Frontend Developer", org: "Candidate", avatar: avatar("AyeshaRaza", "fde8e4") },
  { quote: "The reports explain the score. Our hiring managers finally trust what the shortlist is telling them.", name: "Sophie Andersen", role: "Talent Acquisition Lead", org: "Meridian Group", avatar: avatar("SophieAndersen", "d4f0e8") },
  { quote: "Feedback on confidence and structure was specific enough to act on. That is what I never got from rejections.", name: "Bilal Ahmed", role: "Data Analyst", org: "Candidate", avatar: avatar("BilalAhmed", "fef3e2") },
  { quote: "Our university community became a real pipeline. We now hire interns straight from it every semester.", name: "Raj Patel", role: "VP of People Operations", org: "Nexus Software", avatar: avatar("RajPatel", "e8e4f8") },
  { quote: "Candidates rate the process highly. Interviewing on their own schedule sets us apart as an employer.", name: "Chloe Martin", role: "Senior Recruiter", org: "BrightPath HR", avatar: avatar("ChloeMartin", "fef3e2") },
  { quote: "The technical round asked about projects on my own CV. It felt like a real interviewer had read it.", name: "Hamza Siddiqui", role: "Backend Engineer", org: "Candidate", avatar: avatar("HamzaSiddiqui", "dde8f8") },
  { quote: "We moved our whole first-round process over in a weekend and have not scheduled a screening call since.", name: "Amara Diallo", role: "HR Director", org: "TechForward", avatar: avatar("AmaraDiallo", "d4f0e8") },
];

const ROWS = [STORIES.slice(0, 4), STORIES.slice(4)];

function Card({ s, hidden }) {
  return (
    <figure
      aria-hidden={hidden}
      className="surface surface-hover flex w-[300px] shrink-0 flex-col p-6 sm:w-[380px]"
    >
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} size={14} className="fill-amber-400 text-amber-400" />
        ))}
      </div>
      <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-stone-700">&ldquo;{s.quote}&rdquo;</blockquote>
      <figcaption className="mt-6 flex items-center gap-3 border-t border-[var(--line)] pt-5">
        <img src={s.avatar} alt="" width={40} height={40} loading="lazy" className="h-10 w-10 rounded-full border border-[var(--line)] bg-white" />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-ink">{s.name}</p>
          <p className="truncate text-[12px] text-stone-500">
            {s.role} · {s.org}
          </p>
        </div>
      </figcaption>
    </figure>
  );
}

export default function Testimonials() {
  return (
    <section id="stories" className="scroll-mt-24 overflow-hidden py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <SectionHeading
          eyebrow="Stories"
          title={<>Loved on <em>both sides</em> of the table</>}
          subtitle="Recruiters get their time back. Candidates walk in prepared."
        />
      </div>
      <div className="mask-fade-x mt-14 space-y-4">
        {ROWS.map((row, r) => (
          <div key={r} className="marquee">
            <div className="marquee-track gap-4 py-2 pr-4" data-reverse={r === 1} style={{ "--marquee-duration": "60s" }}>
              {[...row, ...row].map((s, i) => (
                <Card key={`${s.name}-${i}`} s={s} hidden={i >= row.length} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
