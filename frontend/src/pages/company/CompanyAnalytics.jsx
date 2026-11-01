import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, Briefcase, Download, Printer, TrendingUp, Users } from "lucide-react";
import { Card, CardHeader, EmptyState, PageHeader, ProgressBar, StatTile, TrendChart } from "@/components/app/primitives";
import Reveal from "@/components/shared/Reveal";
import { PIPELINE, companyStats, useCompanyRecord } from "@/store/companyStore";
import { formatDate, scoreTone } from "@/lib/candidateStats";
import { downloadFile, toCsv } from "@/lib/csv";
import { toast } from "@/store/toastStore";
import { ROUTES } from "@/config/routes";

const WEEK = 7 * 86400000;

function Bars({ rows, total, tone = "bg-brand" }) {
  if (!rows.length) return <p className="py-8 text-center text-[13.5px] text-stone-500">No data yet.</p>;
  return (
    <ul className="mt-5 space-y-3.5">
      {rows.map((r, i) => (
        <li key={r.label} className="animate-fade-in-up" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate font-medium text-stone-600">{r.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-ink">
              {r.count}
              {total ? <span className="ml-1 font-normal text-stone-400">{Math.round((r.count / total) * 100)}%</span> : null}
            </span>
          </div>
          <ProgressBar value={total ? (r.count / total) * 100 : 0} tone={tone} />
        </li>
      ))}
    </ul>
  );
}

export default function CompanyAnalytics() {
  const [now] = useState(() => Date.now());
  const record = useCompanyRecord();
  const stats = useMemo(() => companyStats(record), [record]);
  const { applicants, jobs } = record;

  const weeks = useMemo(() => {
    if (!applicants.length) return [];
    const out = [];
    for (let t = now - 8 * WEEK; t < now; t += WEEK) {
      out.push({ at: t, count: applicants.filter((a) => a.appliedAt >= t && a.appliedAt < t + WEEK).length });
    }
    return out;
  }, [applicants, now]);

  const byJob = useMemo(
    () => jobs.map((j) => ({ label: j.title, count: applicants.filter((a) => a.jobId === j.id).length })).filter((r) => r.count > 0).sort((a, b) => b.count - a.count),
    [jobs, applicants],
  );

  const bySource = useMemo(() => {
    const map = new Map();
    for (const a of applicants) map.set(a.source, (map.get(a.source) || 0) + 1);
    return [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  }, [applicants]);

  const conversion = useMemo(() => {
    const reached = (stage) => {
      const idx = PIPELINE.indexOf(stage);
      return applicants.filter((a) => {
        const current = PIPELINE.indexOf(a.stage);
        return current >= idx || a.history.some((h) => PIPELINE.indexOf(h.stage) >= idx);
      }).length;
    };
    return PIPELINE.map((s) => ({ stage: s, count: reached(s) }));
  }, [applicants]);

  const exportCsv = () => {
    const headers = ["Metric", "Value"];
    const data = [
      ["Roles", stats.jobs], ["Open roles", stats.openJobs], ["Applicants", stats.applicants],
      ["In play", stats.active], ["Shortlisted or beyond", stats.shortlisted], ["Not proceeding", stats.rejected],
      ["Average CV match", stats.avgScore],
      ...PIPELINE.map((s) => [`Stage · ${s}`, stats.byStage[s]]),
      ...byJob.map((r) => [`Role · ${r.label}`, r.count]),
      ...bySource.map((r) => [`Source · ${r.label}`, r.count]),
    ];
    const name = `hiring-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadFile(name, toCsv(headers, data));
    toast({ title: "Analytics exported", message: `Summary saved to ${name}.` });
  };

  if (!applicants.length) {
    return (
      <div>
        <PageHeader eyebrow="Analytics" title={<>Your hiring <em>analytics</em></>} subtitle="Computed from your own roles and applicants." />
        <EmptyState
          icon={BarChart3}
          title="Nothing to measure yet"
          message="Once candidates apply to your roles, you will see applicant volume, pipeline conversion and source breakdowns here."
          action={<Link to={ROUTES.COMPANY.JOBS} className="btn-primary">Go to roles</Link>}
        />
      </div>
    );
  }

  const top = conversion[0]?.count || 1;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analytics"
        title={<>Your hiring <em>analytics</em></>}
        subtitle="Computed from your own roles and applicants, not sample data."
        actions={
          <>
            <button type="button" onClick={exportCsv} className="btn-secondary">
              <Download size={16} /> Export CSV
            </button>
            <button type="button" onClick={() => window.print()} className="btn-primary">
              <Printer size={16} /> Print / PDF
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={Briefcase} label="Open roles" value={stats.openJobs} hint={`${stats.jobs} in total`} />
        <StatTile icon={Users} label="Applicants" value={stats.applicants} hint={`${stats.active} in play`} delay={60} />
        <StatTile icon={TrendingUp} label="Shortlisted" value={stats.shortlisted} hint="interview or beyond" delay={120} />
        <StatTile icon={BarChart3} label="Average CV match" value={stats.avgScore} suffix="/100" delay={180} />
      </div>

      {weeks.length > 0 && (
        <Reveal>
          <Card className="p-6">
            <CardHeader icon={TrendingUp} title="Applicants over time" subtitle="Per week, last eight weeks" />
            <div className="mt-6">
              <TrendChart
                points={weeks.map((w) => ({ label: formatDate(w.at, { day: "numeric", month: "short" }), value: w.count, sub: "applicants" }))}
                height={210}
                max={Math.max(4, ...weeks.map((w) => w.count)) * 1.25}
              />
            </div>
          </Card>
        </Reveal>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Reveal className="min-w-0">
          <Card className="h-full p-6">
            <CardHeader icon={TrendingUp} title="Pipeline conversion" subtitle="How far candidates get" />
            <ul className="mt-5 space-y-3.5">
              {conversion.map((c, i) => (
                <li key={c.stage} className="animate-fade-in-up" style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="font-medium text-stone-600">{c.stage}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-ink">
                      {c.count} <span className="font-normal text-stone-400">{Math.round((c.count / top) * 100)}%</span>
                    </span>
                  </div>
                  <ProgressBar value={(c.count / top) * 100} tone={c.stage === "Offer" ? "bg-emerald-500" : "bg-brand"} />
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>

        <Reveal delay={80} className="min-w-0">
          <Card className="h-full p-6">
            <CardHeader icon={Users} title="CV match spread" subtitle="How well applicants fit your requirements" />
            <ul className="mt-5 space-y-3.5">
              {[
                { label: "Strong (70+)", min: 70, max: 101 },
                { label: "Developing (55–69)", min: 55, max: 70 },
                { label: "Weak (under 55)", min: 0, max: 55 },
              ].map((b, i) => {
                const count = applicants.filter((a) => a.cvScore >= b.min && a.cvScore < b.max).length;
                return (
                  <li key={b.label} className="animate-fade-in-up" style={{ animationDelay: `${i * 60}ms` }}>
                    <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
                      <span className="font-medium text-stone-600">{b.label}</span>
                      <span className="font-semibold tabular-nums text-ink">{count}</span>
                    </div>
                    <ProgressBar value={(count / applicants.length) * 100} tone={scoreTone(b.min + 5).bar} />
                  </li>
                );
              })}
            </ul>
          </Card>
        </Reveal>

        <Reveal delay={120} className="min-w-0">
          <Card className="h-full p-6">
            <CardHeader icon={Briefcase} title="Applicants by role" subtitle="Which roles attract interest" />
            <Bars rows={byJob} total={applicants.length} tone="bg-ink" />
          </Card>
        </Reveal>

        <Reveal delay={160} className="min-w-0">
          <Card className="h-full p-6">
            <CardHeader icon={Users} title="Where they came from" subtitle="Application source" />
            <Bars rows={bySource} total={applicants.length} />
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
