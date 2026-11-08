import { useCallback, useState } from "react";
import { Building2, CheckCircle2, ChevronLeft, ChevronRight, Download, ExternalLink, Globe, Loader2, Mail, PauseCircle, SearchX, ShieldX, WifiOff } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, StatTile } from "@/components/app/primitives";
import { ActionDialog, DataTable, Drawer, Field, SearchField, Tabs } from "@/components/admin/primitives";
import { CompanyActions, CompanyLogo, StatusBadge } from "@/components/admin/companyParts";
import Reveal from "@/components/shared/Reveal";
import { platformCompaniesApi } from "@/api/platformCompaniesApi";
import { useDebounced } from "@/hooks/useDebounced";
import { useRemote } from "@/hooks/useRemote";
import { ACCOUNT_STATUS } from "@/lib/accountStatus";
import { formatDate, relativeTime } from "@/lib/candidateStats";
import { downloadFile, toCsv } from "@/lib/csv";
import { toast } from "@/store/toastStore";

const PAGE_SIZE = 20;
const TABS = [
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

// What each action sends and says. The server decides what is allowed; the reason rules mirror its (10+ characters).
const ACTIONS = {
  approve: { call: (id) => platformCompaniesApi.approve(id), title: (c) => `Approve ${c}?`, message: (c) => (c.status === "rejected" ? "This overturns the rejection. They will be able to sign in, post roles and review candidates, and we email them the good news." : "They will be able to sign in, post roles and review candidates."), confirm: "Approve company", reason: false, done: "approved", text: "They can now sign in and post roles." },
  reject: { call: (id, r) => platformCompaniesApi.reject(id, r), title: (c) => `Reject ${c}?`, message: "They will not be able to sign in. The reason is emailed to them so they can correct and re-submit.", confirm: "Reject company", reason: true, tone: "danger", done: "rejected", text: "They were told why." },
  suspend: { call: (id, r) => platformCompaniesApi.suspend(id, r), title: (c) => `Suspend ${c}?`, message: "Their team can no longer use the workspace until you reactivate it.", confirm: "Suspend company", reason: true, tone: "danger", done: "suspended", text: "Their workspace is blocked." },
  activate: { call: (id) => platformCompaniesApi.reactivate(id), title: (c) => `Reactivate ${c}?`, message: "They regain full access to their workspace.", confirm: "Reactivate", reason: false, done: "reactivated", text: "Access restored." },
};

const CONFLICT = {
  already_reviewed: "Another admin has already reviewed this company. The list was refreshed.",
  invalid_state: "This company is no longer in a state where that action applies. The list was refreshed.",
};

function Detail({ company }) {
  const detail = useRemote((o) => platformCompaniesApi.detail(company.id, o), [company.id]);
  const c = detail.data || company;
  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <StatusBadge status={c.status} />
        {c.statusChangedAt && <span className="text-[12px] text-stone-500">Reviewed {relativeTime(c.statusChangedAt)}{c.reviewedBy ? ` by ${c.reviewedBy}` : ""}</span>}
      </div>
      {detail.status === "error" && (
        <p role="alert" className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-[13px] text-red-700"><WifiOff size={14} /> {detail.error.message} <button type="button" onClick={detail.reload} className="ml-auto font-semibold underline">Retry</button></p>
      )}
      {c.statusReason && (
        <p className="mb-4 rounded-xl bg-stone-50 p-3 text-[13px] leading-relaxed text-stone-600"><span className="font-semibold text-ink">Reason on file:</span> {c.statusReason}</p>
      )}
      <Field label="Administrator">{c.name}</Field>
      <Field label="Administrator email">
        <a href={`mailto:${c.adminEmail || c.email}`} className="link-brand inline-flex items-center gap-1.5"><Mail size={13} /> {c.adminEmail || c.email}</a>
        {c.adminEmail && <span className="ml-2 text-[12px] text-stone-500">{c.adminEmailVerified ? "verified" : "not verified yet"}</span>}
      </Field>
      <Field label="Official email">{c.email}</Field>
      <Field label="Phone">{c.phone}</Field>
      <Field label="Industry">{c.industry}</Field>
      <Field label="Team size">{c.companySize}</Field>
      <Field label="Headquarters">{c.location}</Field>
      <Field label="Website">
        {c.website ? <a href={c.website} target="_blank" rel="noreferrer noopener" className="link-brand inline-flex items-center gap-1.5"><Globe size={13} /> {c.website} <ExternalLink size={12} /></a> : null}
      </Field>
      <Field label="About">{c.description}</Field>
      <Field label="Registered">{formatDate(c.createdAt, { day: "numeric", month: "long", year: "numeric" })}</Field>
    </>
  );
}

/** Real-backend company review: server-side tabs, search and pages; every decision is made by the server. */
export default function AdminCompaniesLive() {
  const [tab, setTab] = useState("pending");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [openCompany, setOpenCompany] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const search = useDebounced(query);

  const counts = useRemote((o) => platformCompaniesApi.counts(o), []);
  const list = useRemote((o) => platformCompaniesApi.list({ status: tab, search, page, pageSize: PAGE_SIZE }, o), [tab, search, page]);
  const c = counts.data || { pending: 0, active: 0, suspended: 0, rejected: 0, all: 0 };
  const rows = list.data?.results || [];
  const pages = Math.max(1, Math.ceil((list.data?.count || 0) / PAGE_SIZE));

  const changeTab = (value) => {
    setTab(value);
    setPage(1);
  };
  const changeQuery = (value) => {
    setQuery(value);
    setPage(1);
  };

  const refresh = useCallback(() => {
    counts.reload();
    list.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts.reload, list.reload]);

  const run = async (kind, company, reason) => {
    const cfg = ACTIONS[kind];
    setBusy(true);
    try {
      await cfg.call(company.id, reason);
      toast({ type: cfg.tone === "danger" ? "warning" : "success", title: `${company.companyName} ${cfg.done}`, message: cfg.text });
      setDialog(null);
      setOpenCompany(null);
      refresh();
    } catch (error) {
      if (error.status === 409) {
        toast({ type: "warning", title: "Nothing changed", message: CONFLICT[error.code] || error.message });
        setDialog(null);
        setOpenCompany(null);
        refresh();
      } else {
        // 400 (reason) stays in the dialog's toast so the admin can fix the text and try again.
        toast({ type: "error", title: "Action failed", message: error.fieldErrors?.reason?.[0] || error.message });
      }
    } finally {
      setBusy(false);
    }
  };

  // Every company in the current tab and search (not only the page on screen), straight from the server.
  const exportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const { results, truncated } = await platformCompaniesApi.listAll({ status: tab, search });
      const headers = ["Company", "Administrator", "Administrator email", "Official email", "Phone", "Industry", "Status", "Registered"];
      const data = results.map((co) => [
        co.companyName,
        co.name,
        co.adminEmail,
        co.email,
        co.phone,
        co.industry,
        ACCOUNT_STATUS[co.status]?.label || co.status,
        co.createdAt ? new Date(co.createdAt).toISOString().slice(0, 10) : "",
      ]);
      const name = `intellihire-companies-${tab}-${new Date().toISOString().slice(0, 10)}.csv`;
      downloadFile(name, toCsv(headers, data));
      toast(truncated
        ? { type: "warning", title: "Export is partial", message: `Only the first ${data.length.toLocaleString()} companies were saved to ${name}. Narrow the search to export the rest.` }
        : { title: "Companies exported", message: `${data.length} ${data.length === 1 ? "company" : "companies"} saved to ${name}.` });
    } catch (error) {
      toast({ type: "error", title: "Couldn't export", message: error.message });
    } finally {
      setExporting(false);
    }
  };

  const actions = (co, full) => <CompanyActions c={co} full={full} setDialog={setDialog} rejectedAction="approve" disabled={busy} />;

  const columns = [
    {
      key: "company",
      label: "Company",
      cell: (co) => (
        <div className="flex items-center gap-3">
          <CompanyLogo company={co} size={36} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{co.companyName}</p>
            <p className="truncate text-[12.5px] text-stone-500">{co.email}</p>
          </div>
        </div>
      ),
    },
    { key: "industry", label: "Industry", cell: (co) => <span className="text-stone-600">{co.industry || "—"}</span> },
    { key: "admin", label: "Administrator", cell: (co) => <span className="text-stone-600">{co.name || "—"}</span> },
    { key: "registered", label: "Registered", cell: (co) => <span className="whitespace-nowrap text-stone-600">{formatDate(co.createdAt)}</span> },
    { key: "status", label: "Status", cell: (co) => <StatusBadge status={co.status} /> },
    { key: "actions", label: "", className: "text-right", cell: (co) => actions(co, false) },
  ];

  const card = (co) => (
    <Card interactive className="p-4" onClick={() => setOpenCompany(co)}>
      <div className="flex items-start gap-3">
        <CompanyLogo company={co} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-ink">{co.companyName}</p>
          <p className="truncate text-[12.5px] text-stone-500">{co.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={co.status} />
            {co.industry && <Badge tone="neutral">{co.industry}</Badge>}
          </div>
        </div>
      </div>
      <p className="mt-3 text-[12.5px] text-stone-500">Registered {relativeTime(co.createdAt)}</p>
      <div className="mt-3 border-t border-[var(--line)] pt-3">{actions(co, true)}</div>
    </Card>
  );

  const cfg = dialog ? ACTIONS[dialog.kind] : null;
  const loadingFirst = list.status === "loading" && !list.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Companies"
        title={<>Employer <em>accounts</em></>}
        subtitle={c.pending ? `${c.pending} ${c.pending === 1 ? "company is" : "companies are"} waiting for a decision.` : "Every employer account on the platform."}
        actions={
          <button type="button" onClick={exportCsv} disabled={exporting} className="btn-secondary disabled:opacity-50">
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Export CSV
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={Building2} label="Companies" value={c.all} hint={`${c.active} active`} />
        <StatTile icon={ShieldX} label="Awaiting approval" value={c.pending} hint={c.pending ? "Needs review" : "All clear"} delay={60} />
        <StatTile icon={PauseCircle} label="Suspended" value={c.suspended} delay={120} />
        <StatTile icon={CheckCircle2} label="Rejected" value={c.rejected} delay={180} />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Tabs value={tab} onChange={changeTab} options={TABS.map((t) => ({ ...t, count: counts.data ? c[t.value] : undefined, alert: t.value === "pending" }))} />
        <SearchField value={query} onChange={changeQuery} placeholder="Search company name or email" className="flex-1" />
      </div>

      {list.status === "error" && (
        <div role="alert" className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-[13.5px] text-red-800">
          <WifiOff size={16} />
          {/* A page that no longer exists (the list shrank) is answered with 404: offer the first page. */}
          {list.error?.status === 404 && page > 1 ? (
            <>
              <span className="flex-1">That page no longer exists.</span>
              <button type="button" onClick={() => setPage(1)} className="btn-secondary !h-9">Go to page 1</button>
            </>
          ) : (
            <>
              <span className="flex-1">{list.error.message}</span>
              <button type="button" onClick={refresh} className="btn-secondary !h-9">Try again</button>
            </>
          )}
        </div>
      )}

      <Reveal>
        {loadingFirst ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-brand" size={26} aria-label="Loading companies" /></div>
        ) : (
          <div className={list.refreshing ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={list.refreshing}>
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(co) => co.id}
              onRowClick={(co) => setOpenCompany(co)}
              renderCard={card}
              empty={
                <EmptyState
                  icon={tab === "pending" && !search ? CheckCircle2 : SearchX}
                  title={tab === "pending" && !search ? "No companies waiting" : "No companies match"}
                  message={tab === "pending" && !search ? "Every employer account has been reviewed." : "Try a different search or tab."}
                  action={query ? <button type="button" onClick={() => changeQuery("")} className="btn-secondary">Clear search</button> : null}
                />
              }
            />
          </div>
        )}
      </Reveal>

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary disabled:opacity-50"><ChevronLeft size={16} /> Previous</button>
          <span className="text-[13px] text-stone-500">Page {page} of {pages}</span>
          <button type="button" onClick={() => setPage((p) => p + 1)} disabled={!list.data?.hasNext} className="btn-secondary disabled:opacity-50">Next <ChevronRight size={16} /></button>
        </nav>
      )}

      {openCompany && (
        <Drawer
          title={openCompany.companyName}
          subtitle={openCompany.industry || "Company account"}
          accent={<CompanyLogo company={openCompany} size={44} />}
          onClose={() => setOpenCompany(null)}
          footer={actions(openCompany, true)}
        >
          <Detail company={openCompany} />
        </Drawer>
      )}

      {dialog && cfg && (
        <ActionDialog
          title={cfg.title(dialog.company.companyName)}
          message={typeof cfg.message === "function" ? cfg.message(dialog.company) : cfg.message}
          confirmLabel={cfg.confirm}
          tone={cfg.tone}
          requireReason={cfg.reason}
          busy={busy}
          onConfirm={(reason) => run(dialog.kind, dialog.company, reason)}
          onClose={() => !busy && setDialog(null)}
        />
      )}
    </div>
  );
}
