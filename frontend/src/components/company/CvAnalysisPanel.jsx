// What Module 6 read out of one candidate's CV, on their profile (guide §6.5).
// Matched and missing skills as chips, and the explanation never without its notice.
import { useState } from "react";
import { Link } from "react-router-dom";
import { FileSearch, RefreshCw } from "lucide-react";
import { Card, CardHeader } from "@/components/app/primitives";
import { cvAnalysisApi } from "@/api/cvAnalysisApi";
import { useRemote } from "@/hooks/useRemote";
import { canRunScreening } from "@/lib/cvMap";
import { ROUTES } from "@/config/routes";
import { toast } from "@/store/toastStore";
import {
  AiExplanation,
  AnalysisStateBadge,
  InlineError,
  Loading,
  ParsedCv,
  ReviewFlags,
  ScoreBreakdown,
  ScoreSummary,
  SkillChips,
  StaleWarning,
} from "./cvAnalysisParts";

const notAnalysed = (error) => error?.code === "not_analysed" || error?.status === 404;

export default function CvAnalysisPanel({ applicationId, jobId, memberRole }) {
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const analysis = useRemote((options) => cvAnalysisApi.analysis(applicationId, options), [applicationId, reloadKey]);
  const mayRerun = canRunScreening({ memberRole });
  const body = analysis.data;
  const match = body?.match;

  const rerun = async () => {
    setBusy(true);
    setError("");
    try {
      await cvAnalysisApi.rerun(applicationId);
      toast({ title: "Analysis queued", message: "This CV will be read again in the background." });
      setReloadKey((value) => value + 1);
    } catch (problem) {
      setError(problem.message);
      if (problem.code === "analysis_in_progress") setReloadKey((value) => value + 1);
    } finally {
      setBusy(false);
    }
  };

  const rerunButton = mayRerun && (
    <button type="button" onClick={rerun} disabled={busy} className="btn-secondary !h-9 text-[12.5px] disabled:opacity-50">
      <RefreshCw size={14} className={busy ? "animate-spin" : ""} /> Analyse again
    </button>
  );

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <CardHeader icon={FileSearch} title="CV analysis" subtitle="How this CV scored against the role." />
        <div className="flex flex-wrap items-center gap-2">
          {body?.status && <AnalysisStateBadge status={body.status} />}
          {jobId && (
            <Link to={ROUTES.COMPANY.JOB_CV_ANALYSIS.replace(":id", jobId)} className="btn-secondary !h-9 text-[12.5px]">
              Full ranking
            </Link>
          )}
          {body && rerunButton}
        </div>
      </div>

      {analysis.status === "loading" && !body && <Loading label="Loading the CV analysis" />}

      {analysis.status === "error" && notAnalysed(analysis.error) && (
        <div className="mt-4 rounded-xl border border-dashed border-stone-300 p-5 text-center">
          <p className="text-[13px] text-stone-500">This CV has not been analysed yet.</p>
          {mayRerun && <div className="mt-3 flex justify-center">{rerunButton}</div>}
        </div>
      )}

      {analysis.status === "error" && !notAnalysed(analysis.error) && (
        <InlineError message={analysis.error.message} onRetry={analysis.reload} />
      )}

      {error && <p role="alert" className="mt-3 text-[12.5px] text-red-700">{error}</p>}

      {body && (
        <div className="mt-4 space-y-5">
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
              {mayRerun && <div className="mt-2">{rerunButton}</div>}
            </div>
          )}
          <ReviewFlags flags={body.flags} />
          <div>
            <button type="button" onClick={() => setExpanded((value) => !value)} className="text-[12.5px] font-semibold text-brand hover:underline">
              {expanded ? "Hide what was read from the CV" : "Show what was read from the CV"}
            </button>
            {expanded && <div className="mt-3 space-y-4"><ParsedCv parsed={body.parsed} /></div>}
          </div>
          {body.notice && <p className="border-t border-[var(--line)] pt-4 text-[11.5px] leading-relaxed text-stone-500">{body.notice}</p>}
        </div>
      )}
    </Card>
  );
}
