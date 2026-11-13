import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, BarChart3, Check, Download, FileText, Loader2, RefreshCw, Search, Settings2, UserRound, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar } from "@/components/app/HeaderMenus";
import { Badge, Card, CardHeader, EmptyState, PageHeader, StatTile } from "@/components/app/primitives";
import { SearchField } from "@/components/admin/primitives";
import { evaluationApi } from "@/api/evaluationApi";
import { jobsApi } from "@/api/jobsApi";
import { useRemote } from "@/hooks/useRemote";
import { useAuthStore } from "@/store/authStore";
import { downloadFile, toCsv } from "@/lib/csv";
import { saveBlob } from "@/lib/download";
import { ROUTES } from "@/config/routes";

const WEIGHT_KEYS = ["weight_cv", "weight_screening", "weight_technical"];
const EMPTY_ROWS = [];
const WEIGHT_LABELS = { weight_cv: "CV match", weight_screening: "Screening", weight_technical: "Technical" };
const STATUS_OPTIONS = [["", "All statuses"], ["submitted", "Applied"], ["under_review", "Under review"], ["shortlisted", "Shortlisted"], ["interview", "Interview"], ["selected", "Selected"], ["on_hold", "On hold"], ["rejected", "Rejected"]];
const STAGE_OPTIONS = [["", "All stages"], ["cv", "CV scored"], ["screening", "Screening scored"], ["technical", "Technical scored"], ["complete", "All stages scored"]];
const titleCase = (value = "") => value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
const dateText = (value) => value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
const scoreText = (value) => value == null ? "—" : `${Math.round(Number(value))}`;
const canDecide = (role) => ["admin", "hr_manager", "recruiter"].includes(role);
const canEditWeights = (role) => ["admin", "hr_manager"].includes(role);

function ErrorMessage({ children, onRetry }) {
  if (!children) return null;
  return <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-700"><span>{children}</span>{onRetry && <button type="button" onClick={onRetry} className="font-semibold underline">Retry</button>}</div>;
}

function scoreCell(value) {
  return value == null ? <span className="text-stone-400">Missing</span> : <span className="font-semibold tabular-nums text-ink">{scoreText(value)}</span>;
}

function ReportState({ status }) {
  const tone = status === "ready" ? "success" : status === "failed" ? "danger" : status === "generating" ? "warning" : "neutral";
  return <Badge tone={tone}>{titleCase(status || "none")}</Badge>;
}

export default function CompanyEvaluation() {
  const user = useAuthStore((state) => state.user);
  const jobsRemote = useRemote((options) => jobsApi.list({ status: "all", pageSize: 100 }, options), []);
  const [jobId, setJobId] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [stage, setStage] = useState("");
  const [partial, setPartial] = useState("");
  const [minScore, setMinScore] = useState("");
  const [maxScore, setMaxScore] = useState("");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showWeights, setShowWeights] = useState(false);
  const [weightsDraft, setWeightsDraft] = useState(null);
  const [weightsError, setWeightsError] = useState("");
  const [weightsBusy, setWeightsBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [compareData, setCompareData] = useState(null);
  const [compareBusy, setCompareBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [dialogApplication, setDialogApplication] = useState(null);

  const jobs = useMemo(() => jobsRemote.data?.results || EMPTY_ROWS, [jobsRemote.data]);
  const selectedJobId = jobId || jobs[0]?.id || "";

  const weightsRemote = useRemote((options) => selectedJobId ? evaluationApi.weights(selectedJobId, options) : Promise.resolve(null), [selectedJobId]);
  const rankingRemote = useRemote((options) => selectedJobId ? evaluationApi.ranking(selectedJobId, {
    minScore, maxScore, status, stage, partial, page, signal: options.signal,
  }) : Promise.resolve({ count: 0, hasNext: false, hasPrevious: false, results: EMPTY_ROWS }), [selectedJobId, minScore, maxScore, status, stage, partial, page, refreshKey]);
  const weights = weightsDraft || weightsRemote.data;
  const rows = rankingRemote.data?.results || EMPTY_ROWS;
  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => !needle || `${row.full_name} ${row.email} ${row.reference}`.toLowerCase().includes(needle));
  }, [rows, query]);
  const count = rankingRemote.data?.count || 0;
  const weightsTotal = weights ? WEIGHT_KEYS.reduce((sum, key) => sum + Number(weights[key] || 0), 0) : 0;
  const eligibleToCompare = selectedIds.filter((id) => rows.some((row) => row.application_id === id));

  const refresh = () => {
    jobsRemote.reload();
    weightsRemote.reload();
    setRefreshKey((value) => value + 1);
  };

  useEffect(() => {
    if (!rows.some((row) => row.report_status === "generating")) return undefined;
    const timer = setInterval(() => setRefreshKey((value) => value + 1), 4000);
    return () => clearInterval(timer);
  }, [rows]);

  const changeFilter = (setter, value) => {
    setter(value);
    setPage(1);
  };

  const changeWeight = (key, value) => setWeightsDraft((current) => ({ ...(current || weightsRemote.data), [key]: value === "" ? "" : Number(value) }));
  const saveWeights = async () => {
    if (!weights || weightsTotal !== 100) return setWeightsError("The three stage weights must add up to 100%.");
    setWeightsBusy(true);
    setWeightsError("");
    try {
      await evaluationApi.updateWeights(selectedJobId, {
        weight_cv: Number(weights.weight_cv),
        weight_screening: Number(weights.weight_screening),
        weight_technical: Number(weights.weight_technical),
        missing_stage_policy: weights.missing_stage_policy,
      });
      setWeightsDraft(null);
      weightsRemote.reload();
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setWeightsError(error.fieldErrors?.weights?.[0] || error.message);
    } finally {
      setWeightsBusy(false);
    }
  };

  const toggleCompare = (applicationId) => {
    setSelectedIds((current) => current.includes(applicationId)
      ? current.filter((id) => id !== applicationId)
      : current.length < 4 ? [...current, applicationId] : current);
    setCompareData(null);
  };

  const compareSelected = async () => {
    if (eligibleToCompare.length < 2 || eligibleToCompare.length > 4) return;
    setCompareBusy(true);
    setActionError("");
    try {
      setCompareData(await evaluationApi.compare(selectedJobId, eligibleToCompare));
    } catch (error) {
      setActionError(error.message);
    } finally {
      setCompareBusy(false);
    }
  };

  const exportPage = () => {
    const headers = ["Rank", "Reference", "Candidate", "Email", "Status", "CV", "Screening", "Technical", "Composite", "Partial", "Missing stages", "Report", "Decision"];
    const data = filteredRows.map((row) => [row.rank, row.reference, row.full_name, row.email, row.status,
      row.cv_score ?? "", row.screening_score ?? "", row.technical_score ?? "", row.composite_score,
      row.is_partial ? "Yes" : "No", row.missing_stages.join("; "), row.report_status, row.decision || ""]);
    downloadFile(`evaluation-${selectedJobId}-page-${page}.csv`, toCsv(headers, data));
  };

  if (jobsRemote.status === "error" && !jobsRemote.data) return <div className="space-y-4"><PageHeader eyebrow="Hiring · Decision support" title={<>Candidate <em>evaluation</em></>} /><ErrorMessage onRetry={jobsRemote.reload}>{jobsRemote.error.message}</ErrorMessage></div>;
  if (jobsRemote.status === "loading" && !jobsRemote.data) return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-brand" size={25} aria-label="Loading evaluation roles" /></div>;

  const activeJob = jobs.find((job) => job.id === selectedJobId);
  if (!jobs.length) return <div><PageHeader eyebrow="Hiring · Decision support" title={<>Candidate <em>evaluation</em></>} /><EmptyState icon={BarChart3} title="No roles to evaluate" message="Create a role and receive applications before opening its evaluation workspace." action={<Link to={ROUTES.COMPANY.JOBS} className="btn-primary">Go to roles <ArrowRight size={15} /></Link>} /></div>;

  return <div className="space-y-6">
    <PageHeader eyebrow="Hiring · Decision support" title={<>Candidate <em>evaluation</em></>} subtitle="Review backend-calculated stage scores, compare candidates, and record permanent HR decisions." actions={<><button type="button" onClick={refresh} aria-label="Refresh evaluation" className="icon-btn flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] text-stone-500 hover:bg-stone-50"><RefreshCw size={16} /></button><button type="button" onClick={exportPage} disabled={!filteredRows.length} className="btn-secondary"><Download size={15} /> Export page</button></>} />

    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <label className="w-full max-w-md text-[12.5px] font-semibold text-stone-600">Role
        <select aria-label="Evaluation role" value={selectedJobId} onChange={(event) => { setJobId(event.target.value); setPage(1); setSelectedIds([]); setCompareData(null); setWeightsDraft(null); setWeightsError(""); }} className="field mt-1.5 !h-11">
          {jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
        </select>
      </label>
      {activeJob && <p className="text-[12px] text-stone-500">Evaluation weights and ranking apply to {activeJob.title}.</p>}
    </div>

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile icon={UserRound} label="Ranked candidates" value={count} />
      <StatTile icon={BarChart3} label="Average composite" value={rows.length ? Math.round(rows.reduce((sum, row) => sum + Number(row.composite_score), 0) / rows.length) : "—"} suffix={rows.length ? "/100" : ""} hint="Current page" />
      <StatTile icon={AlertTriangle} label="Partial evaluations" value={rows.filter((row) => row.is_partial).length} hint="On this page" />
      <StatTile icon={FileText} label="Reports ready" value={rows.filter((row) => row.report_status === "ready").length} hint="On this page" />
    </div>

    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><CardHeader icon={Settings2} title="Scoring policy" subtitle="Weights and missing-stage handling configured by the server." /><button type="button" onClick={() => setShowWeights((value) => !value)} aria-expanded={showWeights} className="btn-secondary !h-9"><Settings2 size={14} /> {showWeights ? "Hide settings" : "Manage weights"}</button></div>
      {weightsRemote.status === "error" && !weightsRemote.data && <ErrorMessage onRetry={weightsRemote.reload}>{weightsRemote.error.message}</ErrorMessage>}
      {weights && <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] text-stone-600">{WEIGHT_KEYS.map((key) => <span key={key}>{WEIGHT_LABELS[key]} <strong className="text-ink">{weights[key]}%</strong></span>)}<span>Missing stage: <strong className="text-ink">{weights.missing_stage_policy === "zero" ? "count as zero" : "rescale available scores"}</strong></span></div>}
      {showWeights && weights && <div className="mt-4 border-t border-[var(--line)] pt-4">
        <div className="grid gap-4 sm:grid-cols-3">{WEIGHT_KEYS.map((key) => <label key={key} className="text-[12.5px] font-medium text-stone-600">{WEIGHT_LABELS[key]} weight<input aria-label={`${WEIGHT_LABELS[key]} weight`} type="number" min="0" max="100" value={weights[key]} disabled={!canEditWeights(user?.memberRole)} onChange={(event) => changeWeight(key, event.target.value)} className="field mt-1 !h-10" /></label>)}</div>
        <label className="mt-3 block max-w-md text-[12.5px] font-medium text-stone-600">When a score is missing<select aria-label="Missing stage policy" value={weights.missing_stage_policy} disabled={!canEditWeights(user?.memberRole)} onChange={(event) => setWeightsDraft((current) => ({ ...(current || weights), missing_stage_policy: event.target.value }))} className="field mt-1 !h-10"><option value="renormalise">Ignore missing stages and rescale</option><option value="zero">Treat missing stages as zero</option></select></label>
        {!canEditWeights(user?.memberRole) ? <p className="mt-3 text-[12px] text-stone-500">Only company admins and HR managers can change weights.</p> : <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className={`text-[12px] ${weightsTotal === 100 ? "text-stone-500" : "text-amber-700"}`}>Weights total {weightsTotal}%. They must total exactly 100%.</p><button type="button" onClick={saveWeights} disabled={weightsBusy || weightsTotal !== 100 || !weightsDraft} className="btn-primary !h-9 disabled:opacity-50">{weightsBusy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save scoring policy</button></div>}
        <ErrorMessage>{weightsError}</ErrorMessage>
      </div>}
    </Card>

    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[var(--line)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><h2 className="text-[15px] font-semibold text-ink">Ranked candidates</h2><p className="mt-1 text-[12px] text-stone-500">Composite scores and ranks are calculated by the evaluation API.</p></div><div className="flex items-center gap-2"><Search size={15} className="text-stone-400" /><SearchField value={query} onChange={setQuery} placeholder="Search this page" className="w-full sm:w-56" /></div></div>
      <div className="grid gap-2 border-b border-[var(--line)] p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-[11.5px] font-medium text-stone-500">Minimum score<input aria-label="Minimum score" type="number" min="0" max="100" value={minScore} onChange={(event) => changeFilter(setMinScore, event.target.value)} className="field mt-1 !h-9" /></label>
        <label className="text-[11.5px] font-medium text-stone-500">Maximum score<input aria-label="Maximum score" type="number" min="0" max="100" value={maxScore} onChange={(event) => changeFilter(setMaxScore, event.target.value)} className="field mt-1 !h-9" /></label>
        <select aria-label="Filter by application status" value={status} onChange={(event) => changeFilter(setStatus, event.target.value)} className="field !h-9 self-end">{STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select aria-label="Filter by scored stage" value={stage} onChange={(event) => changeFilter(setStage, event.target.value)} className="field !h-9 self-end">{STAGE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select aria-label="Filter by partial evaluation" value={partial} onChange={(event) => changeFilter(setPartial, event.target.value)} className="field !h-9 self-end"><option value="">Complete and partial</option><option value="true">Partial only</option><option value="false">Complete only</option></select>
      </div>
      <ErrorMessage onRetry={rankingRemote.reload}>{rankingRemote.error?.message}</ErrorMessage>
      {rankingRemote.status === "loading" && !rankingRemote.data ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-brand" size={22} aria-label="Loading ranking" /></div> : !filteredRows.length ? <div className="p-6"><EmptyState icon={UserRound} title="No ranked candidates" message={query ? "No candidate on this page matches that search." : "Candidates appear when at least one evaluation stage has a score."} /></div> : <div className="overflow-x-auto"><table className="w-full min-w-[1060px] text-left"><thead className="bg-stone-50 text-[10px] uppercase text-stone-500"><tr>{["Compare", "Rank / candidate", "CV", "Screening", "Technical", "Composite", "Evidence", "Report", "Decision"].map((heading) => <th key={heading} className="px-3 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody className="divide-y divide-[var(--line)]">{filteredRows.map((row) => <tr key={row.application_id} className="hover:bg-stone-50/70"><td className="px-3 py-3"><input type="checkbox" aria-label={`Compare ${row.full_name}`} checked={selectedIds.includes(row.application_id)} onChange={() => toggleCompare(row.application_id)} disabled={!selectedIds.includes(row.application_id) && selectedIds.length >= 4} className="accent-[#F04E23]" /></td><td className="px-3 py-3"><button type="button" onClick={() => setDialogApplication(row)} className="flex items-center gap-2 text-left"><span className="text-[11px] text-stone-400">#{row.rank}</span><Avatar name={row.full_name} size={32} /><span><span className="block text-[12.5px] font-semibold text-ink">{row.full_name}</span><span className="block text-[11px] text-stone-500">{row.reference} · {row.email}</span></span></button></td><td className="px-3 py-3 text-[12.5px]">{scoreCell(row.cv_score)}</td><td className="px-3 py-3 text-[12.5px]">{scoreCell(row.screening_score)}</td><td className="px-3 py-3 text-[12.5px]">{scoreCell(row.technical_score)}</td><td className="px-3 py-3 text-[13px] font-semibold tabular-nums text-ink">{scoreText(row.composite_score)}</td><td className="px-3 py-3">{row.is_partial ? <Badge tone="warning">{row.missing_stages.length} missing</Badge> : <Badge tone="success">Complete</Badge>}</td><td className="px-3 py-3"><ReportState status={row.report_status} /></td><td className="px-3 py-3 text-[12px] text-stone-600">{row.decision ? titleCase(row.decision) : "No decision"}</td></tr>)}</tbody></table></div>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-3"><div className="flex flex-wrap items-center gap-2"><span className="text-[11.5px] text-stone-500">{eligibleToCompare.length}/4 selected</span><button type="button" onClick={compareSelected} disabled={eligibleToCompare.length < 2 || compareBusy} className="btn-secondary !h-8 !px-3 text-[11.5px]">{compareBusy ? <Loader2 size={13} className="animate-spin" /> : null} Compare selected</button><button type="button" onClick={() => { setSelectedIds([]); setCompareData(null); }} disabled={!selectedIds.length} className="btn-secondary !h-8 !px-3 text-[11.5px]">Clear</button></div><div className="flex items-center gap-2"><span className="text-[11.5px] text-stone-500">{count} total</span><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={!rankingRemote.data?.hasPrevious || rankingRemote.status === "loading"} aria-label="Previous ranking page" className="icon-btn h-8 w-8 disabled:opacity-40"><ArrowLeft size={15} /></button><span className="text-[11px] text-stone-500">Page {page}</span><button type="button" onClick={() => setPage((value) => value + 1)} disabled={!rankingRemote.data?.hasNext || rankingRemote.status === "loading"} aria-label="Next ranking page" className="icon-btn h-8 w-8 disabled:opacity-40"><ArrowRight size={15} /></button></div></div>
    </Card>

    {actionError && <ErrorMessage>{actionError}</ErrorMessage>}
    {compareData && <Card className="overflow-x-auto p-5"><div className="flex items-center justify-between"><CardHeader title="Candidate comparison" subtitle="Side-by-side API comparison" /><button type="button" aria-label="Close comparison" onClick={() => setCompareData(null)} className="icon-btn"><X size={16} /></button></div><table className="mt-4 min-w-full text-left text-[12px]"><thead><tr><th className="py-2 pr-4 text-stone-400">Measure</th>{compareData.applications.map((item) => <th key={item.application_id} className="px-3 py-2 font-semibold text-ink">{item.full_name}</th>)}</tr></thead><tbody className="divide-y divide-[var(--line)]">{[{ label: "Composite", get: (item) => item.scores?.composite }, { label: "CV", get: (item) => item.scores?.cv }, { label: "Screening", get: (item) => item.scores?.screening }, { label: "Technical", get: (item) => item.scores?.technical }, { label: "Missing stages", get: (item) => item.missing_stages.join(", ") || "None" }, { label: "Recommendation", get: (item) => item.recommendation || "Not available" }].map((measure) => <tr key={measure.label}><th className="py-2 pr-4 font-medium text-stone-500">{measure.label}</th>{compareData.applications.map((item) => <td key={item.application_id} className="px-3 py-2 text-stone-700">{measure.get(item) ?? "—"}</td>)}</tr>)}</tbody></table></Card>}

    {dialogApplication && <EvaluationReviewDialog key={dialogApplication.application_id} row={dialogApplication} userRole={user?.memberRole} onClose={() => setDialogApplication(null)} onChanged={() => setRefreshKey((value) => value + 1)} />}
  </div>;
}

function EvaluationReviewDialog({ row, userRole, onClose, onChanged }) {
  const remote = useRemote((options) => evaluationApi.detail(row.application_id, options), [row.application_id]);
  const reloadRef = useRef(remote.reload);
  const [decision, setDecision] = useState("selected");
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [decisionNotice, setDecisionNotice] = useState("");
  const detail = remote.data;
  const reportStatus = detail?.report_status || row.report_status;

  useEffect(() => {
    reloadRef.current = remote.reload;
  });

  useEffect(() => {
    if (reportStatus !== "generating") return undefined;
    const timer = setInterval(() => reloadRef.current(), 3500);
    return () => clearInterval(timer);
  }, [reportStatus]);

  const makeDecision = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await evaluationApi.decide(row.application_id, { decision, note: note.trim(), notify });
      setNote("");
      const openings = result.hint?.filled ? " This role's listed openings are now filled." : "";
      setDecisionNotice(`Decision recorded. Application status is now ${titleCase(result.status)}. This history is permanent.${openings}`);
      remote.reload();
      onChanged();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      await evaluationApi.generateReport(row.application_id);
      remote.reload();
      onChanged();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    setBusy(true);
    setError("");
    try {
      const file = await evaluationApi.downloadPdf(row.application_id);
      saveBlob(file.blob, file.filename || `evaluation-${row.reference}.pdf`);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  };

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/40 p-3 sm:p-5" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section role="dialog" aria-modal="true" aria-label={`${row.full_name} evaluation detail`} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-5 shadow-2xl sm:p-6">
      <header className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><Avatar name={row.full_name} size={42} /><div><h2 className="text-[16px] font-semibold text-ink">{row.full_name}</h2><p className="text-[12px] text-stone-500">{row.reference} · application status {titleCase(row.status)}</p></div></div><button type="button" aria-label="Close evaluation detail" onClick={onClose} className="icon-btn h-9 w-9"><X size={17} /></button></header>
      {remote.status === "loading" && !detail ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-brand" size={22} aria-label="Loading candidate evaluation" /></div> : remote.error && !detail ? <ErrorMessage onRetry={remote.reload}>{remote.error.message}</ErrorMessage> : detail ? <>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">{[["CV", detail.scores.cv], ["Screening", detail.scores.screening], ["Technical", detail.scores.technical], ["Composite", detail.scores.composite]].map(([label, value]) => <div key={label} className="rounded-lg border border-[var(--line)] p-3"><p className="text-[11px] text-stone-500">{label}</p><p className="mt-1 text-[20px] font-semibold tabular-nums text-ink">{scoreText(value)}{value != null && <span className="text-[11px] font-normal text-stone-400">/100</span>}</p></div>)}</div>
        {detail.is_partial && <p role="status" className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-800"><AlertTriangle size={15} />Partial evaluation. Missing: {detail.missing_stages.join(", ") || "stage data"}. Composite follows the saved missing-stage policy.</p>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="text-[12px] text-stone-500">Report</span><ReportState status={detail.report_status} /></div><div className="flex flex-wrap gap-2">{detail.report_status !== "generating" && detail.report_status !== "ready" && canDecide(userRole) && <button type="button" onClick={generate} disabled={busy || ![detail.scores.cv, detail.scores.screening, detail.scores.technical].some((value) => value != null)} className="btn-secondary !h-9">{busy ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} {detail.report_status === "failed" ? "Retry report" : "Generate report"}</button>}{detail.report_status === "ready" && <button type="button" onClick={download} disabled={busy} className="btn-secondary !h-9"><Download size={14} /> Download PDF</button>}</div></div>
        {detail.report_status === "generating" && <p role="status" className="mt-3 text-[12.5px] text-stone-500">Report generation is running. This view will refresh automatically.</p>}
        {detail.report_status === "ready" ? <div className="mt-3 rounded-lg bg-stone-50 p-4"><p className="text-[13px] leading-relaxed text-stone-700">{detail.report.summary}</p>{["strengths", "weaknesses"].map((key) => detail.report[key]?.length > 0 && <div key={key} className="mt-3"><h3 className="text-[12px] font-semibold text-ink">{titleCase(key)}</h3><ul className="mt-1 list-inside list-disc text-[12.5px] text-stone-600">{detail.report[key].map((item, index) => <li key={`${key}-${index}`}>{item}</li>)}</ul></div>)}{detail.report.stage_summaries && <div className="mt-3"><h3 className="text-[12px] font-semibold text-ink">Stage summaries</h3><dl className="mt-1 space-y-1 text-[12.5px] text-stone-600">{Object.entries(detail.report.stage_summaries).filter(([, text]) => text).map(([key, text]) => <div key={key}><dt className="inline font-medium text-stone-700">{titleCase(key)}: </dt><dd className="inline">{text}</dd></div>)}</dl></div>}{detail.report.recommendation && <p className="mt-3 text-[12.5px] font-semibold text-ink">AI recommendation: {titleCase(detail.report.recommendation)}</p>}</div> : <p className="mt-3 text-[12px] text-stone-500">{detail.report_status === "failed" ? "Report generation failed. You can retry." : "No generated report is available yet."}</p>}
        {detail.report?.ai_disclaimer || detail.ai_disclaimer ? <p className="mt-3 text-[11px] leading-relaxed text-stone-400">{detail.report.ai_disclaimer || detail.ai_disclaimer}</p> : null}
        <section className="mt-5 border-t border-[var(--line)] pt-4"><h3 className="text-[13.5px] font-semibold text-ink">Decision history</h3>{detail.decisions.length ? <ol className="mt-3 space-y-2">{detail.decisions.map((item) => <li key={item.id} className="rounded-lg bg-stone-50 p-3"><div className="flex flex-wrap justify-between gap-2"><span className="text-[12.5px] font-semibold text-ink">{titleCase(item.decision)} · {item.decided_by.full_name}</span><span className="text-[11px] text-stone-500">{dateText(item.decided_at)}</span></div><p className="mt-1 whitespace-pre-wrap text-[12px] text-stone-600">{item.note || "No rationale provided."}</p>{item.overrode_ai && <p className="mt-1 text-[11px] text-amber-700">Decision differs from AI recommendation ({titleCase(item.ai_recommendation)}).</p>}</li>)}</ol> : <p className="mt-2 text-[12px] text-stone-500">No HR decision recorded.</p>}</section>
        {canDecide(userRole) && <form onSubmit={makeDecision} className="mt-4 border-t border-[var(--line)] pt-4"><h3 className="text-[13.5px] font-semibold text-ink">Record a decision</h3><div className="mt-3 grid gap-3 sm:grid-cols-[190px_minmax(0,1fr)]"><label className="text-[12px] font-medium text-stone-600">Outcome<select value={decision} onChange={(event) => setDecision(event.target.value)} className="field mt-1 !h-10"><option value="selected">Select</option><option value="rejected">Reject</option><option value="on_hold">Hold</option></select></label><label className="text-[12px] font-medium text-stone-600">Rationale<textarea rows={2} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} className="field mt-1 !h-auto resize-y py-2.5" placeholder="Document the evidence behind the decision" /></label></div><label className="mt-3 flex items-center gap-2 text-[12px] text-stone-600"><input type="checkbox" checked={notify} onChange={(event) => setNotify(event.target.checked)} className="accent-[#F04E23]" />Notify the candidate by email and account notification</label><div className="mt-3 flex justify-end"><button type="submit" disabled={busy || !note.trim()} className="btn-primary !h-9 disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Record decision</button></div></form>}
        {decisionNotice && <p role="status" className="mt-3 text-[12px] text-emerald-700">{decisionNotice}</p>}
        {!canDecide(userRole) && <p className="mt-4 text-[12px] text-stone-500">Your role has read-only access to HR decisions.</p>}
        <p className="mt-4 text-[11px] text-stone-400">Submitted {dateText(row.submitted_at)} · {row.is_partial ? "Partial evaluation" : "All stages scored"}</p>
      </> : null}
      <ErrorMessage>{error || remote.error?.message}</ErrorMessage>
      <div className="mt-4 flex justify-end"><button type="button" onClick={onClose} className="btn-secondary !h-9">Close</button></div>
    </section>
  </div>;
}
