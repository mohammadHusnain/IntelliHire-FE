import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Briefcase, Building2, CheckCircle2, ChevronRight, Globe2, Mic, ScrollText, ShieldCheck,
  TrendingUp, UserRound, Users,
} from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Segmented, StatTile, TrendChart } from "@/components/app/primitives";
import { ActionDialog } from "@/components/admin/primitives";
import Reveal from "@/components/shared/Reveal";
import { accountsApi } from "@/api/authApi";
import { platformStats } from "@/lib/adminStats";
import { AUDIT_ACTIONS, logAudit, useAuditStore } from "@/store/auditStore";
import { useCandidateActions, useCandidateStore } from "@/store/candidateStore";
import { formatDate, relativeTime } from "@/lib/candidateStats";
import { toast } from "@/store/toastStore";
import { ROUTES } from "@/config/routes";

const METRICS = [
  { value: "signups", label: "Sign-ups" },
  { value: "interviews", label: "Interviews" },
];

export default function AdminDashboard() {
  const [version, setVersion] = useState(0);
  const [metric, setMetric] = useState("signups");
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const records = useCandidateStore((s) => s.records);
  const { resolveRequest } = useCandidateActions();
  const auditEntries = useAuditStore((s) => s.entries);

  const stats = useMemo(() => {
    void version;
    void records;
    return platformStats(56);
  }, [version, records]);

  const { totals, pending, deltas, recent, weeks } = stats;
  const queue = pending.companies.length + pending.requests.length;

  const decide = useCallback(async (company, approve, reason) => {
    setBusy(true);
    try {
      await accountsApi.setStatus(company.id, approve ? "active" : "rejected", reason);
      logAudit({ action: approve ? "approve" : "reject", targetType: "company", targetId: company.id, targetName: company.companyName || company.name, reason });
      toast({
        type: approve ? "success" : "warning",
        title: `${company.companyName || company.name} ${approve ? "approved" : "rejected"}`,
        message: approve ? "They can now sign in and post roles." : "They can no longer sign in.",
      });
      setVersion((v) => v + 1);
      setDialog(null);
    } catch (err) {
      toast({ type: "error", title: "Action failed", message: err.message });
    } finally {
      setBusy(false);
    }
  }, []);

  const resolve = (req, approve) => {
    resolveRequest(req.userId, req.communityId, approve ? "joined" : null, req.community.name);
    logAudit({
      action: approve ? "request-approve" : "request-decline",
      targetType: "community",
      targetId: req.communityId,
      targetName: req.community.name,
      detail: `${req.name} (${req.email})`,
    });
    toast({
      type: approve ? "success" : "info",
      title: approve ? `${req.name} joined ${req.community.name}` : "Request declined",
      message: approve ? "They have been notified." : `${req.name} has been notified.`,
    });
  };

  const chartPoints = weeks.map((w) => ({
    label: formatDate(w.at, { day: "numeric", month: "short" }),
    value: metric === "signups" ? w.signups : w.interviews,
    sub: metric === "signups" ? `${w.candidates} candidates · ${w.companies} companies` : "interviews",
  }));
  const chartMax = Math.max(5, ...chartPoints.map((p) => p.value) ) * 1.2;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title={queue ? <>{queue} {queue === 1 ? "item needs" : "items need"} <em>your review</em></> : <>Platform is <em>running clean</em></>}
        subtitle={
          queue
            ? "Approvals and requests are waiting. Everything else is healthy."
            : "No approvals or join requests are outstanding right now."
        }
        actions={
          <Link to={ROUTES.ADMIN.REPORTS} className="btn-secondary">
            <TrendingUp size={16} /> Analytics
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={Users} label="Accounts" value={totals.accounts} delta={deltas.signups || null} hint={`${recent.signups} new in 8 weeks`} />
        <StatTile icon={Mic} label="Interviews" value={totals.interviews} delta={deltas.interviews || null} hint="practice sessions" delay={60} />
        <StatTile icon={TrendingUp} label="Average score" value={totals.avgScore} suffix="/100" hint="across all interviews" delay={120} />
        <StatTile icon={Briefcase} label="Open roles" value={totals.openJobs} hint={`${totals.communities} communities`} delay={180} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Reveal className="min-w-0 lg:col-span-8">
          <Card className="h-full p-6">
            <CardHeader
              icon={TrendingUp}
              title="Platform activity"
              subtitle="Per week, last eight weeks"
              action={<Segmented size="sm" ariaLabel="Metric" value={metric} onChange={setMetric} options={METRICS} />}
            />
            <div className="mt-6">
              <TrendChart key={metric} points={chartPoints} height={220} max={chartMax} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[var(--line)] pt-4 text-center">
              {[
                { label: "Candidates", value: totals.candidates, icon: UserRound },
                { label: "Companies", value: totals.companies, icon: Building2 },
                { label: "Communities", value: totals.communities, icon: Globe2 },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label}>
                    <Icon size={15} className="mx-auto text-stone-400" />
                    <p className="mt-1 font-display text-[22px] font-medium tabular-nums text-ink">{s.value}</p>
                    <p className="text-[12px] text-stone-500">{s.label}</p>
                  </div>
                );
              })}
            </div>
          </Card>
        </Reveal>

        <Reveal delay={100} className="min-w-0 lg:col-span-4">
          <Card className="flex h-full flex-col p-6">
            <CardHeader icon={ShieldCheck} title="Health" subtitle="Right now" />
            <ul className="mt-5 space-y-3">
              {[
                { label: "Companies awaiting approval", value: pending.companies.length, to: ROUTES.ADMIN.COMPANIES, alert: pending.companies.length > 0 },
                { label: "Community join requests", value: pending.requests.length, to: ROUTES.ADMIN.COMMUNITIES, alert: pending.requests.length > 0 },
                { label: "Suspended accounts", value: pending.suspended, to: ROUTES.ADMIN.USERS, alert: false },
              ].map((r) => (
                <li key={r.label}>
                  <Link
                    to={r.to}
                    className={`group flex items-center gap-3 rounded-xl border p-3.5 transition-colors ${
                      r.alert ? "border-amber-200 bg-amber-50 hover:border-amber-300" : "border-[var(--line)] hover:bg-stone-50"
                    }`}
                  >
                    <span className={`font-display text-[24px] font-medium tabular-nums ${r.alert ? "text-amber-700" : "text-ink"}`}>{r.value}</span>
                    <span className="min-w-0 flex-1 text-[13.5px] font-medium text-stone-600">{r.label}</span>
                    <ChevronRight size={16} className="text-stone-300 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-auto rounded-2xl bg-stone-50 p-4 pt-4">
              <p className="text-[13px] font-semibold text-ink">Registration</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-stone-500">
                Control sign-ups, auto-approval and the platform banner in{" "}
                <Link to={ROUTES.ADMIN.SETTINGS} className="link-brand">
                  Settings
                </Link>
                .
              </p>
            </div>
          </Card>
        </Reveal>
      </div>

      {/* Approval queue */}
      <Reveal>
        <Card className="p-6">
          <CardHeader
            icon={Building2}
            title="Companies awaiting approval"
            subtitle={pending.companies.length ? "Approve to let them sign in and post roles" : "Nothing waiting"}
            action={
              <Link to={ROUTES.ADMIN.COMPANIES} className="inline-flex items-center gap-1 text-[13px] font-semibold text-stone-500 hover:text-brand">
                All companies <ChevronRight size={15} />
              </Link>
            }
          />
          {pending.companies.length ? (
            <ul className="mt-5 space-y-3">
              {pending.companies.slice(0, 4).map((c, i) => (
                <li key={c.id} className="animate-fade-in-up flex flex-col gap-3 rounded-2xl border border-[var(--line)] p-4 sm:flex-row sm:items-center" style={{ animationDelay: `${i * 60}ms` }}>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-ink to-stone-600 text-[14px] font-semibold text-white">
                    {(c.companyName || c.name).slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-ink">{c.companyName || c.name}</p>
                    <p className="truncate text-[12.5px] text-stone-500">
                      {c.industry || "Industry not set"} · {c.companySize || "Size not set"} · registered {relativeTime(c.createdAt)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setDialog({ company: c, approve: true })} className="btn-primary !h-9 !px-3.5 text-[12.5px]">
                      <CheckCircle2 size={15} /> Approve
                    </button>
                    <button type="button" onClick={() => setDialog({ company: c, approve: false })} className="btn-secondary !h-9 !px-3.5 text-[12.5px] hover:!border-red-300 hover:!text-red-600">
                      Reject
                    </button>
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
          <Card className="h-full p-6">
            <CardHeader
              icon={Globe2}
              title="Community join requests"
              subtitle={pending.requests.length ? "Candidates waiting on private communities" : "Nothing waiting"}
              action={
                <Link to={ROUTES.ADMIN.COMMUNITIES} className="inline-flex items-center gap-1 text-[13px] font-semibold text-stone-500 hover:text-brand">
                  All <ChevronRight size={15} />
                </Link>
              }
            />
            {pending.requests.length ? (
              <ul className="mt-5 space-y-2">
                {pending.requests.slice(0, 4).map((r) => (
                  <li key={r.id} className="flex items-center gap-3 rounded-xl border border-[var(--line)] p-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold text-white" style={{ background: r.community.avatarBg }}>
                      {r.community.avatar}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-ink">{r.name}</span>
                      <span className="block truncate text-[12px] text-stone-500">wants to join {r.community.name}</span>
                    </span>
                    <span className="flex gap-1.5">
                      <button type="button" onClick={() => resolve(r, true)} className="btn-primary !h-8 !px-3 text-[12px]">Approve</button>
                      <button type="button" onClick={() => resolve(r, false)} className="btn-secondary !h-8 !px-3 text-[12px]">Decline</button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState className="mt-5" icon={CheckCircle2} title="No requests" message="Every join request has been handled." />
            )}
          </Card>
        </Reveal>

        <Reveal delay={80} className="min-w-0">
          <Card className="h-full p-6">
            <CardHeader
              icon={ScrollText}
              title="Recent admin actions"
              subtitle="Everything you change is recorded"
              action={
                <Link to={ROUTES.ADMIN.MANAGEMENT} className="inline-flex items-center gap-1 text-[13px] font-semibold text-stone-500 hover:text-brand">
                  Audit log <ChevronRight size={15} />
                </Link>
              }
            />
            {auditEntries.length ? (
              <ul className="mt-5 divide-y divide-[var(--line)]">
                {auditEntries.slice(0, 6).map((e) => (
                  <li key={e.id} className="flex items-center gap-3 py-3">
                    <Badge tone={AUDIT_ACTIONS[e.action]?.tone || "neutral"}>{AUDIT_ACTIONS[e.action]?.label || e.action}</Badge>
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-stone-700">{e.targetName}</span>
                    <span className="shrink-0 text-[12px] text-stone-400">{relativeTime(e.at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState className="mt-5" icon={ScrollText} title="No actions yet" message="Approvals, suspensions and settings changes will appear here." />
            )}
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
          title={`${dialog.approve ? "Approve" : "Reject"} ${dialog.company.companyName || dialog.company.name}?`}
          message={dialog.approve ? "They will be able to sign in, post roles and review candidates." : "They will not be able to sign in. The reason is kept in the audit log."}
          confirmLabel={dialog.approve ? "Approve company" : "Reject company"}
          tone={dialog.approve ? "primary" : "danger"}
          requireReason={!dialog.approve}
          busy={busy}
          onConfirm={(reason) => decide(dialog.company, dialog.approve, reason)}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
