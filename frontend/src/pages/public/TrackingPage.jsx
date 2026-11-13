import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BriefcaseBusiness, CalendarDays, Check, CheckCircle2, Clock3, ExternalLink, Loader2, Mail, RefreshCw, WifiOff } from "lucide-react";
import BrandLogo from "@/components/shared/BrandLogo";
import { Badge, Card } from "@/components/app/primitives";
import { trackingApi } from "@/api/trackingApi";
import { useRemote } from "@/hooks/useRemote";

const STATE_TONE = { done: "bg-emerald-50 text-emerald-700", current: "bg-brand-soft text-brand", waiting: "bg-stone-100 text-stone-400", skipped: "bg-stone-100 text-stone-500" };
const formatDate = (value) => value ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";
const formatDateTime = (value) => value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

function Shell({ children }) {
  return <main className="min-h-dvh bg-[#FAFAF9] px-4 py-8 sm:py-12"><div className="mx-auto max-w-[920px]"><div className="mb-8"><BrandLogo /></div>{children}</div></main>;
}

export default function TrackingPage() {
  const { token } = useParams();
  return token ? <PublicApplication token={token} /> : <LostLinkRequest />;
}

function PublicApplication({ token }) {
  const [link, setLink] = useState(null);
  const [linkError, setLinkError] = useState("");
  const [requesting, setRequesting] = useState(false);
  const remote = useRemote(({ signal }) => trackingApi.publicDetail(token, { signal }), [token]);

  const getLink = async () => {
    if (requesting) return;
    setRequesting(true);
    setLink(null);
    setLinkError("");
    try { setLink(await trackingApi.refreshPublicInterviewLink(token)); }
    catch (error) { setLinkError(error.message); }
    finally { setRequesting(false); }
  };

  if (remote.status === "loading") return <Shell><div className="flex justify-center py-24"><Loader2 className="animate-spin text-brand" size={28} aria-label="Loading application status" /></div></Shell>;
  if (remote.status === "error" && !remote.data) return <Shell><Card role="alert" className="p-7 text-center"><WifiOff size={28} className="mx-auto text-stone-400" /><h1 className="display mt-4 text-[26px]">{remote.error.status === 404 ? "Tracking link unavailable" : "We couldn’t load this application"}</h1><p className="mt-2 text-[14px] text-stone-600">{remote.error.status === 404 ? "This private link is invalid or has been replaced. Request a fresh tracking link by email." : remote.error.message}</p><div className="mt-5 flex justify-center gap-2"><Link to="/track/request-link" className="btn-primary">Request tracking links</Link>{remote.error.status !== 404 && <button type="button" onClick={remote.reload} className="btn-secondary"><RefreshCw size={14} /> Try again</button>}</div></Card></Shell>;
  if (!remote.data) return null;

  const application = remote.data;
  return <Shell>
    <div className="mb-6"><p className="eyebrow mb-3">Private application tracker</p><h1 className="display text-[30px] sm:text-[36px]">{application.jobTitle} <em>at {application.companyName}</em></h1><p className="mt-2 text-[14px] text-stone-500">Reference {application.reference} · Submitted {formatDate(application.appliedAt)}</p></div>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-5">
        <Card className="p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-4"><div><p className="text-[11px] font-semibold uppercase text-stone-400">Current status</p><h2 className="mt-1 text-[17px] font-semibold text-ink">{application.statusLabel}</h2></div><Badge tone={application.decision ? "neutral" : "brand"}>{application.decision ? "Decision recorded" : "In progress"}</Badge></div>
          <ol aria-label="Application stages" className="mt-5 grid gap-3 sm:grid-cols-2">{application.stages.map((stage) => <li key={stage.key} className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--line)] p-3"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${STATE_TONE[stage.state]}`}>{stage.state === "done" ? <Check size={15} /> : stage.state === "current" ? <Clock3 size={15} /> : <span className="h-2 w-2 rounded-full bg-current" />}</span><span className="min-w-0"><span className="block text-[13px] font-semibold text-ink">{stage.label}</span><span className="text-[11px] capitalize text-stone-500">{stage.state}</span></span></li>)}</ol>
        </Card>
        {application.pendingInvitation && <Card className="border-brand/20 bg-brand-soft/30 p-5"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand"><CalendarDays size={17} /></span><div className="min-w-0 flex-1"><h2 className="text-[13px] font-semibold text-ink">{application.pendingInvitation.kind === "technical" ? "Technical" : "Screening"} interview invitation</h2><p className="mt-1 text-[12px] text-stone-600">Invitation expires {formatDateTime(application.pendingInvitation.expiresAt)}.</p>{linkError && <p role="alert" className="mt-2 text-[12px] text-red-700">{linkError}</p>}{link ? <a className="btn-primary mt-3 !h-9 !px-3 text-[12px]" href={link.url} referrerPolicy="no-referrer">Open interview <ExternalLink size={14} /></a> : <button type="button" className="btn-primary mt-3 !h-9 !px-3 text-[12px]" disabled={requesting || !application.pendingInvitation.canGetLink} onClick={getLink}>{requesting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={13} />} Get a fresh interview link</button>}</div></div></Card>}
        {application.decision && <Card className="p-5"><h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink"><CheckCircle2 size={16} className="text-stone-500" /> Hiring team decision</h2><p className="mt-2 text-[14px] text-stone-700">{application.decision.label}</p><p className="mt-1 text-[12px] text-stone-500">Recorded {formatDateTime(application.decision.decidedAt)}</p></Card>}
        <Card className="p-5 sm:p-6"><h2 className="text-[15px] font-semibold text-ink">Status updates</h2><p className="mt-1 text-[12px] text-stone-500">Candidate-visible status changes only.</p>{application.timeline.length ? <ol className="mt-5 space-y-4">{application.timeline.map((event, index) => <li key={`${event.status}-${event.at}-${index}`} className="flex gap-3"><span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-600"><Check size={14} /></span><span><span className="block text-[13px] font-medium text-ink">{event.label}</span><time className="mt-0.5 block text-[11px] text-stone-500" dateTime={event.at}>{formatDateTime(event.at)}</time></span></li>)}</ol> : <p className="mt-5 text-[13px] text-stone-500">No status updates have been recorded yet.</p>}</Card>
      </div>
      <aside className="space-y-4"><Card className="p-4"><h2 className="text-[13px] font-semibold text-ink">Application summary</h2><div className="mt-4 space-y-3"><Fact icon={BriefcaseBusiness} label="Role" value={application.jobTitle} /><Fact icon={CalendarDays} label="Applied" value={formatDate(application.appliedAt)} /><Fact icon={BriefcaseBusiness} label="Reference" value={application.reference} /></div></Card><Card className="p-4"><h2 className="text-[12.5px] font-semibold text-ink">Candidate privacy</h2><p className="mt-2 text-[11.5px] leading-relaxed text-stone-500">This private link shows candidate-safe milestones only. Interview feedback, internal notes, and assessment scores are not included.</p><Link to="/track/request-link" className="mt-3 inline-flex text-[12px] font-semibold text-brand hover:underline">Need a fresh tracking link?</Link></Card></aside>
    </div>
  </Shell>;
}

function LostLinkRequest() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const sendingLock = useRef(false);

  const submit = async (event) => {
    event.preventDefault();
    if (sendingLock.current) return;
    sendingLock.current = true;
    setSending(true);
    setError("");
    setFieldError("");
    try {
      await trackingApi.requestLinks(email.trim());
      setSent(true);
    } catch (cause) {
      setError(cause.message);
      setFieldError(cause.field("email"));
    } finally { sendingLock.current = false; setSending(false); }
  };

  return <Shell><Card className="mx-auto max-w-[560px] p-6 sm:p-8"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand"><Mail size={20} /></span><p className="eyebrow mt-5">Application tracking</p><h1 className="display mt-2 text-[28px]">Recover your <em>tracking links</em></h1><p className="mt-2 text-[14px] leading-relaxed text-stone-500">Enter the email address used to apply. If we find applications for that address, we’ll email fresh private tracking links.</p>
    {sent ? <div role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-[14px] font-semibold text-emerald-800">Request received</p><p className="mt-1 text-[13px] text-emerald-800">If we found applications for this email, we have sent you the links to follow them.</p></div> : <form onSubmit={submit} className="mt-6 space-y-4"><label className="grid gap-1.5 text-[12px] font-semibold text-stone-600" htmlFor="tracking-email">Email address<input id="tracking-email" type="email" autoComplete="email" required value={email} onChange={(event) => { setEmail(event.target.value); setFieldError(""); setError(""); }} aria-invalid={!!fieldError} aria-describedby={fieldError ? "tracking-email-error" : undefined} className="field" placeholder="you@example.com" /></label>{fieldError && <p id="tracking-email-error" role="alert" className="text-[12px] text-red-700">{fieldError}</p>}{error && !fieldError && <p role="alert" className="text-[12px] text-red-700">{error}</p>}<button type="submit" disabled={sending} className="btn-primary w-full">{sending ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />} Send tracking links</button></form>}
    <Link to="/login" className="mt-5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-stone-500 hover:text-brand"><ArrowLeft size={14} /> Sign in instead</Link>
  </Card></Shell>;
}

function Fact({ icon: Icon, label, value }) { return <div className="flex gap-2.5"><Icon size={14} className="mt-0.5 shrink-0 text-stone-400" /><div className="min-w-0"><p className="text-[10.5px] text-stone-400">{label}</p><p className="mt-0.5 break-words text-[12px] font-medium text-stone-700">{value}</p></div></div>; }
