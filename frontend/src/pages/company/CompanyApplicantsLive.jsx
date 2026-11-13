import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight, Download, FileSearch, LayoutGrid, List, Loader2, SearchX, UserX, Users, WifiOff } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, Segmented, StatTile } from "@/components/app/primitives";
import { DataTable, SearchField, Tabs } from "@/components/admin/primitives";
import { Avatar } from "@/components/app/HeaderMenus";
import Reveal from "@/components/shared/Reveal";
import CompanyBlocked from "@/components/company/CompanyBlocked";
import StatusDialog from "@/components/applications/StatusDialog";
import { isBlocked } from "@/api/companyApi";
import { applicationsApi } from "@/api/applicationsApi";
import { jobsApi } from "@/api/jobsApi";
import { useDebounced } from "@/hooks/useDebounced";
import { useRemote } from "@/hooks/useRemote";
import { APPLICATION_STATUSES, LIMITS, ORDERINGS, canChangeStatus, statusLabel, statusTone } from "@/lib/applicationMap";
import { cvLabel, cvLabelTone, scoreText, scoreTone, validThreshold } from "@/lib/cvMap";
import { relativeTime, formatDate } from "@/lib/candidateStats";
import { EDUCATION_LEVELS } from "@/lib/jobMap";
import { saveBlob } from "@/lib/download";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/store/toastStore";
import { ROUTES } from "@/config/routes";

const selectCls = "h-11 cursor-pointer rounded-xl border border-[var(--line)] bg-white px-3 text-[13px] font-semibold text-stone-600 outline-none hover:border-stone-300 focus:border-brand";
const dateCls = "h-11 rounded-xl border border-[var(--line)] bg-white px-3 text-[13px] text-stone-600 outline-none hover:border-stone-300 focus:border-brand";

/** The CV match score, as a badge. Nothing is shown until Module 6 has scored the CV. */
function CvScore({ a }) {
  if (a.cvScore == null) return null;
  return <Badge tone={scoreTone(a.cvScore)}>{scoreText(a.cvScore)}% match</Badge>;
}

function BoardCard({ a, showJob }) {
  return (
    <Link to={`/company/candidates/${a.id}`} className="group block rounded-xl border border-[var(--line)] bg-white p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-sm">
      <div className="flex items-center gap-2.5">
        <Avatar name={a.name} size={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold text-ink">{a.name}</p>
          <p className="truncate text-[11.5px] text-stone-500">{showJob ? a.job?.title || "—" : a.institution}</p>
        </div>
        <CvScore a={a} />
      </div>
      <p className="mt-2 text-[11.5px] text-stone-400">{relativeTime(a.submittedAt)} · {a.reference}</p>
    </Link>
  );
}

/** One column of the board: the applications of one status (first 10, then "Show more"), under the same filters as the list. */
function BoardColumn({ status, filters, version }) {
  const [size, setSize] = useState(LIMITS.boardPage);
  const column = useRemote((o) => applicationsApi.list({ ...filters, status: status.value, pageSize: size }, o), [JSON.stringify(filters), status.value, size, version]);
  const items = column.data?.results || [];
  const total = column.data?.count ?? 0;
  return (
    <section className="flex min-w-0 flex-col rounded-2xl bg-stone-100/70 p-2.5" aria-label={status.label}>
      <header className="flex items-center justify-between px-1.5 pb-2.5">
        <h2 className="truncate text-[12.5px] font-semibold text-stone-600">{status.label}</h2>
        <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11.5px] font-semibold tabular-nums text-stone-500">{column.data ? total : "…"}</span>
      </header>
      <div className="flex flex-col gap-2">
        {column.status === "error" && <p role="alert" className="rounded-xl bg-red-50 p-2 text-[12px] text-red-700">{column.error.message} <button type="button" onClick={column.reload} className="font-semibold underline">Retry</button></p>}
        {items.map((a) => <BoardCard key={a.id} a={a} showJob={!filters.jobId} />)}
        {column.data && items.length === 0 && <p className="rounded-xl border border-dashed border-stone-300 px-2 py-6 text-center text-[12px] text-stone-400">Empty</p>}
        {total > items.length && size < LIMITS.boardMax && (
          <button type="button" onClick={() => setSize((n) => Math.min(LIMITS.boardMax, n + LIMITS.boardPage * 2))} disabled={column.status === "loading"} className="btn-secondary !h-9 text-[12.5px] disabled:opacity-50">
            Show more ({total - items.length})
          </button>
        )}
        {total > items.length && size >= LIMITS.boardMax && <p className="px-1 text-[11.5px] text-stone-500">{total - items.length} more: use the list view.</p>}
      </div>
    </section>
  );
}

/** The candidates of one role (/company/jobs/:id/candidates) or of the whole company (/company/candidates). */
export default function CompanyApplicantsLive() {
  const { id } = useParams();
  return <Applicants key={id || "all"} routeJobId={id || ""} />;
}

function Applicants({ routeJobId }) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canChange = canChangeStatus(user);
  const [jobId, setJobId] = useState(routeJobId);
  const [view, setView] = useState("board");
  const [tab, setTab] = useState("");
  const [query, setQuery] = useState("");
  const [education, setEducation] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [minScore, setMinScore] = useState("");
  const [ordering, setOrdering] = useState("-submitted_at");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const [moving, setMoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [version, setVersion] = useState(0);
  const search = useDebounced(query);

  const jobs = useRemote((o) => jobsApi.list({ status: "all", pageSize: 100 }, o), []);
  const counts = useRemote((o) => applicationsApi.counts({ jobId, signal: o.signal }), [jobId, version]);
  const scoreFilter = validThreshold(minScore) ? minScore : "";
  const filters = { jobId, educationLevel: education, submittedAfter: from, submittedBefore: to, search, minCvScore: scoreFilter, ordering };
  const list = useRemote((o) => (view === "list" ? applicationsApi.list({ ...filters, status: tab, page, pageSize: LIMITS.pageSize }, o) : Promise.resolve(null)), [view, JSON.stringify(filters), tab, page, version]);

  if (isBlocked(counts.error) || isBlocked(list.error)) return <CompanyBlocked onRetry={() => setVersion((v) => v + 1)} />;
  if (jobId && (counts.error?.status === 404 || list.error?.status === 404) && page === 1) {
    return <EmptyState icon={UserX} title="Role not found" message="This role may have been deleted." action={<Link to={ROUTES.COMPANY.JOBS} className="btn-primary">Back to roles</Link>} />;
  }

  const c = counts.data || {};
  const job = (jobs.data?.results || []).find((j) => j.id === jobId);
  const rows = list.data?.results || [];
  const pages = Math.max(1, Math.ceil((list.data?.count || 0) / LIMITS.pageSize));
  const filtered = Boolean(search || education || from || to || scoreFilter);
  const nothingYet = counts.data && !counts.error && c.total === 0 && !filtered;
  const refresh = () => setVersion((v) => v + 1);
  const reset = (setter) => (value) => {
    setter(value);
    setPage(1);
    setSelected([]);
  };

  const changeJob = (value) => {
    setJobId(value);
    setTab("");
    setPage(1);
    setSelected([]);
    navigate(value ? `/company/jobs/${value}/candidates` : ROUTES.COMPANY.CANDIDATES, { replace: true });
  };

  const exportJob = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const { blob, filename } = await applicationsApi.exportJob(jobId);
      saveBlob(blob, filename || "applications.csv");
      toast({ title: "Candidates exported", message: `Every application of ${job?.title || "this role"} was saved.` });
    } catch (error) {
      toast({ type: "error", title: "Couldn't export", message: error.message });
    } finally {
      setExporting(false);
    }
  };

  // One request per application (the server has no bulk call); each result is reported, the lists are re-read afterwards.
  const moveSelected = async (status, note) => {
    setBusy(true);
    let done = 0;
    const failures = [];
    for (const appId of selected) {
      try {
        await applicationsApi.changeStatus(appId, status, note);
        done += 1;
      } catch (error) {
        failures.push(error.message);
      }
    }
    setBusy(false);
    setMoving(false);
    setSelected([]);
    refresh();
    if (!failures.length) toast({ title: `${done} moved to ${statusLabel(status)}`, message: "Their history was updated." });
    else toast({ type: done ? "warning" : "error", title: done ? `${done} moved, ${failures.length} not` : "Nothing was moved", message: failures[0] });
  };

  const columns = [
    {
      key: "name",
      label: "Candidate",
      cell: (a) => (
        <div className="flex items-center gap-3">
          <Avatar name={a.name} size={36} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{a.name}</p>
            <p className="truncate text-[12.5px] text-stone-500">{a.email}</p>
          </div>
        </div>
      ),
    },
    ...(jobId ? [] : [{ key: "role", label: "Role", cell: (a) => <span className="truncate text-stone-600">{a.job?.title || "—"}</span> }]),
    { key: "education", label: "Education", cell: (a) => <span className="text-stone-600">{a.educationLabel}{a.institution ? ` · ${a.institution}` : ""}</span> },
    {
      key: "cv",
      label: "CV match",
      cell: (a) =>
        a.cvScore == null && !a.cvLabel ? (
          <span className="text-stone-400">—</span>
        ) : (
          <div className="flex min-w-0 flex-col items-start gap-1">
            {a.cvScore != null &&
              (a.job?.id ? (
                <Link
                  to={ROUTES.COMPANY.JOB_CV_ANALYSIS.replace(":id", a.job.id)}
                  onClick={(e) => e.stopPropagation()}
                  title="Open the CV analysis for this role"
                  className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                >
                  <Badge tone={scoreTone(a.cvScore)}>{scoreText(a.cvScore)}%</Badge>
                </Link>
              ) : (
                <Badge tone={scoreTone(a.cvScore)}>{scoreText(a.cvScore)}%</Badge>
              ))}
            {a.cvLabel && <span className="text-[11.5px] text-stone-500">{cvLabel(a.cvLabel)}</span>}
          </div>
        ),
    },
    { key: "status", label: "Status", cell: (a) => <Badge tone={statusTone(a.status)}>{statusLabel(a.status)}</Badge> },
    { key: "applied", label: "Applied", cell: (a) => <span className="whitespace-nowrap text-stone-600">{formatDate(a.submittedAt)}</span> },
    { key: "go", label: "", className: "text-right", cell: () => <ChevronRight size={16} className="ml-auto text-stone-300" /> },
  ];

  const card = (a) => (
    <Card interactive className="p-4">
      <Link to={`/company/candidates/${a.id}`} className="flex items-start gap-3">
        <Avatar name={a.name} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-ink">{a.name}</p>
          <p className="truncate text-[12.5px] text-stone-500">{a.job?.title || a.email}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone={statusTone(a.status)}>{statusLabel(a.status)}</Badge>
            <Badge tone="neutral">{a.educationLabel}</Badge>
            <CvScore a={a} />
            {a.cvLabel && <Badge tone={cvLabelTone(a.cvLabel)}>{cvLabel(a.cvLabel)}</Badge>}
          </div>
        </div>
      </Link>
    </Card>
  );

  if (nothingYet) {
    return (
      <div>
        <PageHeader eyebrow={job ? job.title : "Candidates"} title={<>Your <em>candidates</em></>} subtitle="Everyone who has applied to your roles." />
        <EmptyState icon={Users} title="No applicants yet" message="Share a role's application link and candidates will appear here." action={<div className="flex flex-wrap justify-center gap-2"><Link to={ROUTES.COMPANY.JOBS} className="btn-primary">Go to roles <ArrowRight size={15} className="btn-arrow" /></Link>{jobId && <Link to={ROUTES.COMPANY.JOB_CV_ANALYSIS.replace(":id", jobId)} className="btn-secondary"><FileSearch size={15} /> CV analysis</Link>}</div>} />
      </div>
    );
  }

  const tabOptions = [{ value: "", label: "All", count: c.total }, ...APPLICATION_STATUSES.map((s) => ({ value: s.value, label: s.label, count: c[s.value] }))];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={job ? job.title : "Candidates"}
        title={job ? <>Pipeline for <em>{job.title}</em></> : <>Your <em>candidates</em></>}
        subtitle={counts.data ? `${c.total} ${c.total === 1 ? "application" : "applications"} · ${c.submitted} awaiting first review` : "Loading…"}
        actions={
          <>
            {jobId && (
              <>
                <Link to={ROUTES.COMPANY.JOB_CV_ANALYSIS.replace(":id", jobId)} className="btn-secondary"><FileSearch size={16} /> CV analysis</Link>
                <button type="button" onClick={exportJob} disabled={exporting} className="btn-secondary disabled:opacity-50">
                  {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Export CSV
                </button>
              </>
            )}
            <Segmented ariaLabel="View" value={view} onChange={setView} options={[{ value: "board", label: "Board", icon: LayoutGrid }, { value: "list", label: "List", icon: List }]} />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={Users} label="Applicants" value={c.total ?? 0} />
        <StatTile icon={Users} label="Awaiting review" value={c.submitted ?? 0} delay={60} />
        <StatTile icon={Users} label="Shortlisted" value={c.shortlisted ?? 0} delay={120} />
        <StatTile icon={Users} label="Selected" value={c.selected ?? 0} delay={180} />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {view === "list" && <Tabs value={tab} onChange={reset(setTab)} options={tabOptions} />}
        <SearchField value={query} onChange={reset(setQuery)} placeholder="Search name, email or reference" className="flex-1" />
      </div>
      <div className="flex flex-wrap gap-2">
        <label>
          <span className="sr-only">Role</span>
          <select value={jobId} onChange={(e) => changeJob(e.target.value)} className={selectCls}>
            <option value="">All roles</option>
            {(jobs.data?.results || []).map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Education</span>
          <select value={education} onChange={(e) => reset(setEducation)(e.target.value)} className={selectCls}>
            <option value="">Any education</option>
            {EDUCATION_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-[12.5px] text-stone-500">Applied from <input type="date" aria-label="Applied from" value={from} max={to || undefined} onChange={(e) => reset(setFrom)(e.target.value)} className={dateCls} /></label>
        <label className="flex items-center gap-1.5 text-[12.5px] text-stone-500">to <input type="date" aria-label="Applied to" value={to} min={from || undefined} onChange={(e) => reset(setTo)(e.target.value)} className={dateCls} /></label>
        <label className="flex h-11 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-white px-3 text-[12.5px] text-stone-500">
          Min CV match
          <input type="number" min="0" max="100" step="1" aria-label="Minimum CV match" value={minScore} onChange={(e) => reset(setMinScore)(e.target.value)} className="w-12 border-0 bg-transparent p-0 text-right text-[13px] text-ink outline-none" />
          <span aria-hidden className="text-stone-400">%</span>
        </label>
        {view === "list" && (
          <label>
            <span className="sr-only">Order by</span>
            <select value={ordering} onChange={(e) => reset(setOrdering)(e.target.value)} className={selectCls}>
              {ORDERINGS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        )}
      </div>
      {from && to && from > to && <p role="alert" className="text-[12.5px] text-amber-700">The start date is after the end date, so nothing can match.</p>}

      {canChange && view === "list" && selected.length > 0 && (
        <div className="animate-fade-in-up flex flex-wrap items-center gap-2 rounded-2xl border border-brand/20 bg-brand-soft p-3 pl-4">
          <p className="mr-2 text-[13px] font-semibold text-ink">{selected.length} selected</p>
          <button type="button" disabled={selected.length > LIMITS.bulk} onClick={() => setMoving(true)} className="btn-secondary !h-9 !px-3.5 text-[12.5px] disabled:opacity-50">Change status…</button>
          {selected.length > LIMITS.bulk && <span className="text-[12.5px] text-amber-700">Select at most {LIMITS.bulk} at a time.</span>}
          <button type="button" onClick={() => setSelected([])} className="ml-auto text-[12.5px] font-semibold text-stone-500 hover:text-ink">Clear</button>
        </div>
      )}

      {(list.status === "error" && !isBlocked(list.error)) || (counts.status === "error" && !isBlocked(counts.error)) ? (
        <div role="alert" className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-[13.5px] text-red-800">
          <WifiOff size={16} />
          {list.error?.status === 404 && page > 1 ? (
            <>
              <span className="flex-1">That page no longer exists.</span>
              <button type="button" onClick={() => setPage(1)} className="btn-secondary !h-9">Go to page 1</button>
            </>
          ) : (
            <>
              <span className="flex-1">{(list.error || counts.error).message}</span>
              <button type="button" onClick={refresh} className="btn-secondary !h-9">Try again</button>
            </>
          )}
        </div>
      ) : null}

      {view === "board" ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          <div className="grid min-w-[1180px] grid-cols-7 gap-3">
            {APPLICATION_STATUSES.map((s) => <BoardColumn key={s.value} status={s} filters={filters} version={version} />)}
          </div>
        </div>
      ) : !list.data ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-brand" size={26} aria-label="Loading candidates" /></div>
      ) : (
        <Reveal>
          <div className={list.refreshing ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={list.refreshing}>
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(a) => a.id}
              onRowClick={(a) => navigate(`/company/candidates/${a.id}`)}
              {...(canChange ? {
                selected,
                onToggle: (rowId) => setSelected((s) => (s.includes(rowId) ? s.filter((x) => x !== rowId) : [...s, rowId])),
                onToggleAll: (on) => setSelected(on ? rows.map((a) => a.id) : []),
              } : {})}
              renderCard={card}
              empty={
                <EmptyState
                  icon={SearchX}
                  title="No candidates match"
                  message="Try a different status, role or search."
                  action={<button type="button" onClick={() => { setQuery(""); setEducation(""); setFrom(""); setTo(""); setMinScore(""); setTab(""); setPage(1); }} className="btn-secondary">Clear filters</button>}
                />
              }
            />
          </div>
        </Reveal>
      )}

      {view === "list" && pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => { setPage((p) => Math.max(1, p - 1)); setSelected([]); }} disabled={page <= 1} className="btn-secondary disabled:opacity-50"><ChevronLeft size={16} /> Previous</button>
          <span className="text-[13px] text-stone-500">Page {page} of {pages}</span>
          <button type="button" onClick={() => { setPage((p) => p + 1); setSelected([]); }} disabled={!list.data?.hasNext} className="btn-secondary disabled:opacity-50">Next <ChevronRight size={16} /></button>
        </nav>
      )}

      {moving && <StatusDialog title={`Change status of ${selected.length} ${selected.length === 1 ? "candidate" : "candidates"}`} count={selected.length} busy={busy} onConfirm={moveSelected} onClose={() => setMoving(false)} />}
    </div>
  );
}
