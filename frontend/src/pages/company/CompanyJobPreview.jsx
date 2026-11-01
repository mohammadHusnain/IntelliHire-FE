import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, Banknote, Briefcase, Check, Clock, Copy, Eye, MapPin, Pencil, SearchX, Share2, Users,
} from "lucide-react";
import { Badge, Card, EmptyState, PageHeader } from "@/components/app/primitives";
import Reveal from "@/components/shared/Reveal";
import { useCompanyActions, useCompanyRecord } from "@/store/companyStore";
import { formatDate } from "@/lib/candidateStats";
import { toast } from "@/store/toastStore";
import { ROUTES } from "@/config/routes";

const lines = (text) => (text || "").split("\n").map((l) => l.replace(/^[•\-*]\s*/, "").trim()).filter(Boolean);

export default function CompanyJobPreview() {
  const { id } = useParams();
  const record = useCompanyRecord();
  const { setJobStatus } = useCompanyActions();
  const [copied, setCopied] = useState(false);

  const job = record.jobs.find((j) => j.id === id);
  if (!job) {
    return (
      <EmptyState
        icon={SearchX}
        title="Role not found"
        message="This role may have been deleted."
        action={<Link to={ROUTES.COMPANY.JOBS} className="btn-primary">Back to roles</Link>}
      />
    );
  }

  const count = record.applicants.filter((a) => a.jobId === job.id).length;
  const link = `${window.location.origin}/apply/${job.id}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast({ title: "Link copied", message: "Paste it anywhere candidates will see it." });
    } catch {
      toast({ type: "error", title: "Could not copy", message: "Select the link and copy it manually." });
    }
  };

  const salary = job.salaryMin && job.salaryMax ? `£${Number(job.salaryMin).toLocaleString()} – £${Number(job.salaryMax).toLocaleString()}` : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Role preview"
        title={<>How candidates <em>see it</em></>}
        subtitle="This is the page your application link opens."
        actions={
          <>
            <Link to={ROUTES.COMPANY.JOBS} className="btn-secondary">
              <ArrowLeft size={16} /> Roles
            </Link>
            <Link to={`/company/jobs/${job.id}/edit`} className="btn-secondary">
              <Pencil size={16} /> Edit
            </Link>
            {job.status === "Open" ? (
              <Link to={`/company/jobs/${job.id}/candidates`} className="btn-primary">
                <Users size={16} /> {count} applicants
              </Link>
            ) : (
              <button type="button" onClick={() => { setJobStatus(job.id, "Open"); toast({ title: "Role published", message: `${job.title} is now collecting applications.` }); }} className="btn-primary">
                Publish role
              </button>
            )}
          </>
        }
      />

      <Reveal>
        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-[var(--line)] bg-stone-50 px-3 py-2.5">
            <Share2 size={15} className="shrink-0 text-brand" />
            <span className="truncate text-[13px] text-stone-600">{link}</span>
          </div>
          <button type="button" onClick={copy} className="btn-dark shrink-0">
            {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy link"}
          </button>
        </Card>
      </Reveal>

      <Reveal delay={60}>
        <Card className="overflow-hidden">
          <div className="relative bg-ink px-6 py-8 text-white sm:px-10 sm:py-10">
            <div aria-hidden className="bg-dot-grid-light pointer-events-none absolute inset-0 opacity-50" />
            <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand/25 blur-3xl" />
            <div className="relative">
              <p className="text-[13px] font-semibold text-brand-muted">{record.profile.companyName}</p>
              <h1 className="display mt-2 max-w-2xl text-[32px] !text-white sm:text-[40px]">{job.title}</h1>
              <div className="mt-5 flex flex-wrap gap-2 text-[12.5px]">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><MapPin size={13} /> {job.location}</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><Briefcase size={13} /> {job.workplaceType} · {job.jobType}</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><Clock size={13} /> {job.experienceLevel}</span>
                {salary && <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><Banknote size={13} /> {salary}</span>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="min-w-0 space-y-7">
              <section>
                <h2 className="display text-[22px]">About the role</h2>
                <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-stone-600">{job.description}</p>
              </section>
              {lines(job.responsibilities).length > 0 && (
                <section>
                  <h2 className="display text-[22px]">What you&apos;ll do</h2>
                  <ul className="mt-3 space-y-2">
                    {lines(job.responsibilities).map((l, i) => (
                      <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-stone-600">
                        <Check size={16} className="mt-1 shrink-0 text-brand" /> {l}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {lines(job.requirements).length > 0 && (
                <section>
                  <h2 className="display text-[22px]">What we&apos;re looking for</h2>
                  <ul className="mt-3 space-y-2">
                    {lines(job.requirements).map((l, i) => (
                      <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-stone-600">
                        <Check size={16} className="mt-1 shrink-0 text-brand" /> {l}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/60 p-5 text-center">
                <p className="text-[14px] font-semibold text-ink">Apply with your CV</p>
                <p className="mt-1 text-[13px] text-stone-500">Candidates upload a CV here, then complete an AI screening interview.</p>
                <span className="btn-primary mt-4 cursor-default opacity-70">Apply for this role</span>
                <p className="mt-2 text-[11.5px] text-stone-400">Disabled in preview</p>
              </div>
            </div>

            <aside className="min-w-0 space-y-5">
              <div className="rounded-2xl border border-[var(--line)] p-5">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-stone-400">Skills</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(job.skills || []).map((s) => (
                    <span key={s} className="rounded-full bg-brand-soft px-3 py-1 text-[12.5px] font-medium text-brand">{s}</span>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--line)] p-5">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-stone-400">Details</p>
                <dl className="mt-3 space-y-2.5 text-[13px]">
                  {[["Department", job.department], ["Openings", job.openings], ["Posted", formatDate(job.createdAt)], ["Status", <Badge key="s" tone={job.status === "Open" ? "success" : job.status === "Draft" ? "neutral" : "danger"}>{job.status}</Badge>]].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3">
                      <dt className="text-stone-500">{k}</dt>
                      <dd className="truncate font-medium text-ink">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="rounded-2xl bg-stone-50 p-5">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-ink"><Eye size={15} className="text-brand" /> Hiring process</p>
                <ol className="mt-3 space-y-2">
                  {(job.hiringStages || []).map((s, i) => (
                    <li key={s} className="flex gap-2.5 text-[13px] text-stone-600">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-stone-500">{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
            </aside>
          </div>
        </Card>
      </Reveal>
    </div>
  );
}
