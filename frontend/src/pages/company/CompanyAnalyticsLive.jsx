import { Link } from "react-router-dom";
import { BarChart3, Briefcase, ChevronRight, Loader2, TrendingUp, Users, WifiOff } from "lucide-react";
import { Card, CardHeader, EmptyState, PageHeader, ProgressBar, StatTile } from "@/components/app/primitives";
import Reveal from "@/components/shared/Reveal";
import CompanyBlocked from "@/components/company/CompanyBlocked";
import { companyApi, isBlocked } from "@/api/companyApi";
import { jobsApi } from "@/api/jobsApi";
import { useRemote } from "@/hooks/useRemote";
import { APPLICATION_STATUSES } from "@/lib/applicationMap";
import { ROUTES } from "@/config/routes";

const BAR = { submitted: "bg-stone-400", under_review: "bg-brand", shortlisted: "bg-brand", interview: "bg-brand", selected: "bg-emerald-500", on_hold: "bg-amber-400", rejected: "bg-red-400" };

const PIPELINE_KEY = { submitted: "submitted", under_review: "underReview", shortlisted: "shortlisted", interview: "interview", selected: "selected", on_hold: "onHold", rejected: "rejected" };

async function load({ signal }) {
  const [dashboard, roles] = await Promise.all([companyApi.dashboard({ signal }), jobsApi.list({ status: "all", ordering: "-applications_count", pageSize: 10 }, { signal })]);
  return { dashboard, roles: roles.results.filter((r) => r.applicationsCount > 0) };
}

/**
 * Analytics from what the backend really counts: volume, the pipeline by status and applications per role.
 * Trends over time, sources and match scores have no data behind them yet, so nothing is drawn for them.
 */
export default function CompanyAnalyticsLive() {
  const { status, data, error, reload } = useRemote((o) => load(o), []);
  if (isBlocked(error)) return <CompanyBlocked onRetry={reload} />;
  if (status === "error" && !data) {
    return (
      <Card className="p-6">
        <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
          <WifiOff size={26} className="text-stone-400" />
          <p className="max-w-sm text-[14.5px] text-stone-600">{error.message}</p>
          <button type="button" onClick={reload} className="btn-secondary">Try again</button>
        </div>
      </Card>
    );
  }
  if (!data) return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-brand" size={26} aria-label="Loading analytics" /></div>;

  const { jobs, applicants, pipeline } = data.dashboard;
  if (applicants.total === 0) {
    return (
      <div>
        <PageHeader eyebrow="Analytics" title={<>Hiring <em>analytics</em></>} subtitle="Applicant volume and pipeline." />
        <EmptyState icon={BarChart3} title="Nothing to analyse yet" message="Once candidates apply to your roles you will see applicant volume, the pipeline and applications per role here." action={<Link to={ROUTES.COMPANY.JOBS} className="btn-primary">Go to roles</Link>} />
      </div>
    );
  }
  const beyond = pipeline.shortlisted + pipeline.interview + pipeline.selected;
  const top = Math.max(1, ...data.roles.map((r) => r.applicationsCount));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Analytics" title={<>Hiring <em>analytics</em></>} subtitle={`${applicants.total} ${applicants.total === 1 ? "application" : "applications"} across ${jobs.open + jobs.draft + jobs.closed} roles`} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={Briefcase} label="Open roles" value={jobs.open} hint={`${jobs.draft} draft · ${jobs.closed} closed`} />
        <StatTile icon={Users} label="Applicants" value={applicants.total} hint={`${applicants.newLast7Days} in the last 7 days`} delay={60} />
        <StatTile icon={TrendingUp} label="Shortlisted or beyond" value={beyond} hint="shortlisted, interview or selected" delay={120} />
        <StatTile icon={BarChart3} label="Not proceeding" value={pipeline.rejected} hint={`${pipeline.onHold} on hold`} delay={180} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Reveal className="min-w-0 lg:col-span-7">
          <Card className="h-full p-6">
            <CardHeader icon={TrendingUp} title="Pipeline" subtitle="Where every application sits" />
            <ul className="mt-6 space-y-4">
              {APPLICATION_STATUSES.map((s) => {
                const n = pipeline[PIPELINE_KEY[s.value]];
                const pct = (n / applicants.total) * 100;
                return (
                  <li key={s.value}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="font-medium text-stone-600">{s.label} <span className="text-stone-400">· {s.hint}</span></span>
                      <span className="shrink-0 font-semibold tabular-nums text-ink">{n} <span className="font-normal text-stone-400">({Math.round(pct)}%)</span></span>
                    </div>
                    <ProgressBar value={pct} tone={BAR[s.value]} />
                  </li>
                );
              })}
            </ul>
          </Card>
        </Reveal>

        <Reveal delay={80} className="min-w-0 lg:col-span-5">
          <Card className="h-full p-6">
            <CardHeader icon={Briefcase} title="Applications per role" subtitle="The roles with the most applications" />
            <ul className="mt-5 space-y-2">
              {data.roles.map((r) => (
                <li key={r.id}>
                  <Link to={`/company/jobs/${r.id}/candidates`} className="group block rounded-xl border border-[var(--line)] p-3 transition-colors hover:bg-stone-50">
                    <div className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">{r.title}</span>
                      <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-[12px] font-semibold tabular-nums text-stone-600">{r.applicationsCount}</span>
                      <ChevronRight size={16} className="shrink-0 text-stone-300 transition-transform group-hover:translate-x-0.5" />
                    </div>
                    <ProgressBar className="mt-2" value={(r.applicationsCount / top) * 100} tone="bg-brand" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>
      </div>

      <p className="text-center text-[12.5px] text-stone-500">Trends over time, sources and match scores will appear here when they are available.</p>
    </div>
  );
}
