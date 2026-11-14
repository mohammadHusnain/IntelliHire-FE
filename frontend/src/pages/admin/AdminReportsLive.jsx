// The AI usage report (Module 13 §13.2). Calls, failures, tokens and average latency per feature
// per day, from the request log. No rows is an answer, not an error.
import { useState } from "react";
import { BarChart3, RefreshCw, TrendingUp } from "lucide-react";
import { Card, CardHeader, EmptyState, PageHeader, StatTile } from "@/components/app/primitives";
import { ErrorPanel, InlineError, Loading } from "@/components/admin/platformParts";
import { platformAdminApi } from "@/api/platformAdminApi";
import { useRemote } from "@/hooks/useRemote";
import { eventTypeLabel } from "@/lib/platformMap";
import { formatDate } from "@/lib/candidateStats";

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

export default function AdminReportsLive() {
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(daysAgo(0));
  const [feature, setFeature] = useState("");
  const [version, setVersion] = useState(0);
  const report = useRemote((o) => platformAdminApi.aiUsage({ from, to, feature: feature.trim() }, o), [from, to, feature, version]);

  if (report.status === "error" && !report.data) return <ErrorPanel message={report.error.message} onRetry={report.reload} />;

  const rows = report.data?.results || report.data || [];
  const totals = rows.reduce(
    (sum, row) => ({
      calls: sum.calls + (row.calls || 0),
      failures: sum.failures + (row.failures || 0),
      tokens: sum.tokens + (row.prompt_tokens || 0) + (row.completion_tokens || 0),
      latency: sum.latency + (row.average_latency_ms || 0) * (row.calls || 0),
    }),
    { calls: 0, failures: 0, tokens: 0, latency: 0 },
  );
  const averageLatency = totals.calls ? Math.round(totals.latency / totals.calls) : 0;
  const features = [...new Set(rows.map((row) => row.feature))];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title={<>AI <em>usage</em></>}
        subtitle="What the models were asked to do, counted from the request log. The platform keeps no other report."
        actions={
          <button type="button" onClick={() => setVersion((v) => v + 1)} aria-label="Refresh the report" className="icon-btn flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] text-stone-500 hover:bg-stone-50">
            <RefreshCw size={16} />
          </button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <label className="flex items-center gap-1.5 text-[12.5px] text-stone-500">From <input type="date" aria-label="From" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-11 rounded-xl border border-[var(--line)] bg-white px-3 text-[13px]" /></label>
        <label className="flex items-center gap-1.5 text-[12.5px] text-stone-500">to <input type="date" aria-label="To" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="h-11 rounded-xl border border-[var(--line)] bg-white px-3 text-[13px]" /></label>
        <label>
          <span className="sr-only">Feature</span>
          <select value={feature} onChange={(e) => setFeature(e.target.value)} className="h-11 cursor-pointer rounded-xl border border-[var(--line)] bg-white px-3 text-[13px] font-semibold text-stone-600">
            <option value="">Every feature</option>
            {features.map((name) => <option key={name} value={name}>{eventTypeLabel(name)}</option>)}
          </select>
        </label>
      </div>
      {from > to && <p role="alert" className="text-[12.5px] text-amber-700">The start date is after the end date, so nothing can match.</p>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={BarChart3} label="Calls" value={totals.calls} />
        <StatTile icon={TrendingUp} label="Failures" value={totals.failures} hint={totals.calls ? `${Math.round((totals.failures / totals.calls) * 100)}% of calls` : undefined} delay={60} />
        <StatTile icon={BarChart3} label="Tokens" value={totals.tokens} delay={120} />
        <StatTile icon={TrendingUp} label="Average latency" value={averageLatency} suffix=" ms" delay={180} />
      </div>

      {report.status === "loading" && !report.data ? (
        <Loading label="Loading the AI usage report" />
      ) : rows.length === 0 ? (
        <EmptyState icon={BarChart3} title="No AI calls in this range" message="Nothing was asked of a model between these dates, so there is nothing to report." />
      ) : (
        <Card className="overflow-hidden">
          <div className="p-5 pb-0">
            <CardHeader icon={BarChart3} title="Per feature, per day" subtitle="Straight from the request log." />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-[13px]">
              <thead className="border-y border-[var(--line)] bg-stone-50/70 text-[11px] font-semibold uppercase text-stone-500">
                <tr>
                  <th className="px-4 py-3">Day</th><th className="px-4 py-3">Feature</th>
                  <th className="px-4 py-3 text-right">Calls</th><th className="px-4 py-3 text-right">Failures</th>
                  <th className="px-4 py-3 text-right">Tokens</th><th className="px-4 py-3 text-right">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {rows.map((row, index) => (
                  <tr key={`${row.day}-${row.feature}-${index}`} className="transition-colors hover:bg-stone-50">
                    <td className="whitespace-nowrap px-4 py-3 text-stone-600">{formatDate(row.day)}</td>
                    <td className="px-4 py-3 font-medium text-ink">{eventTypeLabel(row.feature)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-stone-600">{row.calls ?? 0}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${row.failures ? "text-red-700" : "text-stone-600"}`}>{row.failures ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-stone-600">{(row.prompt_tokens ?? 0) + (row.completion_tokens ?? 0)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-stone-600">{row.average_latency_ms ?? 0} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {report.status === "error" && <InlineError message={report.error.message} onRetry={report.reload} />}
    </div>
  );
}
