import { useState } from "react";
import { Link } from "react-router-dom";
import { Activity, AlertTriangle, ArrowRight, Building2, Check, CheckCircle2, ChevronRight, Cpu, Flag, Loader2, Mail, ShieldCheck, TrendingUp, Users, WifiOff } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, PageHeader, StatTile } from "@/components/app/primitives";
import { ActionDialog } from "@/components/admin/primitives";
import { CompanyLogo } from "@/components/admin/companyParts";
import { BackupWarning, CountRow, HealthLine, InlineError, ResourceLine } from "@/components/admin/platformParts";
import Reveal from "@/components/shared/Reveal";
import { platformAdminApi } from "@/api/platformAdminApi";
import { platformCompaniesApi } from "@/api/platformCompaniesApi";
import { usersApi } from "@/api/usersApi";
import { useRemote } from "@/hooks/useRemote";
import { alertSeverityLabel, alertSeverityTone, eventTypeLabel, mapAlert } from "@/lib/platformMap";
import { relativeTime } from "@/lib/candidateStats";
import { toast } from "@/store/toastStore";
import { ROUTES } from "@/config/routes";

const ROLE_LABELS = { candidate: "Candidates", company_admin: "Company admins", hr: "HR staff", admin: "Platform admins" };
const STATUS_LABELS = { active: "Active", pending: "Pending", suspended: "Suspended", rejected: "Rejected", approved: "Approved", unverified: "Unverified" };
const KIND_LABELS = { screening: "Screening", technical: "Technical", mock: "Mock" };
const named = (map) => (key) => map[key] ?? key;

/** Totals the platform can report today, straight from the server. */
async function loadOverview({ signal }) {
  const [companies, pending, candidates, accounts] = await Promise.all([
    platformCompaniesApi.counts({ signal }),
    platformCompaniesApi.list({ status: "pending", page: 1, pageSize: 4 }, { signal }),
    usersApi.list({ role: "candidate", page_size: 1 }, { signal }),
    usersApi.list({ role: ["candidate", "company_admin", "hr"], page_size: 1 }, { signal }),
  ]);
  return {
    companies,
    pending: pending.results,
    candidates: candidates.count,
    accounts: accounts.count,
    suspended: accounts.status_counts?.suspended ?? 0,
  };
}

/**
 * The platform dashboard. Every metric block comes from `GET /platform-admin/dashboard/`, with
 * system health and the active alerts beside it, and the company approval queue below.
 */
export default function AdminDashboardLive() {
  const [version, setVersion] = useState(0);
  const { status, data, error, reload } = useRemote((o) => loadOverview(o), [version]);
  const metrics = useRemote((o) => platformAdminApi.dashboard(o), [version]);
  const health = useRemote((o) => platformAdminApi.health(o), [version]);
  const alerts = useRemote((o) => platformAdminApi.alerts({ active: true }, o), [version]);
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);

  const decide = async (company, approve, reason) => {
    setBusy(true);
    try {
      if (approve) await platformCompaniesApi.approve(company.id);
      else await platformCompaniesApi.reject(company.id, reason);
      toast({ type: approve ? "success" : "warning", title: `${company.companyName} ${approve ? "approved" : "rejected"}`, message: approve ? "They can now sign in and post roles." : "They were told why." });
      setDialog(null);
      setVersion((v) => v + 1);
    } catch (err) {
      if (err.status === 409) {
        toast({ type: "warning", title: "Nothing changed", message: "Another admin has already reviewed this company. The list was refreshed." });
        setDialog(null);
        setVersion((v) => v + 1);
      } else {
        toast({ type: "error", title: "Action failed", message: err.fieldErrors?.reason?.[0] || err.message });
      }
    } finally {
      setBusy(false);
    }
  };

  if (status === "error" && !data) {
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
  if (!data) return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-brand" size={26} aria-label="Loading dashboard" /></div>;

  const waiting = data.companies.pending;
  const m = metrics.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title={waiting ? <>{waiting} {waiting === 1 ? "company needs" : "companies need"} <em>your review</em></> : <>Platform is <em>running clean</em></>}
        subtitle={waiting ? "Approvals are waiting. Every figure below is counted by the server." : "No company approvals are outstanding right now."}
        actions={<Link to={ROUTES.ADMIN.REPORTS} className="btn-secondary"><TrendingUp size={16} /> AI usage</Link>}
      />

      <ActiveAlerts remote={alerts} onChanged={() => setVersion((v) => v + 1)} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={Users} label="Accounts" value={m ? m.users?.total ?? 0 : data.accounts} hint="every role" />
        <StatTile icon={Activity} label="Open roles" value={m ? m.jobs?.open ?? 0 : "—"} delay={60} />
        <StatTile icon={Flag} label="Open flags" value={m ? m.moderation?.open_flags ?? 0 : "—"} hint={m?.moderation?.open_flags ? "Needs review" : "All clear"} delay={120} />
        <StatTile icon={ShieldCheck} label="Awaiting approval" value={waiting} hint={waiting ? "Needs review" : "All clear"} delay={180} />
      </div>

      {metrics.status === "error" && <InlineError message={metrics.error.message} onRetry={metrics.reload} />}

      {m && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Reveal>
            <Card className="h-full space-y-4 p-5">
              <CardHeader icon={Users} title="People" subtitle="By role and by account status." />
              <CountRow title="By role" counts={m.users?.by_role} labelOf={named(ROLE_LABELS)} />
              <CountRow title="By status" counts={m.users?.by_status} labelOf={named(STATUS_LABELS)} />
              <Link to={ROUTES.ADMIN.USERS} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand hover:underline">Manage users <ArrowRight size={14} /></Link>
            </Card>
          </Reveal>
          <Reveal delay={60}>
            <Card className="h-full space-y-4 p-5">
              <CardHeader icon={Building2} title="Companies and communities" subtitle="By review status." />
              <CountRow title="Companies by status" counts={m.companies?.by_status} labelOf={named(STATUS_LABELS)} />
              <CountRow title="Communities" counts={{ total: m.communities?.total ?? 0 }} labelOf={() => "Live"} />
              <Link to={ROUTES.ADMIN.COMMUNITIES} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand hover:underline">Monitor content <ArrowRight size={14} /></Link>
            </Card>
          </Reveal>
          <Reveal delay={120}>
            <Card className="h-full space-y-4 p-5">
              <CardHeader icon={Activity} title="Hiring" subtitle="Roles, applications and finished interviews." />
              <CountRow title="Jobs by status" counts={m.jobs?.by_status} labelOf={named(STATUS_LABELS)} />
              <div className="grid grid-cols-3 gap-2 text-center">
                {[["Last 7 days", m.applications?.last_7_days], ["Last 30 days", m.applications?.last_30_days], ["All time", m.applications?.total]].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-stone-50 p-3">
                    <p className="text-[18px] font-semibold tabular-nums text-ink">{value ?? 0}</p>
                    <p className="text-[11px] text-stone-500">{label}</p>
                  </div>
                ))}
              </div>
              <CountRow title="Interviews finished, last 30 days" counts={m.interviews_30_days} labelOf={named(KIND_LABELS)} />
            </Card>
          </Reveal>
          <Reveal delay={180}>
            <Card className="h-full space-y-4 p-5">
              <CardHeader icon={ShieldCheck} title="AI, last 24 hours" subtitle="From the request log." />
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Calls", m.ai_24h?.calls ?? 0],
                  ["Failures", m.ai_24h?.failures ?? 0],
                  ["Average latency", `${m.ai_24h?.average_latency_ms ?? 0} ms`],
                  ["Tokens", (m.ai_24h?.prompt_tokens ?? 0) + (m.ai_24h?.completion_tokens ?? 0)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-stone-50 p-3">
                    <p className="text-[17px] font-semibold tabular-nums text-ink">{value}</p>
                    <p className="text-[11px] text-stone-500">{label}</p>
                  </div>
                ))}
              </div>
              <Link to={ROUTES.ADMIN.REPORTS} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand hover:underline">AI usage report <ArrowRight size={14} /></Link>
            </Card>
          </Reveal>
        </div>
      )}

      <SystemHealth remote={health} />

      <Reveal>
        <Card className="p-6">
          <CardHeader
            icon={Building2}
            title="Companies awaiting approval"
            subtitle={data.pending.length ? "Approve to let them sign in and post roles" : "Nothing waiting"}
            action={<Link to={ROUTES.ADMIN.COMPANIES} className="inline-flex items-center gap-1 text-[13px] font-semibold text-stone-500 hover:text-brand">All companies <ChevronRight size={15} /></Link>}
          />
          {data.pending.length ? (
            <ul className="mt-5 space-y-3">
              {data.pending.map((c) => (
                <li key={c.id} className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] p-4 sm:flex-row sm:items-center">
                  <CompanyLogo company={c} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-ink">{c.companyName}</p>
                    <p className="truncate text-[12.5px] text-stone-500">{c.industry || "Industry not set"} · registered {relativeTime(c.createdAt)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={busy} onClick={() => setDialog({ company: c, approve: true })} className="btn-primary !h-9 !px-3.5 text-[12.5px] disabled:opacity-50"><CheckCircle2 size={15} /> Approve</button>
                    <button type="button" disabled={busy} onClick={() => setDialog({ company: c, approve: false })} className="btn-secondary !h-9 !px-3.5 text-[12.5px] hover:!border-red-300 hover:!text-red-600 disabled:opacity-50">Reject</button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState className="mt-5" icon={CheckCircle2} title="All reviewed" message="No employer accounts are waiting for a decision." />
          )}
        </Card>
      </Reveal>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Reveal className="min-w-0">
          <Card className="flex h-full flex-col p-6">
            <CardHeader icon={Flag} title="Moderation" subtitle="Reports and flags waiting on a decision" />
            <p className="mt-4 text-[13px] text-stone-600">
              {m ? `${m.moderation?.open_flags ?? 0} open or being reviewed.` : "Loading…"}
            </p>
            <Link to={ROUTES.ADMIN.MODERATION} className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand hover:underline">
              Open the queue <ArrowRight size={14} />
            </Link>
          </Card>
        </Reveal>
        <Reveal delay={80} className="min-w-0">
          <Card className="flex h-full flex-col p-6">
            <CardHeader icon={ShieldCheck} title="Activity log" subtitle="Everything that happened, read-only" />
            <p className="mt-4 text-[13px] text-stone-600">Registrations, approvals, jobs, applications and interviews, with the actor and the time.</p>
            <Link to={ROUTES.ADMIN.MANAGEMENT} className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand hover:underline">
              Open the log <ArrowRight size={14} />
            </Link>
          </Card>
        </Reveal>
      </div>

      <div className="flex justify-center pt-2">
        <Link to={ROUTES.ADMIN.USERS} className="group inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-stone-500 hover:text-brand">
          Browse every account <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {dialog && (
        <ActionDialog
          title={`${dialog.approve ? "Approve" : "Reject"} ${dialog.company.companyName}?`}
          message={dialog.approve ? "They will be able to sign in, post roles and review candidates." : "They will not be able to sign in. The reason is emailed to them so they can correct and re-submit."}
          confirmLabel={dialog.approve ? "Approve company" : "Reject company"}
          tone={dialog.approve ? "primary" : "danger"}
          requireReason={!dialog.approve}
          busy={busy}
          onConfirm={(reason) => decide(dialog.company, dialog.approve, reason)}
          onClose={() => !busy && setDialog(null)}
        />
      )}
    </div>
  );
}

/** Active system alerts (Module 5 raises them). Acknowledging only hides one until the condition returns. */
function ActiveAlerts({ remote, onChanged }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const rows = (remote.data?.results || remote.data || []).map(mapAlert);

  const acknowledge = async (alert) => {
    setBusy(alert.id);
    setError("");
    try {
      await platformAdminApi.acknowledgeAlert(alert.id);
      toast({ title: "Alert acknowledged", message: "It comes back if the condition returns." });
      onChanged();
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy("");
    }
  };

  if (remote.status === "error") return <InlineError message={remote.error.message} onRetry={remote.reload} />;
  if (rows.length === 0) return null;

  return (
    <section aria-label="Active alerts" className="space-y-2">
      {rows.map((alert) => (
        <div key={alert.id} className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700"><AlertTriangle size={17} /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={alertSeverityTone(alert.severity)}>{alertSeverityLabel(alert.severity)}</Badge>
              <span className="text-[11.5px] text-amber-900">{eventTypeLabel(alert.kind)} · {relativeTime(alert.createdAt)}</span>
            </div>
            <p className="mt-1 text-[13px] text-amber-900">{alert.message}</p>
          </div>
          <button type="button" disabled={busy === alert.id} onClick={() => acknowledge(alert)} className="btn-secondary shrink-0 !h-9 text-[12.5px] disabled:opacity-50">
            <Check size={14} /> Acknowledge
          </button>
        </div>
      ))}
      {error && <InlineError message={error} />}
    </section>
  );
}

/** Deliberately simple: one ping each, the worker heartbeat, psutil numbers and the last backup. */
function SystemHealth({ remote }) {
  if (remote.status === "error" && !remote.data) return <InlineError message={remote.error.message} onRetry={remote.reload} />;
  const h = remote.data;
  if (!h) return null;

  return (
    <Card className="p-5">
      <CardHeader icon={Cpu} title="System health" subtitle="One check each. This is not a monitoring stack." />
      <div className="mt-4 grid gap-5 lg:grid-cols-3">
        <div className="divide-y divide-[var(--line)]">
          <HealthLine label="Database" ok={h.database?.ok} detail={h.database?.detail} />
          <HealthLine label="Storage" ok={h.storage?.ok} detail={h.storage?.detail} />
          <HealthLine label="Broker" ok={h.broker?.ok} detail={h.broker?.detail} />
          <HealthLine label="Worker heartbeat" ok={h.worker?.ok} detail={h.worker?.seconds_since != null ? `${h.worker.seconds_since}s ago` : "never"} />
        </div>
        <div className="divide-y divide-[var(--line)]">
          <ResourceLine label="CPU" value={h.resources?.cpu_percent} />
          <ResourceLine label="Memory" value={h.resources?.memory_percent} />
          <ResourceLine label="Disk" value={h.resources?.disk_percent} />
          {h.resources?.cpu_percent == null && <p className="py-2 text-[11.5px] text-stone-400">The server could not read its own resource usage.</p>}
        </div>
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-[13px] text-stone-600">
            <Mail size={15} className="text-stone-400" /> {h.email?.queued ?? 0} queued · {h.email?.failed ?? 0} failed
          </p>
          <div className="text-[13px] text-stone-600">
            AI last hour: {h.ai_last_hour?.calls ?? 0} calls, {h.ai_last_hour?.failures ?? 0} failed
            <span className="block text-[11.5px] text-stone-400">
              {h.ai_last_hour?.last_successful_at ? `last success ${relativeTime(h.ai_last_hour.last_successful_at)}` : "no successful call recorded"}
            </span>
          </div>
          <p className="text-[13px] text-stone-600">
            Backup: {h.backup?.last_successful_at ? relativeTime(h.backup.last_successful_at) : "none recorded"}
          </p>
          <BackupWarning backup={h.backup} />
        </div>
      </div>
    </Card>
  );
}
