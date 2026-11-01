import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Award, Building2, Download, Globe, Mail, PauseCircle, PlayCircle, SearchX, Trash2, TrendingUp, UserRound, Users,
} from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, StatTile } from "@/components/app/primitives";
import { ActionDialog, DataTable, Drawer, Field, SearchField, SelectField, Tabs } from "@/components/admin/primitives";
import { Avatar } from "@/components/app/HeaderMenus";
import Reveal from "@/components/shared/Reveal";
import { accountsApi } from "@/api/authApi";
import { ACCOUNT_STATUS, allAccounts, practiceSummaryFor } from "@/lib/adminStats";
import { logAudit } from "@/store/auditStore";
import { formatDate, relativeTime } from "@/lib/candidateStats";
import { downloadFile, toCsv } from "@/lib/csv";
import { toast } from "@/store/toastStore";

const SORTS = {
  newest: { label: "Newest first", fn: (a, b) => b.createdAt - a.createdAt },
  oldest: { label: "Oldest first", fn: (a, b) => a.createdAt - b.createdAt },
  name: { label: "Name A–Z", fn: (a, b) => a.name.localeCompare(b.name) },
};

const ACTIONS = {
  suspend: { status: "suspended", title: (n) => `Suspend ${n}?`, message: "They are signed out immediately and cannot sign back in.", confirm: "Suspend account", reason: true, tone: "danger", audit: "suspend", toast: "suspended" },
  activate: { status: "active", title: (n) => `Reactivate ${n}?`, message: "They regain access to their workspace straight away.", confirm: "Reactivate", reason: false, audit: "activate", toast: "reactivated" },
  delete: { title: (n) => `Delete ${n}?`, message: "This permanently removes the account and cannot be undone. Their practice data stays on their own device.", confirm: "Delete account", reason: true, tone: "danger", audit: "delete", toast: "deleted" },
};

const StatusBadge = ({ status }) => <Badge tone={ACCOUNT_STATUS[status]?.tone || "neutral"}>{ACCOUNT_STATUS[status]?.label || status}</Badge>;

function RowActions({ a, full, setDialog }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${full ? "" : "justify-end"}`} onClick={(e) => e.stopPropagation()}>
      {a.status === "suspended" ? (
        <button type="button" onClick={() => setDialog({ kind: "activate", targets: [a] })} className={`btn-secondary !h-9 !px-3.5 text-[12.5px] ${full ? "flex-1" : ""}`}>
          <PlayCircle size={15} /> Reactivate
        </button>
      ) : (
        <button type="button" onClick={() => setDialog({ kind: "suspend", targets: [a] })} className={`btn-secondary !h-9 !px-3.5 text-[12.5px] hover:!border-red-300 hover:!text-red-600 ${full ? "flex-1" : ""}`}>
          <PauseCircle size={15} /> Suspend
        </button>
      )}
      <button
        type="button"
        onClick={() => setDialog({ kind: "delete", targets: [a] })}
        aria-label={`Delete ${a.name}`}
        className="icon-btn flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] text-stone-400 hover:border-red-200 hover:text-red-600"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

export default function AdminUsers() {
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState("all");
  const [role, setRole] = useState("all");
  const [sort, setSort] = useState("newest");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);

  const accounts = useMemo(() => {
    void version;
    return allAccounts();
  }, [version]);

  const counts = useMemo(
    () => ({
      all: accounts.length,
      active: accounts.filter((a) => a.status === "active").length,
      pending: accounts.filter((a) => a.status === "pending").length,
      suspended: accounts.filter((a) => a.status === "suspended").length,
      candidates: accounts.filter((a) => a.role === "candidate").length,
      companies: accounts.filter((a) => a.role === "company").length,
    }),
    [accounts],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accounts
      .filter((a) => (tab === "all" || a.status === tab) && (role === "all" || a.role === role))
      .filter((a) => !q || `${a.name} ${a.email} ${a.companyName || ""}`.toLowerCase().includes(q))
      .sort(SORTS[sort].fn);
  }, [accounts, tab, role, query, sort]);

  const open = accounts.find((a) => a.id === openId);
  const openPractice = open?.role === "candidate" ? practiceSummaryFor(open.id) : null;

  const run = useCallback(async (kind, targets, reason) => {
    const cfg = ACTIONS[kind];
    setBusy(true);
    const ok = [];
    const failed = [];
    for (const t of targets) {
      try {
        if (kind === "delete") await accountsApi.remove(t.id);
        else await accountsApi.setStatus(t.id, cfg.status, reason);
        logAudit({ action: cfg.audit, targetType: t.role, targetId: t.id, targetName: t.name, reason });
        ok.push(t);
      } catch (err) {
        failed.push({ name: t.name, message: err.message });
      }
    }
    if (ok.length) {
      toast({
        type: cfg.tone === "danger" ? "warning" : "success",
        title: ok.length === 1 ? `${ok[0].name} ${cfg.toast}` : `${ok.length} accounts ${cfg.toast}`,
        message: kind === "activate" ? "Access restored." : kind === "delete" ? "The account is gone for good." : "They can no longer sign in.",
      });
    }
    if (failed.length) toast({ type: "error", title: `${failed.length} could not be ${cfg.toast}`, message: failed[0].message });
    setVersion((v) => v + 1);
    setSelected([]);
    setDialog(null);
    setOpenId(null);
    setBusy(false);
  }, []);

  const exportCsv = () => {
    const headers = ["Name", "Email", "Role", "Status", "Registered", "Company", "Target role", "Interviews", "Average score"];
    const data = rows.map((a) => {
      const p = a.role === "candidate" ? practiceSummaryFor(a.id) : null;
      return [
        a.name, a.email, a.role, ACCOUNT_STATUS[a.status]?.label || a.status,
        new Date(a.createdAt).toISOString().slice(0, 10),
        a.companyName || "", p?.targetRole || a.desiredRole || "", p?.sessions ?? "", p?.avg ?? "",
      ];
    });
    const name = `intellihire-accounts-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadFile(name, toCsv(headers, data));
    toast({ title: "Accounts exported", message: `${data.length} accounts saved to ${name}.` });
  };

  const columns = [
    {
      key: "name",
      label: "Account",
      cell: (a) => (
        <div className="flex items-center gap-3">
          <Avatar name={a.name} size={36} tone={a.role === "company" ? "dark" : "brand"} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{a.name}</p>
            <p className="truncate text-[12.5px] text-stone-500">{a.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      cell: (a) => (
        <Badge tone={a.role === "company" ? "dark" : "brand"}>
          {a.role === "company" ? <Building2 size={11} /> : <UserRound size={11} />} {a.role === "company" ? "Company" : "Candidate"}
        </Badge>
      ),
    },
    { key: "detail", label: "Detail", cell: (a) => <span className="truncate text-stone-600">{a.companyName || a.desiredRole || "—"}</span> },
    { key: "registered", label: "Registered", cell: (a) => <span className="whitespace-nowrap text-stone-600">{formatDate(a.createdAt)}</span> },
    { key: "status", label: "Status", cell: (a) => <StatusBadge status={a.status} /> },
    { key: "actions", label: "", className: "text-right", cell: (a) => <RowActions a={a} setDialog={setDialog} /> },
  ];

  const card = (a) => (
    <Card interactive className="p-4" onClick={() => setOpenId(a.id)}>
      <div className="flex items-start gap-3">
        <Avatar name={a.name} size={40} tone={a.role === "company" ? "dark" : "brand"} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-ink">{a.name}</p>
          <p className="truncate text-[12.5px] text-stone-500">{a.email}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusBadge status={a.status} />
            <Badge tone={a.role === "company" ? "dark" : "brand"}>{a.role === "company" ? "Company" : "Candidate"}</Badge>
          </div>
        </div>
      </div>
      <div className="mt-3 border-t border-[var(--line)] pt-3">
        <RowActions a={a} full setDialog={setDialog} />
      </div>
    </Card>
  );

  const cfg = dialog ? ACTIONS[dialog.kind] : null;
  const dialogName = dialog ? (dialog.targets.length === 1 ? dialog.targets[0].name : `${dialog.targets.length} accounts`) : "";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Accounts"
        title={<>Every <em>account</em> on the platform</>}
        subtitle="Candidates and employers, their status, and what they have done here."
        actions={
          <button type="button" onClick={exportCsv} className="btn-secondary">
            <Download size={16} /> Export CSV
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={Users} label="Accounts" value={counts.all} hint={`${counts.active} active`} />
        <StatTile icon={UserRound} label="Candidates" value={counts.candidates} delay={60} />
        <StatTile icon={Building2} label="Companies" value={counts.companies} delay={120} />
        <StatTile icon={PauseCircle} label="Suspended" value={counts.suspended} delay={180} />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "active", label: "Active", count: counts.active },
            { value: "pending", label: "Pending", count: counts.pending, alert: true },
            { value: "suspended", label: "Suspended", count: counts.suspended },
          ]}
        />
        <SearchField value={query} onChange={setQuery} placeholder="Search name, email or company" className="flex-1" />
        <SelectField label="Role" value={role} onChange={setRole} options={[{ value: "all", label: "All roles" }, { value: "candidate", label: "Candidates" }, { value: "company", label: "Companies" }]} />
        <SelectField label="Sort" value={sort} onChange={setSort} options={Object.entries(SORTS).map(([k, v]) => ({ value: k, label: v.label }))} />
      </div>

      {selected.length > 0 && (
        <div className="animate-fade-in-up flex flex-wrap items-center gap-3 rounded-2xl border border-brand/20 bg-brand-soft p-3 pl-4">
          <p className="text-[13px] font-semibold text-ink">{selected.length} selected</p>
          <button type="button" onClick={() => setDialog({ kind: "suspend", targets: rows.filter((r) => selected.includes(r.id)) })} className="btn-secondary !h-9 !px-3.5 text-[12.5px]">
            Suspend
          </button>
          <button type="button" onClick={() => setDialog({ kind: "activate", targets: rows.filter((r) => selected.includes(r.id)) })} className="btn-secondary !h-9 !px-3.5 text-[12.5px]">
            Reactivate
          </button>
          <button type="button" onClick={() => setSelected([])} className="ml-auto text-[12.5px] font-semibold text-stone-500 hover:text-ink">
            Clear
          </button>
        </div>
      )}

      <p className="text-[13px] text-stone-500">
        Showing <span className="font-semibold text-ink">{rows.length}</span> of {counts.all}
      </p>

      <Reveal>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(a) => a.id}
          onRowClick={(a) => setOpenId(a.id)}
          selected={selected}
          onToggle={(id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))}
          onToggleAll={(on) => setSelected(on ? rows.map((r) => r.id) : [])}
          renderCard={card}
          empty={
            <EmptyState
              icon={SearchX}
              title="No accounts match"
              message="Try a different search, tab or role filter."
              action={
                <button type="button" onClick={() => { setQuery(""); setTab("all"); setRole("all"); }} className="btn-secondary">
                  Clear filters
                </button>
              }
            />
          }
        />
      </Reveal>

      {open && (
        <Drawer
          title={open.name}
          subtitle={open.role === "company" ? open.companyName || "Company account" : open.desiredRole || "Candidate account"}
          accent={<Avatar name={open.name} size={44} tone={open.role === "company" ? "dark" : "brand"} />}
          onClose={() => setOpenId(null)}
          footer={<RowActions a={open} full setDialog={setDialog} />}
        >
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <StatusBadge status={open.status} />
            <Badge tone={open.role === "company" ? "dark" : "brand"}>{open.role === "company" ? "Company" : "Candidate"}</Badge>
            {open.statusChangedAt && <span className="text-[12px] text-stone-500">Changed {relativeTime(open.statusChangedAt)}</span>}
          </div>
          {open.statusReason && (
            <p className="mb-4 rounded-xl bg-stone-50 p-3 text-[13px] leading-relaxed text-stone-600">
              <span className="font-semibold text-ink">Reason on file:</span> {open.statusReason}
            </p>
          )}

          {openPractice ? (
            <div className="mb-5 grid grid-cols-3 gap-2">
              {[
                { icon: TrendingUp, label: "Interviews", value: openPractice.sessions },
                { icon: Award, label: "Average", value: openPractice.avg || "–" },
                { icon: Globe, label: "Communities", value: openPractice.memberships },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="rounded-2xl border border-[var(--line)] bg-stone-50/60 p-3 text-center">
                    <Icon size={15} className="mx-auto text-stone-400" />
                    <p className="mt-1 font-display text-[20px] font-medium tabular-nums text-ink">{s.value}</p>
                    <p className="text-[11.5px] text-stone-500">{s.label}</p>
                  </div>
                );
              })}
            </div>
          ) : open.role === "candidate" ? (
            <p className="mb-5 rounded-xl bg-stone-50 p-3 text-[13px] text-stone-500">No practice data yet — this candidate has not signed in on this device.</p>
          ) : null}

          <Field label="Email">
            <a href={`mailto:${open.email}`} className="link-brand inline-flex items-center gap-1.5">
              <Mail size={13} /> {open.email}
            </a>
          </Field>
          {open.role === "company" ? (
            <>
              <Field label="Company">{open.companyName}</Field>
              <Field label="Industry">{open.industry}</Field>
              <Field label="Team size">{open.companySize}</Field>
              <Field label="Website">{open.website}</Field>
            </>
          ) : (
            <>
              <Field label="Target role">{openPractice?.targetRole || open.desiredRole}</Field>
              <Field label="Skills">
                {(openPractice?.profile.skills || open.skills || []).length ? (
                  <span className="flex flex-wrap gap-1.5">
                    {(openPractice?.profile.skills || open.skills).map((s) => (
                      <span key={s} className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[12px] font-medium text-stone-600">{s}</span>
                    ))}
                  </span>
                ) : null}
              </Field>
              <Field label="LinkedIn">{openPractice?.profile.links?.linkedin || open.linkedIn}</Field>
              <Field label="CV">{openPractice?.profile.cv?.name || open.cvFileName}</Field>
              <Field label="Last practice">{openPractice?.lastAt ? relativeTime(openPractice.lastAt) : null}</Field>
            </>
          )}
          <Field label="Registered">{formatDate(open.createdAt, { day: "numeric", month: "long", year: "numeric" })}</Field>
          {open.role === "company" && (
            <Link to="/admin/companies" className="btn-secondary mt-4 w-full">
              Manage in Companies
            </Link>
          )}
        </Drawer>
      )}

      {dialog && cfg && (
        <ActionDialog
          title={cfg.title(dialogName)}
          message={cfg.message}
          confirmLabel={cfg.confirm}
          tone={cfg.tone}
          requireReason={cfg.reason}
          busy={busy}
          onConfirm={(reason) => run(dialog.kind, dialog.targets, reason)}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
