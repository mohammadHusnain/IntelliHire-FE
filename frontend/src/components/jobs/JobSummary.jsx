import { Banknote, Briefcase, Building2, Clock, MapPin } from "lucide-react";
import { Badge } from "@/components/app/primitives";
import { employmentLabel, formatDeadline, formatSalary, workModeLabel } from "@/lib/jobMap";

const lines = (text) => (text || "").split("\n").map((l) => l.replace(/^[•\-*]\s*/, "").trim()).filter(Boolean);

/** The job as candidates read it: shared by the company's form preview and the public application page. */
export default function JobSummary({ job }) {
  const salary = formatSalary(job.salary);
  const responsibilities = lines(job.responsibilities);
  return (
    <div>
      <div className="flex items-start gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--line)] bg-stone-50 text-stone-400">
          {job.company?.logo ? <img src={job.company.logo} alt="" className="h-full w-full object-cover" /> : <Building2 size={24} />}
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-brand-muted">{job.company?.name}</p>
          <h1 className="display mt-1 text-[28px] leading-tight sm:text-[34px]">{job.title}</h1>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13.5px] text-stone-600">
        {job.department && <span className="inline-flex items-center gap-1.5"><Briefcase size={14} /> {job.department}</span>}
        {(job.location || job.work_mode) && (
          <span className="inline-flex items-center gap-1.5"><MapPin size={14} /> {[job.location, workModeLabel(job.work_mode)].filter(Boolean).join(" · ")}</span>
        )}
        {job.employment_type && <Badge tone="neutral">{employmentLabel(job.employment_type)}</Badge>}
        {salary && <span className="inline-flex items-center gap-1.5"><Banknote size={14} /> {salary}</span>}
        {job.deadline && <span className="inline-flex items-center gap-1.5"><Clock size={14} /> Apply by {formatDeadline(job.deadline)}</span>}
      </div>

      {job.description && (
        <section className="mt-7">
          <h2 className="font-sans text-[15px] font-semibold text-ink">About the role</h2>
          <p className="mt-2 whitespace-pre-line text-[14.5px] leading-relaxed text-stone-600">{job.description}</p>
        </section>
      )}
      {responsibilities.length > 0 && (
        <section className="mt-6">
          <h2 className="font-sans text-[15px] font-semibold text-ink">Responsibilities</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[14.5px] leading-relaxed text-stone-600">
            {responsibilities.map((l) => <li key={l}>{l}</li>)}
          </ul>
        </section>
      )}
      {job.required_skills?.length > 0 && (
        <section className="mt-6">
          <h2 className="font-sans text-[15px] font-semibold text-ink">Skills we need</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {job.required_skills.map((s) => <span key={s} className="rounded-full bg-ink px-3 py-1 text-[12.5px] font-medium text-white">{s}</span>)}
          </div>
        </section>
      )}
      {job.soft_skills?.length > 0 && (
        <section className="mt-5">
          <h2 className="font-sans text-[15px] font-semibold text-ink">Also valued</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {job.soft_skills.map((s) => <span key={s} className="rounded-full bg-stone-100 px-3 py-1 text-[12.5px] font-medium text-stone-700">{s}</span>)}
          </div>
        </section>
      )}
    </div>
  );
}
