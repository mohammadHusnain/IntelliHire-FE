import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Building2, CheckCircle2, ChevronRight, Loader2, ShieldCheck, TrendingUp, UserRound, Users, WifiOff } from "lucide-react";
import { Card, CardHeader, EmptyState, PageHeader, StatTile } from "@/components/app/primitives";
import { ActionDialog } from "@/components/admin/primitives";
import { CompanyLogo } from "@/components/admin/companyParts";
import Reveal from "@/components/shared/Reveal";
import { platformCompaniesApi } from "@/api/platformCompaniesApi";
import { usersApi } from "@/api/usersApi";
import { useRemote } from "@/hooks/useRemote";
import { relativeTime } from "@/lib/candidateStats";
import { toast } from "@/store/toastStore";
import { ROUTES } from "@/config/routes";

const NOT_CONNECTED = "Not connected yet";

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

function Unconnected({ icon, title }) {
  return <EmptyState className="mt-5" icon={icon} title={title} message={`${NOT_CONNECTED}. This appears once its module is connected.`} />;
}

/**
 * Real-backend admin dashboard. Companies and accounts are live. Interviews, scores, communities, roles and
 * the audit log have no backend connection yet, so they say so instead of showing made-up numbers.
 */
export default function AdminDashboardLive() {
  const { status, data, error, reload } = useRemote((o) => loadOverview(o), []);
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);

  const decide = async (company, approve, reason) => {
    setBusy(true);
    try {
      if (approve) await platformCompaniesApi.approve(company.id);
      else await platformCompaniesApi.reject(company.id, reason);
      toast({ type: approve ? "success" : "warning", title: `${company.companyName} ${approve ? "approved" : "rejected"}`, message: approve ? "They can now sign in and post roles." : "They were told why." });
      setDialog(null);
      reload();
    } catch (err) {
      if (err.status === 409) {
        toast({ type: "warning", title: "Nothing changed", message: "Another admin has already reviewed this company. The list was refreshed." });
        setDialog(null);
        reload();
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title={waiting ? <>{waiting} {waiting === 1 ? "company needs" : "companies need"} <em>your review</em></> : <>Platform is <em>running clean</em></>}
        subtitle={waiting ? "Approvals are waiting. Everything else that is connected is healthy." : "No company approvals are outstanding right now."}
        actions={<Link to={ROUTES.ADMIN.REPORTS} className="btn-secondary"><TrendingUp size={16} /> Analytics</Link>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={Users} label="Accounts" value={data.accounts} hint="candidates and companies" />
        <StatTile icon={UserRound} label="Candidates" value={data.candidates} delay={60} />
        <StatTile icon={Building2} label="Companies" value={data.companies.all} hint={`${data.companies.active} active`} delay={120} />
        <StatTile icon={ShieldCheck} label="Awaiting approval" value={waiting} hint={waiting ? "Needs review" : "All clear"} delay={180} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Reveal className="min-w-0 lg:col-span-8">
          <Card className="h-full p-6">
            <CardHeader icon={TrendingUp} title="Platform activity" subtitle="Sign-ups, interviews and scores over time" />
            <Unconnected icon={TrendingUp} title="Activity charts" />
          </Card>
        </Reveal>

        <Reveal delay={100} className="min-w-0 lg:col-span-4">
          <Card className="flex h-full flex-col p-6">
            <CardHeader icon={ShieldCheck} title="Health" subtitle="Right now" />
            <ul className="mt-5 space-y-3">
              {[
                { label: "Companies awaiting approval", value: waiting, to: ROUTES.ADMIN.COMPANIES, alert: waiting > 0 },
                { label: "Suspended accounts", value: data.suspended, to: ROUTES.ADMIN.USERS, alert: false },
                { label: "Suspended companies", value: data.companies.suspended, to: ROUTES.ADMIN.COMPANIES, alert: false },
              ].map((r) => (
                <li key={r.label}>
                  <Link to={r.to} className={`group flex items-center gap-3 rounded-xl border p-3.5 transition-colors ${r.alert ? "border-amber-200 bg-amber-50 hover:border-amber-300" : "border-[var(--line)] hover:bg-stone-50"}`}>
                    <span className={`font-display text-[24px] font-medium tabular-nums ${r.alert ? "text-amber-700" : "text-ink"}`}>{r.value}</span>
                    <span className="min-w-0 flex-1 text-[13.5px] font-medium text-stone-600">{r.label}</span>
                    <ChevronRight size={16} className="text-stone-300 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>
      </div>

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
          <Card className="h-full p-6">
            <CardHeader icon={Users} title="Community join requests" subtitle="Candidates waiting on private communities" />
            <Unconnected icon={Users} title="Join requests" />
          </Card>
        </Reveal>
        <Reveal delay={80} className="min-w-0">
          <Card className="h-full p-6">
            <CardHeader icon={ShieldCheck} title="Recent admin actions" subtitle="Everything you change is recorded" />
            <Unconnected icon={ShieldCheck} title="Audit log" />
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
