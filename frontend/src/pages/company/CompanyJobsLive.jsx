import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Briefcase, CalendarClock, Check, ChevronLeft, ChevronRight, Copy, CopyPlus, Eye, Loader2, MapPin, Pencil, Plus, RotateCcw, SearchX, Trash2, Users, WifiOff, XCircle } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader } from "@/components/app/primitives";
import { ActionDialog, SearchField, Tabs } from "@/components/admin/primitives";
import Reveal from "@/components/shared/Reveal";
import CompanyBlocked from "@/components/company/CompanyBlocked";
import ReopenDialog from "@/components/jobs/ReopenDialog";
import { isBlocked } from "@/api/companyApi";
import { jobsApi } from "@/api/jobsApi";
import { useDebounced } from "@/hooks/useDebounced";
import { useJobActions } from "@/hooks/useJobActions";
import { useRemote } from "@/hooks/useRemote";
import { EMPLOYMENT_TYPES, JOB_STATUS, canEditJobs, canManageJobs, employmentLabel, formatDeadline, workModeLabel } from "@/lib/jobMap";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/store/toastStore";
import { ROUTES } from "@/config/routes";

const PAGE_SIZE = 20;
const TABS = [
  { value: "open", label: "Open" },
  { value: "draft", label: "Drafts" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
];
const ORDERINGS = [
  { value: "-created_at", label: "Newest first" },
  { value: "deadline", label: "Deadline: soonest" },
  { value: "-applications_count", label: "Most applications" },
];
const selectCls = "h-11 cursor-pointer rounded-xl border border-[var(--line)] bg-white px-3 text-[13px] font-semibold text-stone-600 outline-none hover:border-stone-300 focus:border-brand";

/** Real-backend list of the company's roles: server-side tabs, search, filters, ordering and pages. */
export default function CompanyJobsLive() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canEdit = canEditJobs(user);
  const canManage = canManageJobs(user);
  const [tab, setTab] = useState("open");
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [type, setType] = useState("");
  const [ordering, setOrdering] = useState("-created_at");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState(null);
  const [reopening, setReopening] = useState(null);
  const [reopenError, setReopenError] = useState("");
  const [copied, setCopied] = useState(null);
  const search = useDebounced(query);

  const counts = useRemote((o) => jobsApi.counts(o), []);
  const departments = useRemote((o) => jobsApi.departments(o), []);
  const list = useRemote((o) => jobsApi.list({ status: tab, department, employmentType: type, search, ordering, page, pageSize: PAGE_SIZE }, o), [tab, department, type, search, ordering, page]);
  const refresh = () => {
    counts.reload();
    departments.reload();
    list.reload();
  };
  const actions = useJobActions({ onChanged: refresh });

  if (isBlocked(list.error) || isBlocked(counts.error)) return <CompanyBlocked onRetry={refresh} />;

  const c = counts.data || { open: 0, draft: 0, closed: 0, all: 0 };
  const rows = list.data?.results || [];
  const pages = Math.max(1, Math.ceil((list.data?.count || 0) / PAGE_SIZE));
  const loadingFirst = list.status === "loading" && !list.data;
  const filtered = Boolean(search || department || type);
  const reset = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  const copyLink = async (job) => {
    try {
      await navigator.clipboard.writeText(job.shareUrl);
      setCopied(job.id);
      setTimeout(() => setCopied(null), 1800);
      toast({ title: "Link copied", message: `Share it to collect applications for ${job.title}.` });
    } catch {
      toast({ type: "error", title: "Could not copy", message: "Open the role and copy the link from there." });
    }
  };

  const duplicate = async (job) => {
    const copy = await actions.duplicate(job);
    if (copy && !actions.isError(copy)) navigate(`/company/jobs/${copy.id}/edit`);
  };

  const confirmDelete = async () => {
    const result = await actions.remove(confirm);
    if (result) setConfirm(null);
  };

  const confirmReopen = async (deadline) => {
    setReopenError("");
    const result = await actions.reopen(reopening, deadline);
    if (result && actions.isError(result)) setReopenError(result.error.fieldErrors?.deadline?.[0] || result.error.message);
    else if (result) setReopening(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Roles"
        title={<>Your <em>roles</em></>}
        subtitle="Every role you post gets its own application link and form."
        actions={canEdit && <Link to={ROUTES.COMPANY.JOB_CREATE} className="btn-primary"><Plus size={16} /> Post a role</Link>}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Tabs value={tab} onChange={reset(setTab)} options={TABS.map((t) => ({ ...t, count: counts.data ? c[t.value] : undefined }))} />
        <SearchField value={query} onChange={reset(setQuery)} placeholder="Search by title" className="flex-1" />
      </div>
      <div className="flex flex-wrap gap-2">
        <label>
          <span className="sr-only">Department</span>
          <select value={department} onChange={(e) => reset(setDepartment)(e.target.value)} className={selectCls}>
            <option value="">All departments</option>
            {(departments.data || []).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Employment type</span>
          <select value={type} onChange={(e) => reset(setType)(e.target.value)} className={selectCls}>
            <option value="">All types</option>
            {EMPLOYMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Order by</span>
          <select value={ordering} onChange={(e) => reset(setOrdering)(e.target.value)} className={selectCls}>
            {ORDERINGS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>

      {list.status === "error" && (
        <div role="alert" className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-[13.5px] text-red-800">
          <WifiOff size={16} />
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

      {loadingFirst ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-brand" size={26} aria-label="Loading roles" /></div>
      ) : rows.length === 0 && list.status !== "error" ? (
        <EmptyState
          icon={filtered ? SearchX : Briefcase}
          title={filtered ? "No roles match" : tab === "all" ? "No roles yet" : `No ${tab === "draft" ? "draft" : tab} roles`}
          message={filtered ? "Try a different search or filter." : "Roles you post show up here."}
          action={filtered ? <button type="button" onClick={() => { setQuery(""); setDepartment(""); setType(""); setPage(1); }} className="btn-secondary">Clear filters</button> : canEdit && tab !== "closed" ? <Link to={ROUTES.COMPANY.JOB_CREATE} className="btn-primary">Post a role</Link> : null}
        />
      ) : (
        <div className={list.refreshing ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={list.refreshing}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {rows.map((j, i) => {
              const working = actions.busy.has(j.id);
              const status = JOB_STATUS[j.status] || { label: j.status, tone: "neutral" };
              return (
                <Reveal key={j.id} delay={Math.min(i, 5) * 40}>
                  <Card className="flex h-full flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[16px] font-semibold text-ink">{j.title}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-stone-500">
                          <span>{j.department}</span>
                          {j.employmentType && <><span className="text-stone-300">•</span><span>{employmentLabel(j.employmentType)}</span></>}
                          {(j.location || j.workMode) && <><span className="text-stone-300">•</span><span className="inline-flex items-center gap-1"><MapPin size={11} />{[j.location, workModeLabel(j.workMode)].filter(Boolean).join(" · ")}</span></>}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge tone={status.tone}>{status.label}</Badge>
                        {j.expired && <Badge tone="warning">Deadline passed</Badge>}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12.5px] text-stone-500">
                      <Link to={`/company/jobs/${j.id}/candidates`} className="inline-flex items-center gap-1.5 hover:text-brand"><Users size={13} /> {j.applicationsCount} {j.applicationsCount === 1 ? "application" : "applications"}</Link>
                      {j.status !== "draft" && j.deadline && (
                        <span className="inline-flex items-center gap-1.5"><CalendarClock size={13} /> {j.status === "open" && !j.expired ? `${j.daysLeft} ${j.daysLeft === 1 ? "day" : "days"} left · ` : ""}{formatDeadline(j.deadline)}</span>
                      )}
                    </div>

                    {j.expired && canEdit && (
                      <p className="mt-3 rounded-xl bg-amber-50 p-3 text-[12.5px] leading-relaxed text-amber-800">
                        The deadline passed, so this role no longer takes applications. Close it, then reopen it with a new deadline to keep going.
                      </p>
                    )}

                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                      <Link to={`/company/jobs/${j.id}/preview`} className="btn-secondary !h-9 !px-3 text-[12.5px]"><Eye size={14} /> Preview</Link>
                      {j.status === "open" && j.shareUrl && (
                        <button type="button" onClick={() => copyLink(j)} aria-label={`Copy application link for ${j.title}`} className="icon-btn flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] text-stone-500 hover:border-brand/40 hover:text-brand">
                          {copied === j.id ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                        </button>
                      )}
                      {canEdit && j.status !== "closed" && (
                        <Link to={`/company/jobs/${j.id}/edit`} className="btn-secondary !h-9 !px-3 text-[12.5px]"><Pencil size={14} /> Edit</Link>
                      )}
                      {canEdit && (
                        <button type="button" disabled={working} onClick={() => duplicate(j)} aria-label={`Duplicate ${j.title}`} className="icon-btn flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] text-stone-500 hover:border-brand/40 hover:text-brand disabled:opacity-50"><CopyPlus size={15} /></button>
                      )}
                      {canEdit && j.status === "draft" && (
                        <button type="button" disabled={working} onClick={() => actions.publish(j).then((r) => r && actions.isError(r) && r.error.status === 400 && navigate(`/company/jobs/${j.id}/edit`))} className="btn-primary !h-9 !px-3 text-[12.5px] disabled:opacity-50">
                          {working ? <Loader2 size={14} className="animate-spin" /> : null} Publish
                        </button>
                      )}
                      {canEdit && j.status === "open" && (
                        <button type="button" disabled={working} onClick={() => actions.close(j)} className="btn-secondary !h-9 !px-3 text-[12.5px] hover:!border-red-200 hover:!text-red-600 disabled:opacity-50"><XCircle size={14} /> Close</button>
                      )}
                      {canManage && j.status === "closed" && (
                        <button type="button" disabled={working} onClick={() => { setReopenError(""); setReopening(j); }} className="btn-secondary !h-9 !px-3 text-[12.5px] disabled:opacity-50"><RotateCcw size={14} /> Reopen</button>
                      )}
                      {canManage && j.status === "draft" && (
                        <button type="button" disabled={working} onClick={() => setConfirm(j)} aria-label={`Delete ${j.title}`} className="icon-btn flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] text-stone-400 hover:border-red-200 hover:text-red-600 disabled:opacity-50"><Trash2 size={15} /></button>
                      )}
                    </div>
                  </Card>
                </Reveal>
              );
            })}
          </div>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary disabled:opacity-50"><ChevronLeft size={16} /> Previous</button>
          <span className="text-[13px] text-stone-500">Page {page} of {pages}</span>
          <button type="button" onClick={() => setPage((p) => p + 1)} disabled={!list.data?.hasNext} className="btn-secondary disabled:opacity-50">Next <ChevronRight size={16} /></button>
        </nav>
      )}

      {confirm && (
        <ActionDialog
          title={`Delete ${confirm.title}?`}
          message="This draft is removed for good. Published roles can't be deleted, only closed."
          confirmLabel="Delete draft"
          tone="danger"
          busy={actions.busy.has(confirm.id)}
          onConfirm={confirmDelete}
          onClose={() => setConfirm(null)}
        />
      )}
      {reopening && (
        <ReopenDialog title={reopening.title} busy={actions.busy.has(reopening.id)} error={reopenError} onConfirm={confirmReopen} onClose={() => setReopening(null)} />
      )}
    </div>
  );
}
