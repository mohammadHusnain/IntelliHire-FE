import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, ArrowUpDown, Award, ChevronRight, Clock, Download, FileBarChart2, LayoutGrid, List, Mic,
  RotateCcw, Search, SearchX, TrendingUp, X,
} from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, PageHeader, ScoreRing, Segmented, StatTile, TrendChart } from "@/components/app/primitives";
import Reveal from "@/components/shared/Reveal";
import { useCandidateRecord } from "@/store/candidateStore";
import {
  DIFFICULTY_LABEL, TYPE_LABEL, formatDate, formatDuration, scoreTone, sessionStats, toneFor,
} from "@/lib/candidateStats";
import { DIMENSION_LABEL, DIMENSION_SHORT } from "@/lib/interview/evaluate";
import { downloadFile, toCsv } from "@/lib/csv";
import { toast } from "@/store/toastStore";

const SORTS = {
  newest: { label: "Newest first", fn: (a, b) => b.completedAt - a.completedAt },
  oldest: { label: "Oldest first", fn: (a, b) => a.completedAt - b.completedAt },
  highest: { label: "Highest score", fn: (a, b) => b.summary.overall - a.summary.overall },
  lowest: { label: "Lowest score", fn: (a, b) => a.summary.overall - b.summary.overall },
};

const retakeUrl = (s) =>
  `/candidate/interview/setup?type=${s.type}&role=${encodeURIComponent(s.role)}&difficulty=${s.difficulty}&length=${s.questions.length}`;

function ReportCard({ s, index }) {
  const tone = scoreTone(s.summary.overall);
  return (
    <Reveal delay={Math.min(index, 8) * 50} className="min-w-0">
      <Card interactive className="group relative flex h-full flex-col p-5">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="neutral">{TYPE_LABEL[s.type]}</Badge>
              <Badge tone="neutral">{DIFFICULTY_LABEL[s.difficulty]}</Badge>
            </div>
            <h3 className="mt-3 truncate font-sans text-[16px] font-semibold text-ink">
              <Link to={`/candidate/report/${s.id}`} className="after:absolute after:inset-0 after:rounded-[20px] focus-visible:outline-none">
                {s.role}
              </Link>
            </h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[12.5px] text-stone-500">
              {formatDate(s.completedAt)} <span className="text-stone-300">•</span> {formatDuration(s.durationSec)}
            </p>
          </div>
          <ScoreRing score={s.summary.overall} size={64} stroke={6} label="" />
        </div>

        <div className="mt-5 grid grid-cols-4 gap-2">
          {Object.entries(s.summary.breakdown).map(([k, v]) => (
            <div key={k} title={DIMENSION_LABEL[k]} className="min-w-0 rounded-xl bg-stone-50 px-1 py-2 text-center">
              <p className="truncate text-[10.5px] text-stone-500">{DIMENSION_SHORT[k]}</p>
              <p className={`text-[14px] font-semibold tabular-nums ${scoreTone(v).text}`}>{v}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-[var(--line)] pt-4">
          <Badge tone={toneFor(s.summary.overall)}>{s.summary.verdict.label}</Badge>
          <div className="relative z-10 flex items-center gap-1">
            <Link
              to={retakeUrl(s)}
              aria-label={`Retake ${s.role} interview`}
              title="Retake"
              className="icon-btn flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-ink"
            >
              <RotateCcw size={15} />
            </Link>
            <span className={`inline-flex items-center gap-1 text-[13px] font-semibold ${tone.text}`}>
              View <ChevronRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </Card>
    </Reveal>
  );
}

function ReportTable({ rows }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-[13.5px]">
          <thead className="border-b border-[var(--line)] bg-stone-50/70 text-[12px] font-semibold uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-5 py-3">Interview</th>
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">Duration</th>
              {Object.keys(DIMENSION_LABEL).map((k) => (
                <th key={k} className="px-3 py-3 text-center">{DIMENSION_SHORT[k]}</th>
              ))}
              <th className="px-3 py-3 text-center">Score</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {rows.map((s, i) => (
              <tr key={s.id} className="row-hover group animate-fade-in" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
                <td className="px-5 py-3.5">
                  <Link to={`/candidate/report/${s.id}`} className="font-semibold text-ink hover:text-brand">{s.role}</Link>
                  <p className="text-[12px] text-stone-500">{TYPE_LABEL[s.type]} · {DIFFICULTY_LABEL[s.difficulty]}</p>
                </td>
                <td className="whitespace-nowrap px-3 py-3.5 text-stone-600">{formatDate(s.completedAt)}</td>
                <td className="whitespace-nowrap px-3 py-3.5 text-stone-600">{formatDuration(s.durationSec)}</td>
                {Object.entries(s.summary.breakdown).map(([k, v]) => (
                  <td key={k} className={`px-3 py-3.5 text-center font-semibold tabular-nums ${scoreTone(v).text}`}>{v}</td>
                ))}
                <td className="px-3 py-3.5 text-center">
                  <Badge tone={toneFor(s.summary.overall)} className="tabular-nums">{s.summary.overall}</Badge>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <Link to={`/candidate/report/${s.id}`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-stone-500 group-hover:text-brand">
                    Open <ChevronRight size={15} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function CandidateReports() {
  const { sessions, prefs, profile } = useCandidateRecord();
  const stats = useMemo(() => sessionStats(sessions, prefs.weeklyGoal), [sessions, prefs.weeklyGoal]);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState("newest");
  const [view, setView] = useState("grid");
  const [metric, setMetric] = useState("overall");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions
      .filter((s) => (type === "all" || s.type === type) && (!q || s.role.toLowerCase().includes(q) || TYPE_LABEL[s.type].toLowerCase().includes(q)))
      .sort(SORTS[sort].fn);
  }, [sessions, query, type, sort]);

  const chartPoints = useMemo(
    () =>
      [...sessions]
        .sort((a, b) => a.completedAt - b.completedAt)
        .map((s) => ({
          label: formatDate(s.completedAt, { day: "numeric", month: "short" }),
          value: metric === "overall" ? s.summary.overall : s.summary.breakdown[metric],
          sub: s.role,
        })),
    [sessions, metric],
  );

  const exportCsv = () => {
    const headers = ["Date", "Role", "Type", "Difficulty", "Questions", "Answered", "Duration (min)", "Overall", "Communication", "Structure", "Confidence", "Technical", "Verdict"];
    const data = [...sessions]
      .sort((a, b) => b.completedAt - a.completedAt)
      .map((s) => [
        new Date(s.completedAt).toISOString().slice(0, 10),
        s.role,
        TYPE_LABEL[s.type],
        DIFFICULTY_LABEL[s.difficulty],
        s.questions.length,
        s.summary.stats.answered,
        Math.round(s.durationSec / 60),
        s.summary.overall,
        s.summary.breakdown.communication,
        s.summary.breakdown.structure,
        s.summary.breakdown.confidence,
        s.summary.breakdown.technical,
        s.summary.verdict.label,
      ]);
    const name = `intellihire-reports-${profile.fullName.toLowerCase().replace(/\s+/g, "-") || "candidate"}-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadFile(name, toCsv(headers, data));
    toast({ title: "Reports exported", message: `${data.length} interviews saved to ${name}.` });
  };

  const filtersActive = query || type !== "all";

  if (!sessions.length) {
    return (
      <div>
        <PageHeader eyebrow="Reports" title={<>Your interview <em>reports</em></>} subtitle="Every practice interview gets a detailed report you can come back to." />
        <EmptyState
          icon={FileBarChart2}
          title="No reports yet"
          message="Complete your first practice interview and your report will appear here, with scores, strengths and an action plan."
          action={
            <Link to="/candidate/interview/setup" className="btn-primary">
              <Mic size={16} /> Start your first interview
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reports"
        title={<>Your interview <em>reports</em></>}
        subtitle={`${stats.count} interviews · average ${stats.avg}/100 · best ${stats.best}/100`}
        actions={
          <>
            <button type="button" onClick={exportCsv} className="btn-secondary">
              <Download size={16} /> Export CSV
            </button>
            <Link to="/candidate/interview/setup" className="btn-primary">
              <Mic size={16} /> New interview
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={FileBarChart2} label="Interviews" value={stats.count} hint={`${stats.thisWeek} this week`} />
        <StatTile icon={TrendingUp} label="Average score" value={stats.avg} suffix="/100" delta={stats.improvement || null} delay={60} />
        <StatTile icon={Award} label="Best score" value={stats.best} suffix="/100" delay={120} />
        <StatTile icon={Clock} label="Practice time" value={stats.minutes} suffix="min" delay={180} />
      </div>

      <Reveal>
        <Card className="p-6">
          <CardHeader
            icon={TrendingUp}
            title="Progress over time"
            subtitle={metric === "overall" ? "Overall score per interview" : `${DIMENSION_LABEL[metric]} per interview`}
            action={
              <div className="hidden md:block">
                <Segmented
                  size="sm"
                  ariaLabel="Chart metric"
                  value={metric}
                  onChange={setMetric}
                  options={[{ value: "overall", label: "Overall" }, ...Object.keys(DIMENSION_LABEL).map((k) => ({ value: k, label: DIMENSION_SHORT[k] }))]}
                />
              </div>
            }
          />
          <div className="mt-4 md:hidden">
            <select value={metric} onChange={(e) => setMetric(e.target.value)} className="field !h-10 !text-[14px]" aria-label="Chart metric">
              <option value="overall">Overall</option>
              {Object.keys(DIMENSION_LABEL).map((k) => <option key={k} value={k}>{DIMENSION_LABEL[k]}</option>)}
            </select>
          </div>
          <div className="mt-6">
            <TrendChart key={metric} points={chartPoints} height={210} />
          </div>
        </Card>
      </Reveal>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by role or type"
            className="field !h-11 !pl-10 pr-10"
            aria-label="Search reports"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="icon-btn absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-ink">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="max-w-full overflow-x-auto">
            <Segmented
              size="sm"
              ariaLabel="Interview type"
              value={type}
              onChange={setType}
              options={[{ value: "all", label: "All" }, { value: "general", label: "General" }, { value: "technical", label: "Technical" }, { value: "role-specific", label: "Role" }]}
            />
          </div>
          <label className="relative">
            <span className="sr-only">Sort</span>
            <ArrowUpDown size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-10 cursor-pointer appearance-none rounded-xl border border-[var(--line)] bg-white pl-8 pr-4 text-[13px] font-semibold text-stone-600 outline-none transition-colors hover:border-stone-300 focus:border-brand">
              {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </label>
          <Segmented
            size="sm"
            ariaLabel="View"
            className="hidden md:inline-grid"
            value={view}
            onChange={setView}
            options={[{ value: "grid", label: "", icon: LayoutGrid, ariaLabel: "Grid view" }, { value: "list", label: "", icon: List, ariaLabel: "List view" }]}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-[13px] text-stone-500">
        <p>
          Showing <span className="font-semibold text-ink">{rows.length}</span> of {sessions.length}
        </p>
        {filtersActive && (
          <button type="button" onClick={() => { setQuery(""); setType("all"); }} className="font-semibold text-brand hover:text-brand-hover">
            Clear filters
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No matching reports"
          message="Try a different search or show all interview types."
          action={
            <button type="button" onClick={() => { setQuery(""); setType("all"); }} className="btn-secondary">
              Clear filters
            </button>
          }
        />
      ) : view === "list" ? (
        <>
          <div className="hidden md:block">
            <ReportTable rows={rows} />
          </div>
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {rows.map((s, i) => <ReportCard key={s.id} s={s} index={i} />)}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((s, i) => <ReportCard key={s.id} s={s} index={i} />)}
        </div>
      )}

      <div className="flex justify-center pt-2">
        <Link to="/candidate/interview/setup" className="group inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-stone-500 hover:text-brand">
          Ready for another round? Start a new interview <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}
