import { useMemo, useState } from "react";
import { BarChart3, Briefcase, Building2, Download, Mic, Printer, TrendingUp, Users } from "lucide-react";
import { Card, CardHeader, EmptyState, PageHeader, ProgressBar, Segmented, StatTile, TrendChart } from "@/components/app/primitives";
import Reveal from "@/components/shared/Reveal";
import { useCandidateStore } from "@/store/candidateStore";
import { useCommunityStore } from "@/store/communityStore";
import { groupCount, platformStats, scoreDistribution } from "@/lib/adminStats";
import { DIMENSION_LABEL } from "@/lib/interview/evaluate";
import { TYPE_LABEL, formatDate, scoreTone } from "@/lib/candidateStats";
import { downloadFile, toCsv } from "@/lib/csv";
import { toast } from "@/store/toastStore";

const RANGES = [
  { value: 28, label: "4 weeks" },
  { value: 56, label: "8 weeks" },
  { value: 84, label: "12 weeks" },
];

const METRICS = [
  { value: "signups", label: "Sign-ups" },
  { value: "interviews", label: "Interviews" },
];

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

export default function AdminReports() {
  const [days, setDays] = useState(56);
  const [metric, setMetric] = useState("signups");
  const records = useCandidateStore((s) => s.records);
  const catalogue = useCommunityStore((s) => s.catalogue);

  const stats = useMemo(() => {
    void records;
    void catalogue;
    return platformStats(days);
  }, [days, records, catalogue]);

  const { totals, sessions, accounts, weeks } = stats;
  const hasPractice = sessions.length > 0;

  const distribution = useMemo(() => scoreDistribution(sessions), [sessions]);
  const roles = useMemo(() => groupCount(sessions, "role").slice(0, 6), [sessions]);
  const types = useMemo(() => groupCount(sessions, (s) => TYPE_LABEL[s.type]), [sessions]);
  const dimensions = useMemo(() => {
    if (!sessions.length) return [];
    return Object.keys(DIMENSION_LABEL).map((k) => ({
      key: k,
      label: DIMENSION_LABEL[k],
      value: Math.round(sessions.reduce((n, s) => n + s.summary.breakdown[k], 0) / sessions.length),
    }));
  }, [sessions]);

  const funnel = useMemo(() => {
    const companies = accounts.filter((a) => a.role === "company");
    return {
      registered: companies.length,
      approved: companies.filter((c) => c.status === "active").length,
      pending: companies.filter((c) => c.status === "pending").length,
      rejected: companies.filter((c) => c.status === "rejected").length,
    };
  }, [accounts]);

  const chartPoints = weeks.map((w) => ({
    label: formatDate(w.at, { day: "numeric", month: "short" }),
    value: metric === "signups" ? w.signups : w.interviews,
    sub: metric === "signups" ? `${w.candidates} candidates · ${w.companies} companies` : "interviews",
  }));
  const chartMax = Math.max(5, ...chartPoints.map((p) => p.value)) * 1.2;

  const exportSummary = () => {
    const headers = ["Metric", "Value"];
    const data = [
      ["Accounts", totals.accounts], ["Candidates", totals.candidates], ["Companies", totals.companies],
      ["Interviews", totals.interviews], ["Average score", totals.avgScore], ["Open roles", totals.openJobs],
      ["Active communities", totals.communities],
      ["Companies registered", funnel.registered], ["Companies approved", funnel.approved],
      ["Companies pending", funnel.pending], ["Companies rejected", funnel.rejected],
      ...dimensions.map((d) => [`Average ${d.label.toLowerCase()}`, d.value]),
      ...roles.map((r) => [`Interviews · ${r.label}`, r.count]),
    ];
    const name = `intellihire-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadFile(name, toCsv(headers, data));
    toast({ title: "Analytics exported", message: `Summary saved to ${name}.` });
  };

  const exportWeekly = () => {
    const headers = ["Week starting", "Sign-ups", "Candidates", "Companies", "Interviews"];
    const data = weeks.map((w) => [new Date(w.at).toISOString().slice(0, 10), w.signups, w.candidates, w.companies, w.interviews]);
    const name = `intellihire-weekly-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadFile(name, toCsv(headers, data));
    toast({ title: "Weekly data exported", message: `${data.length} weeks saved to ${name}.` });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analytics"
        title={<>Platform <em>analytics</em></>}
        subtitle="Computed from real accounts, interviews and approvals. Nothing here is sample data."
        actions={
          <>
            <button type="button" onClick={exportSummary} className="btn-secondary">
              <Download size={16} /> Export CSV
            </button>
            <button type="button" onClick={() => window.print()} className="btn-primary">
              <Printer size={16} /> Print / PDF
            </button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Segmented ariaLabel="Date range" value={days} onChange={setDays} options={RANGES} />
        <p className="text-[13px] text-stone-500">Trend window for the chart below</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={Users} label="Accounts" value={totals.accounts} hint={`${totals.candidates} candidates · ${totals.companies} companies`} />
        <StatTile icon={Mic} label="Interviews" value={totals.interviews} hint="practice sessions" delay={60} />
        <StatTile icon={TrendingUp} label="Average score" value={totals.avgScore} suffix="/100" delay={120} />
        <StatTile icon={Briefcase} label="Open roles" value={totals.openJobs} hint={`${totals.communities} communities`} delay={180} />
      </div>

      <Reveal>
        <Card className="p-6">
          <CardHeader
            icon={TrendingUp}
            title="Growth"
            subtitle="Per week"
            action={
              <div className="flex items-center gap-2 print:hidden">
                <Segmented size="sm" ariaLabel="Metric" value={metric} onChange={setMetric} options={METRICS} />
                <button type="button" onClick={exportWeekly} aria-label="Export weekly CSV" className="icon-btn flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] text-stone-500 hover:text-ink">
                  <Download size={15} />
                </button>
              </div>
            }
          />
          <div className="mt-6">
            <TrendChart key={`${metric}-${days}`} points={chartPoints} height={230} max={chartMax} />
          </div>
        </Card>
      </Reveal>

      {hasPractice ? (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Reveal className="min-w-0">
              <Card className="h-full p-6">
                <CardHeader icon={BarChart3} title="Score distribution" subtitle={`${sessions.length} interviews scored`} />
                <ul className="mt-5 space-y-3.5">
                  {distribution.map((b, i) => (
                    <li key={b.label} className="animate-fade-in-up" style={{ animationDelay: `${i * 60}ms` }}>
                      <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
                        <span className="font-medium text-stone-600">{b.label}</span>
                        <span className="font-semibold tabular-nums text-ink">{b.count}</span>
                      </div>
                      <ProgressBar value={sessions.length ? (b.count / sessions.length) * 100 : 0} tone={scoreTone(b.min + 5).bar} />
                    </li>
                  ))}
                </ul>
              </Card>
            </Reveal>

            <Reveal delay={80} className="min-w-0">
              <Card className="h-full p-6">
                <CardHeader icon={TrendingUp} title="Average by skill" subtitle="Across every interview on the platform" />
                <ul className="mt-5 space-y-3.5">
                  {dimensions.map((d, i) => (
                    <li key={d.key} className="animate-fade-in-up" style={{ animationDelay: `${i * 60}ms` }}>
                      <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
                        <span className="font-medium text-stone-600">{d.label}</span>
                        <span className="font-semibold tabular-nums text-ink">{d.value}/100</span>
                      </div>
                      <ProgressBar value={d.value} tone={scoreTone(d.value).bar} />
                    </li>
                  ))}
                </ul>
              </Card>
            </Reveal>

            <Reveal delay={120} className="min-w-0">
              <Card className="h-full p-6">
                <CardHeader icon={Mic} title="Most practised roles" subtitle="Where candidates spend their time" />
                <Bars rows={roles} total={sessions.length} tone="bg-ink" />
              </Card>
            </Reveal>

            <Reveal delay={160} className="min-w-0">
              <Card className="h-full p-6">
                <CardHeader icon={BarChart3} title="Interview types" subtitle="Mix of practice formats" />
                <Bars rows={types} total={sessions.length} />
              </Card>
            </Reveal>
          </div>
        </>
      ) : (
        <EmptyState
          icon={Mic}
          title="No interview data yet"
          message="Score distribution, skill averages and role breakdowns appear once candidates complete practice interviews on this device."
        />
      )}

      <Reveal>
        <Card className="p-6">
          <CardHeader icon={Building2} title="Company approval funnel" subtitle="From registration to decision" />
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: "Registered", value: funnel.registered, tone: "text-ink" },
              { label: "Approved", value: funnel.approved, tone: "text-emerald-600" },
              { label: "Awaiting decision", value: funnel.pending, tone: "text-amber-600" },
              { label: "Rejected", value: funnel.rejected, tone: "text-red-600" },
            ].map((f, i) => (
              <div key={f.label} className="animate-fade-in-up rounded-2xl border border-[var(--line)] bg-stone-50/60 p-4" style={{ animationDelay: `${i * 60}ms` }}>
                <p className={`font-display text-[30px] font-medium leading-none tabular-nums ${f.tone}`}>{f.value}</p>
                <p className="mt-2 text-[12.5px] text-stone-500">{f.label}</p>
              </div>
            ))}
          </div>
          {funnel.registered > 0 && (
            <p className="mt-5 text-[13px] text-stone-500">
              <span className="font-semibold text-ink">{Math.round((funnel.approved / funnel.registered) * 100)}%</span> of employers that registered have been approved.
            </p>
          )}
        </Card>
      </Reveal>

      <p className="text-center text-[12px] text-stone-400">
        Interview figures come from practice data stored on this device. Account and approval figures cover every registered account.
      </p>
    </div>
  );
}
