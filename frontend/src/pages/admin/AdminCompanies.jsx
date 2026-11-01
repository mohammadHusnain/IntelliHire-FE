import { useCallback, useMemo, useState } from "react";
import {
  Building2, CheckCircle2, Download, ExternalLink, Globe, Mail, PauseCircle, PlayCircle, SearchX, ShieldX, Users,
} from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, StatTile } from "@/components/app/primitives";
import { ActionDialog, DataTable, Drawer, Field, SearchField, SelectField, Tabs } from "@/components/admin/primitives";
import Reveal from "@/components/shared/Reveal";
import { accountsApi } from "@/api/authApi";
import { ACCOUNT_STATUS, allAccounts } from "@/lib/adminStats";
import { logAudit } from "@/store/auditStore";
import { formatDate, relativeTime } from "@/lib/candidateStats";
import { downloadFile, toCsv } from "@/lib/csv";
import { toast } from "@/store/toastStore";
import { getJobs } from "@/data/jobsStore";

const TABS = [
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

const ACTIONS = {
  approve: { status: "active", title: (c) => `Approve ${c}?`, message: "They will be able to sign in, post roles and review candidates.", confirm: "Approve company", reason: false, audit: "approve", toast: "approved" },
  reject: { status: "rejected", title: (c) => `Reject ${c}?`, message: "They will not be able to sign in. The reason is kept in the audit log.", confirm: "Reject company", reason: true, tone: "danger", audit: "reject", toast: "rejected" },
  suspend: { status: "suspended", title: (c) => `Suspend ${c}?`, message: "They are signed out immediately and cannot sign back in.", confirm: "Suspend company", reason: true, tone: "danger", audit: "suspend", toast: "suspended" },
  activate: { status: "active", title: (c) => `Reactivate ${c}?`, message: "They regain full access to their workspace.", confirm: "Reactivate", reason: false, audit: "activate", toast: "reactivated" },
};

const CompanyLogo = ({ company, size = 40 }) => (
  <span
    className="flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-ink to-stone-600 font-semibold text-white"
    style={{ width: size, height: size, fontSize: size * 0.34 }}
  >
    {(company.companyName || company.name || "?").slice(0, 2).toUpperCase()}
  </span>
);

const StatusBadge = ({ status }) => <Badge tone={ACCOUNT_STATUS[status]?.tone || "neutral"}>{ACCOUNT_STATUS[status]?.label || status}</Badge>;

function Actions({ c, full = false, setDialog }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${full ? "" : "justify-end"}`} onClick={(e) => e.stopPropagation()}>
      {c.status === "pending" && (
        <>
          <button type="button" onClick={() => setDialog({ kind: "approve", company: c })} className={`btn-primary !h-9 !px-3.5 text-[12.5px] ${full ? "flex-1" : ""}`}>
            <CheckCircle2 size={15} /> Approve
          </button>
          <button type="button" onClick={() => setDialog({ kind: "reject", company: c })} className={`btn-secondary !h-9 !px-3.5 text-[12.5px] hover:!border-red-300 hover:!text-red-600 ${full ? "flex-1" : ""}`}>
            Reject
          </button>
        </>
      )}
      {c.status === "active" && (
        <button type="button" onClick={() => setDialog({ kind: "suspend", company: c })} className="btn-secondary !h-9 !px-3.5 text-[12.5px] hover:!border-red-300 hover:!text-red-600">
          <PauseCircle size={15} /> Suspend
        </button>
      )}
      {(c.status === "suspended" || c.status === "rejected") && (
        <button type="button" onClick={() => setDialog({ kind: "activate", company: c })} className="btn-secondary !h-9 !px-3.5 text-[12.5px]">
          <PlayCircle size={15} /> Reactivate
        </button>
      )}
    </div>
  );
}

export default function AdminCompanies() {
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState("pending");
  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState("all");
  const [openId, setOpenId] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);

  const companies = useMemo(() => {
    void version;
    return allAccounts().filter((a) => a.role === "company");
  }, [version]);

  const jobs = useMemo(() => getJobs(), []);
  const counts = useMemo(
    () => ({
      pending: companies.filter((c) => c.status === "pending").length,
      active: companies.filter((c) => c.status === "active").length,
      suspended: companies.filter((c) => c.status === "suspended").length,
      rejected: companies.filter((c) => c.status === "rejected").length,
      all: companies.length,
    }),
    [companies],
  );

  const industries = useMemo(() => [...new Set(companies.map((c) => c.industry).filter(Boolean))].sort(), [companies]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return companies
      .filter((c) => (tab === "all" || c.status === tab) && (industry === "all" || c.industry === industry))
      .filter((c) => !q || `${c.companyName || ""} ${c.name} ${c.email}`.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [companies, tab, industry, query]);

  const open = companies.find((c) => c.id === openId);

  const run = useCallback(async (kind, company, reason) => {
    const cfg = ACTIONS[kind];
    setBusy(true);
    try {
      await accountsApi.setStatus(company.id, cfg.status, reason);
      logAudit({ action: cfg.audit, targetType: "company", targetId: company.id, targetName: company.companyName || company.name, reason });
      toast({
        type: cfg.tone === "danger" ? "warning" : "success",
        title: `${company.companyName || company.name} ${cfg.toast}`,
        message: kind === "approve" ? "They can now sign in and post roles." : kind === "activate" ? "Access restored." : "They can no longer sign in.",
      });
      setVersion((v) => v + 1);
      setDialog(null);
      setOpenId(null);
    } catch (err) {
      toast({ type: "error", title: "Action failed", message: err.message });
    } finally {
      setBusy(false);
    }
  }, []);

  const exportCsv = () => {
    const headers = ["Company", "Owner", "Email", "Industry", "Size", "Website", "Status", "Registered"];
    const data = rows.map((c) => [
      c.companyName || "",
      c.name,
      c.email,
      c.industry || "",
      c.companySize || "",
      c.website || "",
      ACCOUNT_STATUS[c.status]?.label || c.status,
      new Date(c.createdAt).toISOString().slice(0, 10),
    ]);
    const name = `intellihire-companies-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadFile(name, toCsv(headers, data));
    toast({ title: "Companies exported", message: `${data.length} companies saved to ${name}.` });
  };

  const jobCount = (c) => jobs.filter((j) => j.companyId === c.id).length;

  const columns = [
    {
      key: "company",
      label: "Company",
      cell: (c) => (
        <div className="flex items-center gap-3">
          <CompanyLogo company={c} size={36} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{c.companyName || c.name}</p>
            <p className="truncate text-[12.5px] text-stone-500">{c.email}</p>
          </div>
        </div>
      ),
    },
    { key: "industry", label: "Industry", cell: (c) => <span className="text-stone-600">{c.industry || "—"}</span> },
    { key: "size", label: "Size", cell: (c) => <span className="whitespace-nowrap text-stone-600">{c.companySize || "—"}</span> },
    { key: "jobs", label: "Roles", className: "text-center", cell: (c) => <span className="tabular-nums text-stone-600">{jobCount(c)}</span> },
    { key: "registered", label: "Registered", cell: (c) => <span className="whitespace-nowrap text-stone-600">{formatDate(c.createdAt)}</span> },
    { key: "status", label: "Status", cell: (c) => <StatusBadge status={c.status} /> },
    { key: "actions", label: "", className: "text-right", cell: (c) => <Actions c={c} setDialog={setDialog} /> },
  ];

  const card = (c) => (
    <Card interactive className="p-4" onClick={() => setOpenId(c.id)}>
      <div className="flex items-start gap-3">
        <CompanyLogo company={c} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-ink">{c.companyName || c.name}</p>
          <p className="truncate text-[12.5px] text-stone-500">{c.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={c.status} />
            {c.industry && <Badge tone="neutral">{c.industry}</Badge>}
          </div>
        </div>
      </div>
      <p className="mt-3 text-[12.5px] text-stone-500">Registered {relativeTime(c.createdAt)} · {jobCount(c)} roles</p>
      <div className="mt-3 border-t border-[var(--line)] pt-3">
        <Actions c={c} full setDialog={setDialog} />
      </div>
    </Card>
  );

  const cfg = dialog ? ACTIONS[dialog.kind] : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Companies"
        title={<>Employer <em>accounts</em></>}
        subtitle={counts.pending ? `${counts.pending} ${counts.pending === 1 ? "company is" : "companies are"} waiting for a decision.` : "Every employer account on the platform."}
        actions={
          <button type="button" onClick={exportCsv} className="btn-secondary">
            <Download size={16} /> Export CSV
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={Building2} label="Companies" value={counts.all} hint={`${counts.active} active`} />
        <StatTile icon={ShieldX} label="Awaiting approval" value={counts.pending} hint={counts.pending ? "Needs review" : "All clear"} delay={60} />
        <StatTile icon={PauseCircle} label="Suspended" value={counts.suspended} delay={120} />
        <StatTile icon={Users} label="Roles posted" value={jobs.length} delay={180} />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Tabs value={tab} onChange={setTab} options={TABS.map((t) => ({ ...t, count: counts[t.value], alert: t.value === "pending" }))} />
        <SearchField value={query} onChange={setQuery} placeholder="Search company, owner or email" className="flex-1" />
        <SelectField
          label="Industry"
          value={industry}
          onChange={setIndustry}
          options={[{ value: "all", label: "All industries" }, ...industries.map((i) => ({ value: i, label: i }))]}
        />
      </div>

      <Reveal>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(c) => c.id}
          onRowClick={(c) => setOpenId(c.id)}
          renderCard={card}
          empty={
            <EmptyState
              icon={tab === "pending" ? CheckCircle2 : SearchX}
              title={tab === "pending" ? "No companies waiting" : "No companies match"}
              message={tab === "pending" ? "Every employer account has been reviewed." : "Try a different search, tab or industry."}
              action={
                query || industry !== "all" ? (
                  <button type="button" onClick={() => { setQuery(""); setIndustry("all"); }} className="btn-secondary">
                    Clear filters
                  </button>
                ) : null
              }
            />
          }
        />
      </Reveal>

      {open && (
        <Drawer
          title={open.companyName || open.name}
          subtitle={open.industry || "Company account"}
          accent={<CompanyLogo company={open} size={44} />}
          onClose={() => setOpenId(null)}
          footer={<Actions c={open} full setDialog={setDialog} />}
        >
          <div className="mb-4 flex items-center gap-2">
            <StatusBadge status={open.status} />
            {open.statusChangedAt && <span className="text-[12px] text-stone-500">Changed {relativeTime(open.statusChangedAt)}</span>}
          </div>
          {open.statusReason && (
            <p className="mb-4 rounded-xl bg-stone-50 p-3 text-[13px] leading-relaxed text-stone-600">
              <span className="font-semibold text-ink">Reason on file:</span> {open.statusReason}
            </p>
          )}
          <Field label="Owner">{open.name}</Field>
          <Field label="Email">
            <a href={`mailto:${open.email}`} className="link-brand inline-flex items-center gap-1.5">
              <Mail size={13} /> {open.email}
            </a>
          </Field>
          <Field label="Industry">{open.industry}</Field>
          <Field label="Team size">{open.companySize}</Field>
          <Field label="Website">
            {open.website ? (
              <a href={open.website} target="_blank" rel="noreferrer noopener" className="link-brand inline-flex items-center gap-1.5">
                <Globe size={13} /> {open.website} <ExternalLink size={12} />
              </a>
            ) : null}
          </Field>
          <Field label="About">{open.description}</Field>
          <Field label="Roles posted">{jobCount(open)}</Field>
          <Field label="Registered">{formatDate(open.createdAt, { day: "numeric", month: "long", year: "numeric" })}</Field>
        </Drawer>
      )}

      {dialog && cfg && (
        <ActionDialog
          title={cfg.title(dialog.company.companyName || dialog.company.name)}
          message={cfg.message}
          confirmLabel={cfg.confirm}
          tone={cfg.tone}
          requireReason={cfg.reason}
          busy={busy}
          onConfirm={(reason) => run(dialog.kind, dialog.company, reason)}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
