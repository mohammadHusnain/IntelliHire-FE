import { Link } from "react-router-dom";
import { Briefcase, Clock, Loader2, Plus, Sparkles, TrendingUp, UsersRound, Users, WifiOff } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, PageHeader, ProgressBar, StatTile } from "@/components/app/primitives";
import Reveal from "@/components/shared/Reveal";
import CompanyBlocked from "@/components/company/CompanyBlocked";
import { companyApi, isBlocked } from "@/api/companyApi";
import { useRemote } from "@/hooks/useRemote";
import { formatDate, relativeTime } from "@/lib/candidateStats";
import { useAuthStore } from "@/store/authStore";
import { ROUTES } from "@/config/routes";

// The backend's application statuses, in pipeline order.
const STAGES = [
  { key: "submitted", label: "Applied", hint: "New applications", tone: "bg-stone-400" },
  { key: "underReview", label: "Under review", hint: "Being looked at", tone: "bg-brand" },
  { key: "shortlisted", label: "Shortlisted", hint: "Worth interviewing", tone: "bg-brand" },
  { key: "interview", label: "Interview", hint: "Interview stage", tone: "bg-brand" },
  { key: "selected", label: "Selected", hint: "Chosen for the role", tone: "bg-emerald-500" },
  { key: "onHold", label: "On hold", hint: "Paused", tone: "bg-amber-400" },
];
const STATUS_LABEL = { submitted: "Applied", under_review: "Under review", shortlisted: "Shortlisted", interview: "Interview", selected: "Selected", rejected: "Rejected", on_hold: "On hold" };
const STATUS_TONE = { submitted: "neutral", under_review: "warning", shortlisted: "brand", interview: "warning", selected: "success", rejected: "danger", on_hold: "neutral" };

/**
 * Real-backend company dashboard: every block comes from GET /company/dashboard/. Nothing is invented; a block
 * the data does not fill shows an empty state. Rows are not links because the role and candidate pages are
 * not connected to the backend yet (Modules 3 and 4).
 */
export default function CompanyDashboardLive() {
  const user = useAuthStore((s) => s.user);
  const { status, data: d, error, reload } = useRemote((o) => companyApi.dashboard(o), []);

  if (isBlocked(error)) return <CompanyBlocked onRetry={reload} />;
  if (status === "error" && !d) {
    return (
      <Card className="p-6">
        <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
          <WifiOff size={26} className="text-stone-400" />
          <p className="max-w-sm text-[14.5px] text-stone-600">{error?.message || "Couldn't load the dashboard."}</p>
          <button type="button" onClick={reload} className="btn-secondary">Try again</button>
        </div>
      </Card>
    );
  }
  if (!d) {
    return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-brand" size={26} aria-label="Loading dashboard" /></div>;
  }

  const { jobs, applicants, pipeline, closingSoon, recent, team, company } = d;
  const empty = jobs.open + jobs.draft + jobs.closed === 0 && applicants.total === 0;
  const first = (user?.name || "").split(" ")[0];
  const inPlay = applicants.total - pipeline.rejected;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={company.name}
        title={pipeline.submitted ? <>{pipeline.submitted} new {pipeline.submitted === 1 ? "applicant" : "applicants"} to <em>review</em></> : empty ? <>Welcome{first ? `, ${first}` : ""}</> : <>Your hiring at <em>a glance</em></>}
        subtitle={empty ? "Post your first role to start receiving applicants." : `${jobs.open} open ${jobs.open === 1 ? "role" : "roles"} · ${inPlay} candidates in play`}
        actions={<Link to={ROUTES.COMPANY.JOB_CREATE} className="btn-primary"><Plus size={16} /> Post a role</Link>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={Briefcase} label="Open roles" value={jobs.open} hint={`${jobs.draft} draft${jobs.draft === 1 ? "" : "s"} · ${jobs.closed} closed`} />
        <StatTile icon={Users} label="Applicants" value={applicants.total} hint={`${applicants.newLast7Days} in the last 7 days`} delay={60} />
        <StatTile icon={Sparkles} label="Shortlisted" value={pipeline.shortlisted + pipeline.interview + pipeline.selected} hint="shortlist, interview or selected" delay={120} />
        <StatTile icon={UsersRound} label="Team" value={team.activeMembers} hint={`${team.pendingInvitations} pending invitation${team.pendingInvitations === 1 ? "" : "s"}`} delay={180} />
      </div>

      {company.completion < 100 && (
        <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-ink">Your company profile is {company.completion}% complete</p>
            <p className="text-[13px] text-stone-500">A complete profile (website, description, headquarters, logo, size) builds candidates&apos; trust.</p>
          </div>
          <Link to={ROUTES.COMPANY.SETTINGS} className="btn-secondary shrink-0">Complete profile</Link>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Reveal className="min-w-0 lg:col-span-7">
          <Card className="h-full p-6">
            <CardHeader icon={TrendingUp} title="Hiring pipeline" subtitle="Where every candidate sits" />
            {applicants.total === 0 ? (
              <EmptyState className="mt-5" icon={Users} title="No applicants yet" message="Candidates appear here as they apply to your roles." />
            ) : (
              <>
                <ul className="mt-6 space-y-4">
                  {STAGES.map((s) => {
                    const n = pipeline[s.key];
                    return (
                      <li key={s.key}>
                        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
                          <span className="font-medium text-stone-600">{s.label} <span className="text-stone-400">· {s.hint}</span></span>
                          <span className="shrink-0 font-semibold tabular-nums text-ink">{n}</span>
                        </div>
                        <ProgressBar value={(n / applicants.total) * 100} tone={s.tone} />
                      </li>
                    );
                  })}
                </ul>
                {pipeline.rejected > 0 && <p className="mt-5 border-t border-[var(--line)] pt-4 text-[13px] text-stone-500">{pipeline.rejected} candidate{pipeline.rejected === 1 ? "" : "s"} not proceeding.</p>}
              </>
            )}
          </Card>
        </Reveal>

        <Reveal delay={100} className="min-w-0 lg:col-span-5">
          <Card className="flex h-full flex-col p-6">
            <CardHeader icon={Clock} title="Closing soon" subtitle="Open roles whose deadline is within 7 days" />
            {closingSoon.length ? (
              <ul className="mt-5 space-y-2">
                {closingSoon.map((j) => (
                  <li key={j.id} className="flex items-center gap-3 rounded-xl border border-[var(--line)] p-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-ink">{j.title}</span>
                      <span className="block text-[12.5px] text-stone-500">Closes {formatDate(j.deadline)}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-[12px] font-semibold tabular-nums text-stone-600">{j.applicationCount}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState className="mt-5" icon={Briefcase} title="Nothing closing soon" message="Roles with a deadline in the next 7 days show up here." />
            )}
          </Card>
        </Reveal>
      </div>

      <Reveal>
        <Card className="p-6">
          <CardHeader
            icon={Users}
            title="Latest applications"
            subtitle="The five most recent"
          />
          {recent.length ? (
            <ul className="mt-5 divide-y divide-[var(--line)]">
              {recent.map((a, i) => (
                <li key={`${a.candidateName}-${a.submittedAt}-${i}`} className="flex items-center gap-4 py-3.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-ink">{a.candidateName}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-stone-500">
                      <span className="truncate">{a.jobTitle}</span>
                      <span className="text-stone-300">•</span>
                      <span className="inline-flex items-center gap-1"><Clock size={11} /> {relativeTime(a.submittedAt)}</span>
                    </span>
                  </span>
                  <Badge tone={STATUS_TONE[a.status] || "neutral"}>{STATUS_LABEL[a.status] || a.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState className="mt-5" icon={Users} title="No applications yet" message="Share your role's application link and candidates will appear here." />
          )}
        </Card>
      </Reveal>
    </div>
  );
}
