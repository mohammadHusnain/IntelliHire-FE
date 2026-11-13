import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, BriefcaseBusiness, CalendarDays, Check, CheckCircle2, Clock3, ExternalLink,
  Loader2, RefreshCw, WifiOff,
} from "lucide-react";
import { trackingApi } from "@/api/trackingApi";
import { Badge, Card, EmptyState, PageHeader } from "@/components/app/primitives";
import { useRemote } from "@/hooks/useRemote";
import { USE_MOCK_API } from "@/config/env";

const STATUS_FILTERS = [
  ["", "All applications"], ["submitted", "Submitted"], ["under_review", "Reviewing"],
  ["shortlisted", "Shortlisted"], ["interview", "Interview scheduled"], ["selected", "Selected"],
  ["rejected", "Not selected"], ["on_hold", "On hold"],
];

const STAGE_TONES = { done: "bg-emerald-50 text-emerald-700", current: "bg-brand-soft text-brand", waiting: "bg-stone-100 text-stone-400", skipped: "bg-stone-100 text-stone-500" };
const STAGE_LABELS = { cv: "CV review", screening: "Screening interview", technical: "Technical interview", decision: "Decision" };
const date = (value) => value ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";
const dateTime = (value) => value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

export default function CandidateApplications() {
  const { id } = useParams();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  if (USE_MOCK_API) return <EmptyState icon={BriefcaseBusiness} title="Application tracking unavailable" message="Application tracking is available when connected to the IntelliHire backend." />;
  return id
    ? <ApplicationDetail id={id} />
    : <ApplicationList status={status} setStatus={setStatus} page={page} setPage={setPage} />;
}

function ApplicationList({ status, setStatus, page, setPage }) {
  const result = useRemote(({ signal }) => trackingApi.list({ status, page, pageSize: 10 }, { signal }), [status, page]);
  const data = result.data;

  return <div className="space-y-6">
    <PageHeader eyebrow="Candidate portal" title={<>Your <em>applications</em></>} subtitle="Follow candidate-visible updates for each hiring process." actions={<Link to="/track/request-link" className="btn-secondary"><ExternalLink size={15} /> Recover tracking links</Link>} />
    <div className="flex flex-wrap items-end justify-between gap-3">
      <label className="grid gap-1.5 text-[12px] font-semibold text-stone-500">Status
        <select aria-label="Filter applications by status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="field !h-10 min-w-[190px]">
          {STATUS_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      {data && <p className="text-[13px] text-stone-500">{data.count} application{data.count === 1 ? "" : "s"}</p>}
    </div>

    {result.status === "loading" && !data ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-brand" size={26} aria-label="Loading applications" /></div> : null}
    {result.status === "error" && !data ? <Card role="alert" className="p-6 text-center">
      <WifiOff size={24} className="mx-auto text-stone-400" /><p className="mt-3 text-[14px] text-stone-600">{result.error.message}</p>
      <button type="button" onClick={result.reload} className="btn-secondary mt-4"><RefreshCw size={14} /> Try again</button>
    </Card> : null}
    {result.status === "error" && data ? <p role="alert" className="text-[13px] text-red-700">Refresh failed: {result.error.message}</p> : null}

    {data?.results.length === 0 && <EmptyState icon={BriefcaseBusiness} title="No applications found" message={status ? "Try another status filter, or clear the filter to see all applications." : "Applications submitted with your verified email or linked to your account will appear here."} action={status ? <button type="button" onClick={() => { setStatus(""); setPage(1); }} className="btn-secondary">Clear filter</button> : <Link to="/track/request-link" className="btn-secondary">Recover tracking links</Link>} />}
    {data?.results.length > 0 && <>
      <div className="space-y-3" aria-busy={result.refreshing}>
        {data.results.map((application) => <Link key={application.id} to={`/candidate/applications/${application.id}`} className="group block">
          <Card interactive className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand"><BriefcaseBusiness size={18} /></span>
              <span className="min-w-[180px] flex-1">
                <span className="block text-[14px] font-semibold text-ink">{application.jobTitle}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-stone-500"><span>{application.companyName}</span><span>·</span><span>{application.reference}</span><span>·</span><span>Applied {date(application.appliedAt)}</span></span>
                <span className="mt-1 block text-[12px] text-stone-500">Current stage: {STAGE_LABELS[application.currentStage] || "Decision recorded"}</span>
              </span>
              <Badge tone={application.status === "selected" ? "success" : application.status === "rejected" ? "neutral" : application.pendingInvitation ? "brand" : "warning"}>{application.statusLabel}</Badge>
              <ArrowRight size={17} className="text-stone-400 transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
            </div>
            {application.pendingInvitation && <span className="sr-only">Interview invitation waiting</span>}
          </Card>
        </Link>)}
      </div>
      {(data.hasPrevious || data.hasNext) && <nav aria-label="Application pages" className="flex items-center justify-between border-t border-[var(--line)] pt-4">
        <button type="button" disabled={!data.hasPrevious || result.refreshing} onClick={() => setPage((current) => Math.max(1, current - 1))} className="btn-secondary" aria-label="Previous page"><ArrowLeft size={15} /> Previous</button>
        <span className="text-[12px] text-stone-500">Page {page}</span>
        <button type="button" disabled={!data.hasNext || result.refreshing} onClick={() => setPage((current) => current + 1)} className="btn-secondary" aria-label="Next page">Next <ArrowRight size={15} /></button>
      </nav>}
    </>}
  </div>;
}

function ApplicationDetail({ id }) {
  const [linkResult, setLinkResult] = useState(null);
  const [linkError, setLinkError] = useState("");
  const [requesting, setRequesting] = useState(false);
  const detail = useRemote(({ signal }) => trackingApi.detail(id, { signal }), [id]);

  const getInterviewLink = async () => {
    if (requesting) return;
    setRequesting(true);
    setLinkError("");
    setLinkResult(null);
    try { setLinkResult(await trackingApi.refreshCandidateInterviewLink(id)); }
    catch (error) { setLinkError(error.message); }
    finally { setRequesting(false); }
  };

  if (detail.status === "loading") return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-brand" size={26} aria-label="Loading application" /></div>;
  if (detail.status === "error" && !detail.data) return <Card role="alert" className="p-6 text-center"><WifiOff size={24} className="mx-auto text-stone-400" /><p className="mt-3 text-[14px] text-stone-600">{detail.error.status === 404 ? "Application not found." : detail.error.message}</p><div className="mt-4 flex justify-center gap-2"><Link to="/candidate/applications" className="btn-secondary"><ArrowLeft size={14} /> Applications</Link><button type="button" onClick={detail.reload} className="btn-secondary"><RefreshCw size={14} /> Retry</button></div></Card>;

  const application = detail.data;
  if (!application) return null;
  return <div className="space-y-6">
    <PageHeader eyebrow="Your applications" title={<>{application.jobTitle} <em>at {application.companyName}</em></>} subtitle={`Reference ${application.reference} · Submitted ${date(application.appliedAt)}`} actions={<Link to="/candidate/applications" className="btn-secondary"><ArrowLeft size={15} /> All applications</Link>} />
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-5">
        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-4"><div><p className="text-[11px] font-semibold uppercase text-stone-400">Current status</p><h2 className="mt-1 text-[17px] font-semibold text-ink">{application.statusLabel}</h2></div><Badge tone={application.decision ? "neutral" : "brand"}>{application.decision ? "Decision recorded" : "In progress"}</Badge></div>
          <ol aria-label="Application stages" className="mt-5 grid gap-3 sm:grid-cols-2">
            {application.stages.map((stage) => <li key={stage.key} className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--line)] p-3"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${STAGE_TONES[stage.state]}`}>{stage.state === "done" ? <Check size={15} /> : stage.state === "current" ? <Clock3 size={15} /> : <span className="h-2 w-2 rounded-full bg-current" />}</span><span className="min-w-0"><span className="block text-[13px] font-semibold text-ink">{stage.label}</span><span className="text-[11px] capitalize text-stone-500">{stage.state}</span></span></li>)}
          </ol>
        </Card>

        {application.pendingInvitation && <Card className="border-brand/20 bg-brand-soft/30 p-5"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand"><CalendarDays size={17} /></span><div className="min-w-0 flex-1"><p className="text-[13px] font-semibold text-ink">{application.pendingInvitation.kind === "technical" ? "Technical" : "Screening"} interview invitation</p><p className="mt-1 text-[12px] text-stone-600">Invitation expires {dateTime(application.pendingInvitation.expiresAt)}.</p>{linkError && <p role="alert" className="mt-2 text-[12px] text-red-700">{linkError}</p>}{linkResult ? <a href={linkResult.url} className="btn-primary mt-3 !h-9 !px-3 text-[12px]">Open interview <ExternalLink size={14} /></a> : <button type="button" disabled={requesting || !application.pendingInvitation.canGetLink} onClick={getInterviewLink} className="btn-primary mt-3 !h-9 !px-3 text-[12px]">{requesting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={13} />} Get fresh interview link</button>}</div></div></Card>}

        {application.decision && <Card className="p-5"><p className="flex items-center gap-2 text-[13px] font-semibold text-ink"><CheckCircle2 size={16} className="text-stone-500" /> Hiring team decision</p><p className="mt-2 text-[14px] text-stone-700">{application.decision.label}</p><p className="mt-1 text-[12px] text-stone-500">Recorded {dateTime(application.decision.decidedAt)}</p></Card>}

        <Card className="p-5 sm:p-6"><h2 className="text-[15px] font-semibold text-ink">Status updates</h2><p className="mt-1 text-[12px] text-stone-500">Candidate-visible status changes only.</p>{application.timeline.length ? <ol className="mt-5 space-y-4">{application.timeline.map((event, index) => <li key={`${event.status}-${event.at}-${index}`} className="flex gap-3"><span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-600"><Check size={14} /></span><span className="min-w-0 flex-1"><span className="block text-[13px] font-medium text-ink">{event.label}</span><time className="mt-0.5 block text-[11px] text-stone-500" dateTime={event.at}>{dateTime(event.at)}</time></span></li>)}</ol> : <p className="mt-5 text-[13px] text-stone-500">No status updates have been recorded yet.</p>}</Card>
      </div>
      <aside className="space-y-4"><Card className="p-4"><h2 className="text-[13px] font-semibold text-ink">Application summary</h2><div className="mt-4 space-y-3"><Fact icon={BriefcaseBusiness} label="Role" value={application.jobTitle} /><Fact icon={CalendarDays} label="Applied" value={date(application.appliedAt)} /><Fact icon={BriefcaseBusiness} label="Reference" value={application.reference} /><Fact icon={Clock3} label="Current stage" value={application.currentStage ? application.stages.find((stage) => stage.key === application.currentStage)?.label || "In progress" : "Decision recorded"} /></div></Card><Card className="p-4"><h2 className="text-[12.5px] font-semibold text-ink">Candidate privacy</h2><p className="mt-2 text-[11.5px] leading-relaxed text-stone-500">This view contains candidate-safe milestones only. Interview feedback, internal notes, and assessment scores are private to the hiring team.</p></Card></aside>
    </div>
  </div>;
}

function Fact({ icon: Icon, label, value }) { return <div className="flex gap-2.5"><Icon size={14} className="mt-0.5 shrink-0 text-stone-400" /><div className="min-w-0"><p className="text-[10.5px] text-stone-400">{label}</p><p className="mt-0.5 break-words text-[12px] font-medium text-stone-700">{value}</p></div></div>; }
