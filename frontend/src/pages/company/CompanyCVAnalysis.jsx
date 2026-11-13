import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Check, ChevronLeft, ChevronRight, CircleHelp, FileSearch, Loader2, Play, RefreshCw, SlidersHorizontal, Sparkles, Users } from "lucide-react";
import { ActionDialog, Drawer } from "@/components/admin/primitives";
import { Avatar } from "@/components/app/HeaderMenus";
import { Badge, Card, CardHeader, EmptyState, PageHeader, ProgressBar, Segmented, StatTile, Toggle } from "@/components/app/primitives";
import CompanyBlocked from "@/components/company/CompanyBlocked";
import {
  AiExplanation,
  AnalysisStateBadge,
  ErrorPanel,
  InlineError,
  Loading,
  ParsedCv,
  ParsedEntries,
  ReviewFlags,
  ScoreBreakdown,
  ScoreSummary,
  SkillChips,
  StaleWarning,
} from "@/components/company/cvAnalysisParts";
import { cvAnalysisApi } from "@/api/cvAnalysisApi";
import { isBlocked } from "@/api/companyApi";
import { jobsApi } from "@/api/jobsApi";
import { useRemote } from "@/hooks/useRemote";
import { formatDate } from "@/lib/candidateStats";
import { statusLabel, statusTone } from "@/lib/applicationMap";
import {
  ANALYSIS_STATES,
  RUN_MODES,
  WEIGHT_FIELDS,
  canManageScreening,
  canRunScreening,
  cvLabel,
  cvLabelTone,
  runMode,
  scoreText,
  scoreTone,
  validThreshold,
  weightValues,
  weightsError,
  weightsTotal,
} from "@/lib/cvMap";
import { USE_MOCK_API } from "@/config/env";
import { ROUTES } from "@/config/routes";
import { useAuthStore } from "@/store/authStore";
import { useCompanyActions, useCompanyRecord } from "@/store/companyStore";
import { toast } from "@/store/toastStore";

const FILTER_STATUSES = [
  ["", "All application stages"], ["submitted", "Applied"], ["under_review", "Under review"],
  ["shortlisted", "Shortlisted"], ["interview", "Interview"], ["selected", "Selected"],
  ["on_hold", "On hold"], ["rejected", "Rejected"],
];
/** How often the progress endpoint is asked again while a run is working. */
const POLL_MS = 4000;
/** An analysis in one of these states can be asked for again. */
const RETRYABLE = ["failed", "manual_review"];

export default function CompanyCVAnalysis() {
  const { id: jobId } = useParams();
  return USE_MOCK_API ? <DemoWorkspace key={jobId} jobId={jobId} /> : <LiveWorkspace key={jobId} jobId={jobId} />;
}

function LiveWorkspace({ jobId }) {
  const user = useAuthStore((state) => state.user);
  const job = useRemote((options) => jobsApi.get(jobId, options), [jobId]);
  const configRemote = useRemote((options) => cvAnalysisApi.config(jobId, options), [jobId]);
  const progress = useRemote((options) => cvAnalysisApi.progress(jobId, options), [jobId]);
  const [status, setStatus] = useState("");
  const [analysisStatus, setAnalysisStatus] = useState("");
  const [minScore, setMinScore] = useState("");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const ranking = useRemote(
    (options) => cvAnalysisApi.ranking(jobId, { status, analysisStatus, minScore, page, pageSize: 20, ...options }),
    [jobId, status, analysisStatus, minScore, page, refreshKey],
  );
  const [selected, setSelected] = useState(null);
  const [threshold, setThreshold] = useState(null);
  const [configSaved, setConfigSaved] = useState(null);
  const [thresholdBusy, setThresholdBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [confirmApply, setConfirmApply] = useState(false);
  const [actionError, setActionError] = useState("");
  const [mode, setMode] = useState("missing");
  const [confirmRun, setConfirmRun] = useState("");
  const [runBusy, setRunBusy] = useState(false);
  const [runError, setRunError] = useState("");
  const [retrying, setRetrying] = useState("");

  const manager = canManageScreening(user);
  const runner = canRunScreening(user);
  const config = configSaved || configRemote.data;
  const thresholdValue = threshold ?? String(config?.shortlist_threshold ?? 70);
  const rows = ranking.data?.results || [];
  const progressData = progress.data;
  const working = Boolean(progressData?.in_progress);

  const refreshAll = () => {
    job.reload();
    configRemote.reload();
    progress.reload();
    setRefreshKey((value) => value + 1);
  };

  // While the server says a run is working, ask it again every few seconds. When it stops,
  // re-read the ranking once, because the scores have just changed.
  const wasWorking = useRef(false);
  useEffect(() => {
    if (wasWorking.current && !working) setRefreshKey((value) => value + 1);
    wasWorking.current = working;
    if (!working) return undefined;
    const timer = setInterval(() => progress.reload(), POLL_MS);
    return () => clearInterval(timer);
    // `progress.reload` is stable enough for this: it only bumps an internal counter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [working]);

  if (isBlocked(job.error) || isBlocked(configRemote.error) || isBlocked(progress.error) || isBlocked(ranking.error)) {
    return <CompanyBlocked onRetry={refreshAll} />;
  }
  if (job.error?.status === 404) {
    return <EmptyState icon={FileSearch} title="Role not found" message="This role may have been removed or may belong to another company." action={<Link to={ROUTES.COMPANY.JOBS} className="btn-primary">Back to roles</Link>} />;
  }
  if (job.status === "error" && !job.data) {
    return <ErrorPanel message={job.error.message} onRetry={job.reload} />;
  }
  if (!job.data) return <Loading label="Loading the CV analysis workspace" />;

  const saveThreshold = async () => {
    if (!validThreshold(thresholdValue)) return setActionError("Enter a whole-number threshold from 0 to 100.");
    const value = Number(thresholdValue);
    setThresholdBusy(true);
    setActionError("");
    try {
      const updated = await cvAnalysisApi.updateConfig(jobId, { shortlist_threshold: value });
      setConfigSaved(updated);
      configRemote.reload();
      toast({ title: "Threshold saved", message: `CV shortlist threshold is now ${value}%.` });
    } catch (error) {
      setActionError(error.message);
    } finally {
      setThresholdBusy(false);
    }
  };

  const previewThreshold = async () => {
    if (!validThreshold(thresholdValue)) return setActionError("Enter a whole-number threshold from 0 to 100.");
    const value = Number(thresholdValue);
    setThresholdBusy(true);
    setActionError("");
    setPreview(null);
    try {
      setPreview(await cvAnalysisApi.previewThreshold(jobId, value));
    } catch (error) {
      setActionError(error.message);
    } finally {
      setThresholdBusy(false);
    }
  };

  const applyThreshold = async () => {
    setThresholdBusy(true);
    setActionError("");
    try {
      const result = await cvAnalysisApi.applyThreshold(jobId, Number(thresholdValue));
      setConfigSaved(null);
      setThreshold(String(result.threshold));
      setConfirmApply(false);
      setPreview(null);
      refreshAll();
      toast({ title: "Shortlist updated", message: `${result.shortlisted} ${result.shortlisted === 1 ? "candidate was" : "candidates were"} shortlisted.` });
    } catch (error) {
      setActionError(error.message);
      setConfirmApply(false);
    } finally {
      setThresholdBusy(false);
    }
  };

  /** "Begin CV screening" (guide §6.3). The mode decides how much AI work it costs. */
  const startRun = async (chosen) => {
    setRunBusy(true);
    setRunError("");
    try {
      const result = await cvAnalysisApi.run(jobId, chosen);
      setConfirmRun("");
      progress.reload();
      setRefreshKey((value) => value + 1);
      const label = chosen === "rescore" ? "re-scored" : "queued";
      toast({
        title: result.queued ? `${result.queued} CV${result.queued === 1 ? "" : "s"} ${label}` : "Nothing to do",
        message: result.queued ? "Progress updates as the work finishes." : "Every CV of this role is already up to date.",
      });
    } catch (error) {
      setRunError(error.message);
      setConfirmRun("");
    } finally {
      setRunBusy(false);
    }
  };

  /** One CV again (guide §6.3, "show Retry to HR"). */
  const retryOne = async (applicationId) => {
    setRetrying(applicationId);
    setRunError("");
    try {
      await cvAnalysisApi.rerun(applicationId);
      toast({ title: "Analysis queued", message: "This CV will be read again in the background." });
      progress.reload();
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setRunError(error.message);
    } finally {
      setRetrying("");
    }
  };

  const thresholdChanged = config && Number(thresholdValue) !== config.shortlist_threshold;
  const previewCount = preview?.would_shortlist ?? 0;
  const stale = progressData?.stale_scores ?? 0;
  const notAnalysed = progressData?.not_analysed ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hiring · CV screening"
        title={<>CV <em>analysis</em></>}
        subtitle={`${job.data.title} · Review ranked applications and the evidence behind each match.`}
        actions={
          <>
            <Link to={`/company/jobs/${jobId}/candidates`} className="btn-secondary"><ArrowLeft size={16} /> Applicants</Link>
            <button type="button" onClick={refreshAll} className="icon-btn flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] text-stone-500 hover:bg-stone-50" aria-label="Refresh CV analysis"><RefreshCw size={16} /></button>
          </>
        }
      />

      {runner && (
        <Card className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <CardHeader icon={Sparkles} title="Begin CV screening" subtitle={runMode(mode).description} />
            <div className="flex flex-wrap items-center gap-2">
              <Segmented ariaLabel="What to screen" value={mode} onChange={setMode} options={RUN_MODES.map((m) => ({ value: m.value, label: m.label }))} />
              <button type="button" onClick={() => setConfirmRun(mode)} disabled={runBusy || working} className="btn-primary disabled:opacity-50">
                {runBusy ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />} {working ? "Running…" : "Run screening"}
              </button>
            </div>
          </div>
          {working && <p role="status" className="mt-3 text-[12.5px] text-stone-500">A run is working on this role. Progress below updates by itself.</p>}
          {runError && <p role="alert" className="mt-3 text-[12.5px] text-red-700">{runError}</p>}
        </Card>
      )}

      {stale > 0 && (
        <section aria-label="Scores are out of date" className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700"><AlertTriangle size={17} /></span>
          <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-amber-900">
            <strong>Scores are out of date.</strong> {stale} score{stale === 1 ? " was" : "s were"} computed before this role's requirements or weights last changed. Nothing is re-scored until you ask for it.
          </p>
          {runner && (
            <button type="button" onClick={() => setConfirmRun("rescore")} disabled={runBusy || working} className="btn-secondary shrink-0 !h-9 disabled:opacity-50">
              <RefreshCw size={14} /> Re-score
            </button>
          )}
        </section>
      )}

      <section aria-label="Screening progress" className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile icon={Users} label="Applications" value={progressData?.total_applications ?? "—"} />
          <StatTile icon={Check} label="Analysed" value={progressData?.completed ?? "—"} hint={progressData ? `${notAnalysed} never analysed` : undefined} />
          <StatTile icon={Loader2} label="In queue" value={progressData ? progressData.queued + progressData.processing : "—"} hint={working ? "Processing is active" : "No active run"} />
          <StatTile icon={AlertTriangle} label="Needs attention" value={progressData ? progressData.failed + progressData.manual_review : "—"} hint={progressData ? `${progressData.failed} failed · ${progressData.manual_review} manual review` : undefined} />
        </div>
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <span className="font-semibold text-ink">Screening progress</span>
            <span className="tabular-nums text-stone-500">{progressData ? `${progressData.percent_done}%` : "Loading"}</span>
          </div>
          <ProgressBar value={progressData?.percent_done ?? 0} className="mt-3" />
          <p className="mt-2 text-[11.5px] text-stone-500">Of the CVs this role has started analysing. {notAnalysed > 0 && `${notAnalysed} ${notAnalysed === 1 ? "CV has" : "CVs have"} never been analysed.`}</p>
          {progressData?.paused > 0 && <p className="mt-2 text-[12.5px] text-stone-500">{progressData.paused} queued analysis item(s) are waiting for the company or the daily limit.</p>}
          {progress.status === "error" && <InlineError message={progress.error.message} onRetry={progress.reload} />}
        </Card>
      </section>

      <section aria-label="Shortlist settings" className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <Card className="p-5">
          <CardHeader icon={SlidersHorizontal} title="Shortlist threshold" subtitle="Preview the effect before moving any applications." />
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="w-full max-w-[190px] text-[12.5px] font-semibold text-stone-600">
              Minimum CV match
              <span className="relative mt-1.5 block">
                <input aria-label="Shortlist threshold" type="number" min="0" max="100" step="1" value={thresholdValue} onChange={(event) => { setThreshold(event.target.value); setPreview(null); setActionError(""); }} className="field !h-11 !pr-10" disabled={!manager} />
                <span aria-hidden className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-stone-400">%</span>
              </span>
            </label>
            <button type="button" onClick={saveThreshold} disabled={!manager || !thresholdChanged || thresholdBusy} className="btn-secondary disabled:opacity-50"><Check size={15} /> Save threshold</button>
            <button type="button" onClick={previewThreshold} disabled={!manager || thresholdBusy} className="btn-primary disabled:opacity-50">Preview</button>
          </div>
          {!manager && <p className="mt-3 text-[12.5px] text-stone-500">Only company admins and HR managers can change or apply shortlist thresholds.</p>}
          {preview && (
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 sm:flex-row sm:items-center">
              <p role="status" className="flex-1 text-[13px] text-emerald-900">At {preview.threshold}%, <strong>{preview.would_shortlist}</strong> of {preview.scored} scored applications would be shortlisted. No changes have been made.</p>
              <button type="button" disabled={!manager || previewCount === 0 || thresholdBusy} onClick={() => setConfirmApply(true)} className="btn-primary shrink-0 disabled:opacity-50">Shortlist {previewCount}</button>
            </div>
          )}
          {actionError && <p role="alert" className="mt-3 text-[12.5px] text-red-700">{actionError}</p>}
        </Card>

        <ScreeningSettings
          jobId={jobId}
          config={config}
          manager={manager}
          loading={configRemote.status === "loading" && !config}
          loadError={!config ? configRemote.error : null}
          onReload={configRemote.reload}
          onSaved={(updated) => { setConfigSaved(updated); configRemote.reload(); progress.reload(); }}
        />
      </section>

      <section aria-label="Ranked applications" className="space-y-4">
        <Card className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <CardHeader icon={FileSearch} title="CV match ranking" subtitle="Highest match first. Applications without a score remain visible at the end." />
            <div className="flex flex-wrap gap-2">
              <label className="sr-only" htmlFor="rank-status">Application stage</label>
              <select id="rank-status" aria-label="Application stage" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="h-10 rounded-xl border border-[var(--line)] bg-white px-3 text-[12.5px] text-stone-600">
                {FILTER_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <label className="sr-only" htmlFor="rank-analysis-status">Analysis state</label>
              <select id="rank-analysis-status" aria-label="Analysis state" value={analysisStatus} onChange={(event) => { setAnalysisStatus(event.target.value); setPage(1); }} className="h-10 rounded-xl border border-[var(--line)] bg-white px-3 text-[12.5px] text-stone-600">
                {ANALYSIS_STATES.map((state) => <option key={state.value} value={state.value}>{state.label}</option>)}
              </select>
              <label className="flex h-10 items-center rounded-xl border border-[var(--line)] bg-white px-3 text-[12px] text-stone-500">Min score
                <input aria-label="Minimum score" type="number" min="0" max="100" value={minScore} onChange={(event) => { setMinScore(event.target.value); setPage(1); }} className="ml-2 w-12 border-0 bg-transparent p-0 text-right text-[13px] text-ink outline-none" />
              </label>
            </div>
          </div>
        </Card>

        {ranking.status === "error" && <InlineError message={ranking.error.message} onRetry={ranking.reload} />}
        {ranking.status === "loading" && !ranking.data ? <Loading label="Loading ranked applicants" /> : ranking.data?.results.length === 0 ? (
          <EmptyState icon={FileSearch} title="No applications match these filters" message="Change the filters or check the role's application list." action={<button type="button" onClick={() => { setStatus(""); setAnalysisStatus(""); setMinScore(""); setPage(1); }} className="btn-secondary">Clear filters</button>} />
        ) : ranking.data ? (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-[13px]">
                <thead className="border-b border-[var(--line)] bg-stone-50/70 text-[11px] font-semibold uppercase text-stone-500">
                  <tr><th className="px-4 py-3">Rank</th><th className="px-4 py-3">Candidate</th><th className="px-4 py-3 text-center">Match</th><th className="px-4 py-3">Screening</th><th className="px-4 py-3">Application</th><th className="px-4 py-3">Applied</th><th className="px-4 py-3"></th></tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {rows.map((row) => (
                    <RankingRow
                      key={row.id}
                      row={row}
                      onOpen={() => setSelected(row)}
                      onRetry={runner && RETRYABLE.includes(row.analysis_status) ? () => retryOne(row.id) : null}
                      retrying={retrying === row.id}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-3 text-[12.5px] text-stone-500">
              <span>{ranking.data.count} application{ranking.data.count === 1 ? "" : "s"}</span>
              <div className="flex items-center gap-3">
                <button type="button" aria-label="Previous page" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || ranking.status === "loading"} className="icon-btn flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] disabled:opacity-40"><ChevronLeft size={16} /></button>
                <span>Page {page}</span>
                <button type="button" aria-label="Next page" onClick={() => setPage((value) => value + 1)} disabled={!ranking.data.hasNext || ranking.status === "loading"} className="icon-btn flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] disabled:opacity-40"><ChevronRight size={16} /></button>
              </div>
            </div>
          </Card>
        ) : null}
      </section>

      {selected && <AnalysisDrawer row={selected} onClose={() => setSelected(null)} onRetry={runner ? () => retryOne(selected.id) : null} retrying={retrying === selected.id} />}
      {confirmApply && <ActionDialog title="Apply shortlist threshold?" message={`This will move ${previewCount} scored application${previewCount === 1 ? "" : "s"} at or above ${thresholdValue}% to Shortlisted. Applications below the threshold will not be rejected or changed.`} confirmLabel={`Shortlist ${previewCount}`} busy={thresholdBusy} onConfirm={applyThreshold} onClose={() => !thresholdBusy && setConfirmApply(false)} />}
      {confirmRun && (
        <ActionDialog
          title="Begin CV screening?"
          message={`${runMode(confirmRun).description} Analysis runs in the background and uses this company's daily allowance.`}
          confirmLabel={confirmRun === "rescore" ? "Re-score" : "Run screening"}
          busy={runBusy}
          onConfirm={() => startRun(confirmRun)}
          onClose={() => !runBusy && setConfirmRun("")}
        />
      )}
    </div>
  );
}

/**
 * How this role is screened (guide §6.5). Admins and HR managers edit it; everyone else reads it.
 * `invite_on_shortlist` is shown but not editable: turning it on sends real interview invitations,
 * which belongs with the interview module rather than here.
 */
function ScreeningSettings({ jobId, config, manager, loading, loadError, onReload, onSaved }) {
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const weights = useMemo(() => (draft ?? (config ? weightValues(config) : null)), [draft, config]);
  const total = weights ? weightsTotal(weights) : 0;
  const localError = weights ? weightsError(weights) : "";
  const changed = Boolean(config && weights && WEIGHT_FIELDS.some((field) => Number(config[field.key]) !== Number(weights[field.key])));

  const saveFlag = async (key, value) => {
    setBusy(key);
    setError("");
    try {
      onSaved(await cvAnalysisApi.updateConfig(jobId, { [key]: value }));
      toast({ title: "Setting saved", message: value ? "Turned on." : "Turned off." });
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy("");
    }
  };

  const saveWeights = async () => {
    setBusy("weights");
    setError("");
    try {
      onSaved(await cvAnalysisApi.updateConfig(jobId, weightValues(weights)));
      setDraft(null);
      toast({ title: "Weights saved", message: "Every analysed CV of this role is being re-scored in the background." });
    } catch (problem) {
      setError(problem.field?.("weights") || problem.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <Card className="p-5">
      <CardHeader icon={CircleHelp} title="How this role is screened" subtitle={manager ? "Changes take effect on the next analysis." : "Current server settings for this role."} />
      {loading ? <p className="mt-5 text-[13px] text-stone-500">Loading screening settings…</p> : loadError ? <InlineError message={loadError.message} onRetry={onReload} /> : config ? (
        <>
          <div className="mt-4 divide-y divide-[var(--line)] text-[13px]">
            <SettingRow
              label="Analyse each CV on arrival"
              hint="Every new application is read and scored without anyone asking."
              control={manager
                ? <Toggle checked={Boolean(config.auto_analyse)} disabled={busy === "auto_analyse"} label="Analyse each CV on arrival" onChange={(value) => saveFlag("auto_analyse", value)} />
                : <span className="font-medium text-ink">{config.auto_analyse ? "On" : "Off"}</span>}
            />
            <SettingRow
              label="Shortlist at or above the threshold"
              hint="Anyone who reaches the threshold is shortlisted automatically. Nobody is ever rejected automatically."
              control={manager
                ? <Toggle checked={Boolean(config.auto_shortlist)} disabled={busy === "auto_shortlist"} label="Shortlist at or above the threshold" onChange={(value) => saveFlag("auto_shortlist", value)} />
                : <span className="font-medium text-ink">{config.auto_shortlist ? "On" : "Off"}</span>}
            />
            <SettingRow
              label="Invite to a screening interview on shortlisting"
              hint="Set on the server. It is not editable here while the interview questions still come from the placeholder AI hooks."
              control={<Badge tone={config.invite_on_shortlist ? "success" : "neutral"}>{config.invite_on_shortlist ? "On" : "Off"}</Badge>}
            />
          </div>

          <div className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[13px] font-semibold text-ink">Scoring weights</h3>
              <span className={`text-[12px] font-semibold tabular-nums ${total === 100 ? "text-emerald-700" : "text-amber-700"}`}>{total} / 100</span>
            </div>
            <div className="mt-3 space-y-2.5">
              {WEIGHT_FIELDS.map((field) => (
                <label key={field.key} className="flex items-center justify-between gap-3 text-[12.5px]">
                  <span className="min-w-0">
                    <span className="font-medium text-stone-700">{field.label}</span>
                    <span className="block text-[11.5px] text-stone-400">{field.hint}</span>
                  </span>
                  {manager ? (
                    <span className="relative shrink-0">
                      <input
                        type="number" min="0" max="100" step="1"
                        aria-label={`${field.label} weight`}
                        value={weights?.[field.key] ?? ""}
                        onChange={(event) => { setError(""); setDraft({ ...(weights || {}), [field.key]: event.target.value }); }}
                        className="field !h-9 w-[86px] !pr-7 text-right"
                      />
                      <span aria-hidden className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-stone-400">%</span>
                    </span>
                  ) : (
                    <span className="shrink-0 font-semibold tabular-nums text-ink">{config[field.key]}%</span>
                  )}
                </label>
              ))}
            </div>
            {manager && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" onClick={saveWeights} disabled={!changed || Boolean(localError) || busy === "weights"} className="btn-secondary !h-9 text-[12.5px] disabled:opacity-50">
                  {busy === "weights" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save weights
                </button>
                {changed && <button type="button" onClick={() => { setDraft(null); setError(""); }} className="text-[12.5px] font-semibold text-stone-500 hover:text-ink">Reset</button>}
              </div>
            )}
            {localError && <p role="alert" className="mt-2 text-[12px] text-amber-800">{localError}</p>}
            {manager && changed && !localError && <p className="mt-2 text-[11.5px] text-stone-500">Saving re-scores every analysed CV of this role in the background.</p>}
          </div>

          {error && <p role="alert" className="mt-3 text-[12.5px] text-red-700">{error}</p>}
          {!manager && <p className="mt-3 text-[12.5px] text-stone-500">Only company admins and HR managers can change these settings.</p>}
          {config.warnings?.length > 0 && (
            <div className="mt-4 space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 p-3">
              {config.warnings.map((warning) => <p key={warning} className="flex items-start gap-2 text-[12.5px] text-amber-900"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> <span>{warning}</span></p>)}
            </div>
          )}
        </>
      ) : null}
    </Card>
  );
}

function SettingRow({ label, hint, control }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3">
      <span className="min-w-0">
        <span className="font-medium text-stone-700">{label}</span>
        <span className="mt-0.5 block text-[11.5px] leading-relaxed text-stone-400">{hint}</span>
      </span>
      <span className="shrink-0 pt-0.5">{control}</span>
    </div>
  );
}

function RankingRow({ row, onOpen, onRetry, retrying }) {
  return (
    <tr className="transition-colors hover:bg-stone-50">
      <td className="px-4 py-3.5 font-semibold tabular-nums text-stone-500">{row.rank}</td>
      <td className="px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3"><Avatar name={row.full_name} size={34} /><div className="min-w-0"><p className="truncate font-semibold text-ink">{row.full_name}</p><p className="truncate text-[11.5px] text-stone-500">{row.reference} · {row.email}</p></div></div>
      </td>
      <td className="px-4 py-3.5 text-center">{row.score == null ? <span className="text-stone-400">—</span> : <Badge tone={scoreTone(row.score)}>{scoreText(row.score)} / 100</Badge>}</td>
      <td className="px-4 py-3.5">
        {row.cv_label ? <Badge tone={cvLabelTone(row.cv_label)}>{cvLabel(row.cv_label)}</Badge> : <AnalysisStateBadge status={row.analysis_status} />}
        {row.stale && <span className="ml-1.5 text-[11px] text-amber-700">Out of date</span>}
      </td>
      <td className="px-4 py-3.5"><Badge tone={statusTone(row.status)}>{statusLabel(row.status)}</Badge></td>
      <td className="px-4 py-3.5 whitespace-nowrap text-stone-600">{row.submitted_at ? formatDate(row.submitted_at) : "—"}</td>
      <td className="px-4 py-3.5">
        <div className="flex items-center justify-end gap-2">
          {onRetry && (
            <button type="button" onClick={(event) => { event.stopPropagation(); onRetry(); }} disabled={retrying} aria-label={`Analyse ${row.full_name}'s CV again`} className="btn-secondary !h-8 !px-2.5 text-[11.5px] disabled:opacity-50">
              {retrying ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Retry
            </button>
          )}
          <button type="button" onClick={(event) => { event.stopPropagation(); onOpen(); }} className="btn-secondary !h-8 !px-2.5 text-[11.5px]">Details</button>
        </div>
      </td>
    </tr>
  );
}

function AnalysisDrawer({ row, onClose, onRetry, retrying }) {
  const analysis = useRemote((options) => cvAnalysisApi.analysis(row.id, options), [row.id]);
  const body = analysis.data;
  const match = body?.match;
  const canRetry = onRetry && body && RETRYABLE.includes(body.status);
  return (
    <Drawer title={row.full_name} subtitle={`${row.reference} · ${row.email}`} onClose={onClose} accent={<span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand"><FileSearch size={17} /></span>}>
      {analysis.status === "loading" && !body && <Loading label="Loading CV analysis" />}
      {analysis.status === "error" && (analysis.error.code === "not_analysed" || analysis.error.status === 404) ? <EmptyState icon={FileSearch} title="No analysis available" message="This CV has not been analysed, or the analysis record is not available." className="px-4 py-8" /> : null}
      {analysis.status === "error" && analysis.error.code !== "not_analysed" && analysis.error.status !== 404 && <InlineError message={analysis.error.message} onRetry={analysis.reload} />}
      {body && (
        <div className="space-y-5">
          <ScoreSummary match={match} label={body.cv_label} />
          {match?.stale && <StaleWarning />}
          <ScoreBreakdown match={match} />
          {match && (
            <>
              <SkillChips title="Matched skills" values={match.matched_skills} tone="success" />
              <SkillChips title="Skills to review" values={match.missing_skills} tone="warning" />
              <p className="text-[12.5px] text-stone-500">Experience identified: {match.experience_years ?? 0} years</p>
              <AiExplanation match={match} />
            </>
          )}
          {body.failure_reason && (
            <div className="rounded-xl bg-amber-50 p-3">
              <p className="text-[12.5px] text-amber-900">{body.failure_reason}</p>
              {canRetry && (
                <button type="button" onClick={onRetry} disabled={retrying} className="btn-secondary mt-2 !h-9 text-[12.5px] disabled:opacity-50">
                  {retrying ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Analyse again
                </button>
              )}
            </div>
          )}
          <ReviewFlags flags={body.flags} />
          <ParsedCv parsed={body.parsed} />
          {body.notice && <p className="border-t border-[var(--line)] pt-4 text-[11.5px] leading-relaxed text-stone-500">{body.notice}</p>}
        </div>
      )}
    </Drawer>
  );
}

function DemoWorkspace({ jobId }) {
  const record = useCompanyRecord();
  const { bulkStage } = useCompanyActions();
  const job = record?.jobs.find((item) => item.id === jobId);
  const [threshold, setThreshold] = useState("70");
  const [thresholdError, setThresholdError] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(null);
  const [confirmApply, setConfirmApply] = useState(false);
  const [page, setPage] = useState(1);
  const allRows = useMemo(() => (record?.applicants || []).filter((item) => item.jobId === jobId).map((item) => ({
    id: item.id,
    full_name: item.name,
    email: item.email,
    reference: item.id.toUpperCase(),
    status: ({ Applied: "submitted", Screened: "under_review", Shortlisted: "shortlisted", Interviewed: "interview", Offer: "selected" })[item.stage] || "under_review",
    submitted_at: new Date(item.appliedAt).toISOString(),
    score: item.cvScore,
    analysis_status: "completed",
    cv_label: item.stage === "Shortlisted" ? "shortlisted" : "meets_threshold",
    stale: false,
    demo: item,
  })).sort((a, b) => b.score - a.score), [record?.applicants, jobId]);
  const rows = useMemo(() => allRows.filter((item) => !status || item.status === status), [allRows, status]);
  const pageRows = rows.slice((page - 1) * 20, page * 20);
  const total = rows.length;
  const eligible = allRows.filter((item) => ["submitted", "under_review"].includes(item.status) && item.score >= Number(threshold));
  const apply = () => {
    bulkStage(eligible.map((item) => item.id), "Shortlisted");
    toast({ title: "Shortlist updated", message: `${eligible.length} ${eligible.length === 1 ? "candidate was" : "candidates were"} shortlisted in demo data.` });
    setConfirmApply(false);
    setPreview(null);
  };

  if (!job) return <EmptyState icon={FileSearch} title="Role not found" message="Choose a role from the candidate pipeline." action={<Link to={ROUTES.COMPANY.JOBS} className="btn-primary">Back to roles</Link>} />;

  const complete = record.applicants.filter((item) => item.jobId === jobId).length;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Hiring · CV screening · Demo" title={<>CV <em>analysis</em></>} subtitle={`${job.title} · Ranked sample applicants and threshold preview.`} actions={<Link to={`/company/jobs/${jobId}/candidates`} className="btn-secondary"><ArrowLeft size={16} /> Applicants</Link>} />
      <section className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-900"><Sparkles size={17} className="mt-0.5 shrink-0" /><p>Demo scores are seeded sample data. CV extraction, AI explanations, and re-analysis are not simulated.</p></section>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Users} label="Applications" value={complete} />
        <StatTile icon={Check} label="Analysed" value={complete} hint="Sample data" />
        <StatTile icon={Loader2} label="In queue" value={0} />
        <StatTile icon={AlertTriangle} label="Needs attention" value={0} />
      </div>
      <Card className="p-5"><div className="flex justify-between text-[13px]"><span className="font-semibold">Screening progress</span><span>{complete ? "100%" : "0%"}</span></div><ProgressBar value={complete ? 100 : 0} className="mt-3" /></Card>
      <Card className="p-5">
        <CardHeader icon={SlidersHorizontal} title="Shortlist threshold" subtitle="Preview before moving demo applicants." />
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-[12.5px] font-semibold text-stone-600">Minimum CV match<input aria-label="Shortlist threshold" type="number" min="0" max="100" value={threshold} onChange={(event) => { setThreshold(event.target.value); setPreview(null); setThresholdError(""); }} className="field mt-1.5 !h-11 w-32" /></label>
          <button type="button" onClick={() => { if (!validThreshold(threshold)) return setThresholdError("Enter a whole-number threshold from 0 to 100."); setThresholdError(""); setPreview({ count: eligible.length, scored: allRows.length }); }} className="btn-primary">Preview</button>
        </div>
        {thresholdError && <p role="alert" className="mt-3 text-[12.5px] text-red-700">{thresholdError}</p>}
        {preview && <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p role="status" className="flex-1 text-[13px] text-emerald-900">{preview.count} of {preview.scored} candidates would be shortlisted. No changes have been made.</p><button type="button" disabled={!preview.count} onClick={() => setConfirmApply(true)} className="btn-primary disabled:opacity-50">Shortlist {preview.count}</button></div>}
      </Card>
      <Card className="p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><CardHeader icon={FileSearch} title="CV match ranking" subtitle="Sample records sorted by seeded match score." /><select aria-label="Application stage" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="h-10 rounded-xl border border-[var(--line)] bg-white px-3 text-[12.5px] text-stone-600">{FILTER_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        {pageRows.length === 0 ? <EmptyState icon={FileSearch} title="No applications match these filters" /> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[700px] text-left text-[13px]"><thead className="border-b border-[var(--line)] bg-stone-50 text-[11px] uppercase text-stone-500"><tr><th className="p-3">Rank</th><th className="p-3">Candidate</th><th className="p-3">Match</th><th className="p-3">Screening</th><th className="p-3">Stage</th><th className="p-3">Applied</th><th className="p-3"></th></tr></thead><tbody className="divide-y divide-[var(--line)]">{pageRows.map((row, index) => <RankingRow key={row.id} row={{ ...row, rank: (page - 1) * 20 + index + 1 }} onOpen={() => setSelected(row)} onRetry={null} retrying={false} />)}</tbody></table></div>}
        <div className="mt-4 flex items-center justify-between text-[12.5px] text-stone-500"><span>{total} applications</span><div className="flex items-center gap-3"><button type="button" aria-label="Previous page" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1} className="icon-btn flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] disabled:opacity-40"><ChevronLeft size={16} /></button><span>Page {page}</span><button type="button" aria-label="Next page" onClick={() => setPage((value) => value + 1)} disabled={page * 20 >= total} className="icon-btn flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] disabled:opacity-40"><ChevronRight size={16} /></button></div></div>
      </Card>
      {selected && <DemoDetailDrawer applicant={selected.demo} onClose={() => setSelected(null)} />}
      {confirmApply && <ActionDialog title="Apply demo threshold?" message={`This will move ${eligible.length} sample application${eligible.length === 1 ? "" : "s"} at or above ${threshold}% to Shortlisted.`} confirmLabel={`Shortlist ${eligible.length}`} onConfirm={apply} onClose={() => setConfirmApply(false)} />}
    </div>
  );
}

function DemoDetailDrawer({ applicant, onClose }) {
  return (
    <Drawer title={applicant.name} subtitle="Seeded demo CV match details" onClose={onClose} accent={<span className="mt-1 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand"><FileSearch size={17} /></span>}>
      <div className="space-y-5">
        <section className="rounded-xl bg-stone-50 p-4"><p className="text-[11px] font-semibold uppercase text-stone-400">CV match</p><p className="mt-1 text-[28px] font-semibold">{applicant.cvScore}%</p></section>
        <SkillChips title="Matched skills" values={applicant.matchedSkills} tone="success" />
        <SkillChips title="Skills to review" values={applicant.unmatchedSkills} tone="warning" />
        <ParsedEntries title="Education" values={applicant.education} render={(item) => [item.degree, item.institution, item.year].filter(Boolean).join(" · ")} />
        <ParsedEntries title="Experience" values={applicant.work} render={(item) => [item.role, item.company, item.duration].filter(Boolean).join(" · ")} />
        <p className="border-t border-[var(--line)] pt-4 text-[11.5px] text-stone-500">This is sample profile data; no analysis request was sent.</p>
      </div>
    </Drawer>
  );
}
