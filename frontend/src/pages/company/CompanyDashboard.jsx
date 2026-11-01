import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Briefcase, CheckCircle2, ChevronRight, Clock, Plus, Share2, Sparkles, TrendingUp, Users,
} from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, PageHeader, ProgressBar, StatTile } from "@/components/app/primitives";
import Reveal from "@/components/shared/Reveal";
import { Avatar } from "@/components/app/HeaderMenus";
import { PIPELINE, PIPELINE_META, companyStats, useCompanyRecord } from "@/store/companyStore";
import { formatDate, relativeTime, scoreTone } from "@/lib/candidateStats";
import { ROUTES } from "@/config/routes";

function Onboarding({ name }) {
  const steps = [
    { icon: Briefcase, title: "Post your first role", text: "Describe the job and the skills you need. It takes a few minutes.", to: ROUTES.COMPANY.JOB_CREATE, cta: "Create a role" },
    { icon: Share2, title: "Share the application link", text: "Post it on LinkedIn, in communities or on your careers page.", to: ROUTES.COMPANY.JOBS, cta: "See roles" },
    { icon: Users, title: "Review applicants", text: "Scores and notes land here as candidates apply and interview.", to: ROUTES.COMPANY.CANDIDATES, cta: "Open candidates" },
  ];
  return (
    <>
      <Reveal>
        <Card className="relative overflow-hidden p-6 sm:p-8">
          <div aria-hidden className="bg-dot-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_top_right,#000_10%,transparent_60%)]" />
          <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-brand/10 blur-3xl" />
          <div className="relative max-w-xl">
            <p className="text-[14px] font-medium text-stone-500">Welcome, {name}</p>
            <h1 className="display mt-2 text-[30px] sm:text-[38px]">Let&apos;s post your <em>first role</em>.</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-stone-500">
              Define what you need, share one link, and let IntelliHire handle CV analysis and first-round interviews before you review the shortlist.
            </p>
            <Link to={ROUTES.COMPANY.JOB_CREATE} className="btn-primary btn-lg mt-6">
              <Plus size={17} /> Post a role
            </Link>
          </div>
        </Card>
      </Reveal>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <Reveal key={s.title} delay={i * 90}>
              <Card interactive className="flex h-full flex-col p-6">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                    <Icon size={20} />
                  </span>
                  <span className="text-[12px] font-semibold text-stone-400">Step {i + 1}</span>
                </div>
                <h3 className="mt-5 font-sans text-[16px] font-semibold text-ink">{s.title}</h3>
                <p className="mt-1.5 flex-1 text-[14px] leading-relaxed text-stone-500">{s.text}</p>
                <Link to={s.to} className={`${i === 0 ? "btn-primary" : "btn-secondary"} mt-5`}>
                  {s.cta} <ArrowRight size={15} className="btn-arrow" />
                </Link>
              </Card>
            </Reveal>
          );
        })}
      </div>
    </>
  );
}

export default function CompanyDashboard() {
  const record = useCompanyRecord();
  const stats = useMemo(() => companyStats(record), [record]);
  const { profile, jobs, applicants } = record;

  const recent = useMemo(() => [...applicants].sort((a, b) => b.appliedAt - a.appliedAt).slice(0, 5), [applicants]);
  const topJobs = useMemo(
    () =>
      jobs
        .filter((j) => j.status === "Open")
        .map((j) => ({ ...j, count: applicants.filter((a) => a.jobId === j.id).length }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 4),
    [jobs, applicants],
  );

  if (!jobs.length) return <div className="space-y-6"><Onboarding name={profile.ownerName.split(" ")[0]} /></div>;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={profile.companyName}
        title={stats.needsReview ? <>{stats.needsReview} new {stats.needsReview === 1 ? "applicant" : "applicants"} to <em>review</em></> : <>Your hiring at <em>a glance</em></>}
        subtitle={`${stats.openJobs} open ${stats.openJobs === 1 ? "role" : "roles"} · ${stats.active} candidates in play`}
        actions={
          <>
            <Link to={ROUTES.COMPANY.CANDIDATES} className="btn-secondary">
              <Users size={16} /> Candidates
            </Link>
            <Link to={ROUTES.COMPANY.JOB_CREATE} className="btn-primary">
              <Plus size={16} /> Post a role
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={Briefcase} label="Open roles" value={stats.openJobs} hint={`${stats.drafts} draft${stats.drafts === 1 ? "" : "s"}`} />
        <StatTile icon={Users} label="Applicants" value={stats.applicants} hint={`${stats.needsReview} awaiting review`} delay={60} />
        <StatTile icon={Sparkles} label="Shortlisted" value={stats.shortlisted} hint="at interview or beyond" delay={120} />
        <StatTile icon={TrendingUp} label="Average CV match" value={stats.avgScore} suffix="/100" delay={180} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Reveal className="min-w-0 lg:col-span-7">
          <Card className="h-full p-6">
            <CardHeader
              icon={TrendingUp}
              title="Hiring pipeline"
              subtitle="Where every active candidate sits"
              action={
                <Link to={ROUTES.COMPANY.CANDIDATES} className="inline-flex items-center gap-1 text-[13px] font-semibold text-stone-500 hover:text-brand">
                  Open <ChevronRight size={15} />
                </Link>
              }
            />
            <ul className="mt-6 space-y-4">
              {PIPELINE.map((stage, i) => {
                const n = stats.byStage[stage];
                const pct = stats.active ? (n / stats.active) * 100 : 0;
                return (
                  <li key={stage} className="animate-fade-in-up" style={{ animationDelay: `${i * 60}ms` }}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="font-medium text-stone-600">
                        {stage} <span className="text-stone-400">· {PIPELINE_META[stage].hint}</span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-ink">{n}</span>
                    </div>
                    <ProgressBar value={pct} tone={stage === "Offer" ? "bg-emerald-500" : stage === "Applied" ? "bg-stone-400" : "bg-brand"} />
                  </li>
                );
              })}
            </ul>
            {stats.rejected > 0 && <p className="mt-5 border-t border-[var(--line)] pt-4 text-[13px] text-stone-500">{stats.rejected} candidates not proceeding.</p>}
          </Card>
        </Reveal>

        <Reveal delay={100} className="min-w-0 lg:col-span-5">
          <Card className="flex h-full flex-col p-6">
            <CardHeader
              icon={Briefcase}
              title="Roles by interest"
              subtitle="Open roles, most applicants first"
              action={
                <Link to={ROUTES.COMPANY.JOBS} className="inline-flex items-center gap-1 text-[13px] font-semibold text-stone-500 hover:text-brand">
                  All <ChevronRight size={15} />
                </Link>
              }
            />
            {topJobs.length ? (
              <ul className="mt-5 space-y-2">
                {topJobs.map((j) => (
                  <li key={j.id}>
                    <Link to={`/company/jobs/${j.id}/candidates`} className="group flex items-center gap-3 rounded-xl border border-[var(--line)] p-3 transition-colors hover:bg-stone-50">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold text-ink">{j.title}</span>
                        <span className="block truncate text-[12.5px] text-stone-500">{j.location} · {j.workplaceType}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-[12px] font-semibold tabular-nums text-stone-600">{j.count}</span>
                      <ChevronRight size={16} className="shrink-0 text-stone-300 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState className="mt-5" icon={Briefcase} title="No open roles" message="Publish a role to start receiving applicants." action={<Link to={ROUTES.COMPANY.JOB_CREATE} className="btn-primary">Post a role</Link>} />
            )}
          </Card>
        </Reveal>
      </div>

      <Reveal>
        <Card className="p-6">
          <CardHeader
            icon={Users}
            title="Latest applicants"
            subtitle={stats.needsReview ? `${stats.needsReview} still at the Applied stage` : "Everyone has been reviewed"}
            action={
              <Link to={ROUTES.COMPANY.CANDIDATES} className="inline-flex items-center gap-1 text-[13px] font-semibold text-stone-500 hover:text-brand">
                View all <ChevronRight size={15} />
              </Link>
            }
          />
          {recent.length ? (
            <ul className="mt-5 divide-y divide-[var(--line)]">
              {recent.map((a, i) => {
                const job = jobs.find((j) => j.id === a.jobId);
                const tone = scoreTone(a.cvScore);
                return (
                  <li key={a.id} className="animate-fade-in-up" style={{ animationDelay: `${i * 50}ms` }}>
                    <Link to={`/company/candidates/${a.id}`} className="group -mx-3 flex items-center gap-4 rounded-xl px-3 py-3.5 transition-colors hover:bg-stone-50">
                      <Avatar name={a.name} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px] font-semibold text-ink">{a.name}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-stone-500">
                          <span className="truncate">{job?.title || "Role removed"}</span>
                          <span className="text-stone-300">•</span>
                          <span className="inline-flex items-center gap-1"><Clock size={11} /> {relativeTime(a.appliedAt)}</span>
                        </span>
                      </span>
                      <span className={`hidden shrink-0 rounded-lg px-2.5 py-1 text-[13px] font-semibold tabular-nums xs:block ${tone.bg} ${tone.text}`}>{a.cvScore}</span>
                      <Badge tone={PIPELINE_META[a.stage]?.tone || "neutral"} className="hidden sm:inline-flex">{a.stage}</Badge>
                      <ChevronRight size={17} className="shrink-0 text-stone-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              className="mt-5"
              icon={Users}
              title="No applicants yet"
              message="Share your role's application link and candidates will appear here as they apply."
              action={<Link to={ROUTES.COMPANY.JOBS} className="btn-primary"><Share2 size={15} /> Get the link</Link>}
            />
          )}
        </Card>
      </Reveal>

      <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-[13px] text-stone-500">
        <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> {profile.companyName} since {formatDate(profile.createdAt, { month: "long", year: "numeric" })}</span>
      </div>
    </div>
  );
}
