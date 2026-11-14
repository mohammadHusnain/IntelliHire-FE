// Shared pieces of the platform admin panel (Module 13).
import { AlertTriangle, Flag, Loader2 } from "lucide-react";
import { Badge, Card } from "@/components/app/primitives";
import {
  eventTypeLabel,
  flagActionLabel,
  flagSourceLabel,
  flagStatusLabel,
  flagStatusTone,
  flagTargetLabel,
  okLabel,
  okTone,
  percentText,
} from "@/lib/platformMap";
import { formatDate, relativeTime } from "@/lib/candidateStats";

export function Loading({ label }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-stone-500">
      <Loader2 size={18} className="animate-spin text-brand" /> <span>{label}</span>
    </div>
  );
}

export function InlineError({ message, onRetry }) {
  return (
    <div role="alert" className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-[12.5px] text-red-800">
      <span className="min-w-0 flex-1">{message}</span>
      {onRetry && <button type="button" onClick={onRetry} className="font-semibold underline">Retry</button>}
    </div>
  );
}

export function ErrorPanel({ message, onRetry }) {
  return (
    <Card className="p-6">
      <div role="alert" className="py-8 text-center">
        <p className="text-[14px] text-stone-600">{message}</p>
        <button type="button" onClick={onRetry} className="btn-secondary mt-4">Try again</button>
      </div>
    </Card>
  );
}

/** Counts keyed by a server enum, rendered in a readable row. Zero is a real answer. */
export function CountRow({ title, counts = {}, labelOf = (key) => key }) {
  const entries = Object.entries(counts);
  return (
    <div>
      <p className="text-[12px] font-semibold uppercase tracking-wide text-stone-400">{title}</p>
      {entries.length === 0 ? (
        <p className="mt-1.5 text-[12.5px] text-stone-500">Nothing yet.</p>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {entries.map(([key, value]) => (
            <Badge key={key} tone="neutral">{labelOf(key)}: <span className="tabular-nums">{value}</span></Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function FlagStatusBadge({ status }) {
  return <Badge tone={flagStatusTone(status)}>{flagStatusLabel(status)}</Badge>;
}

/** The open flags the server attaches to a user, company, job or community detail. */
export function OpenFlags({ flags = [] }) {
  if (!flags.length) return <p className="text-[12.5px] text-stone-500">No open flags.</p>;
  return (
    <ul className="space-y-2">
      {flags.map((flag) => (
        <li key={flag.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="warning">{flagStatusLabel(flag.status)}</Badge>
            <span className="text-[11.5px] text-amber-900">{flagSourceLabel(flag.source)} · {relativeTime(flag.created_at)}</span>
          </div>
          <p className="mt-1.5 text-[12.5px] text-amber-900">{flag.reason}</p>
        </li>
      ))}
    </ul>
  );
}

export function FlagSummary({ flag }) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="neutral">{flagTargetLabel(flag.targetType)}</Badge>
        <FlagStatusBadge status={flag.status} />
        {flagActionLabel(flag.actionTaken) && <Badge tone="success">{flagActionLabel(flag.actionTaken)}</Badge>}
      </div>
      <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-stone-700">{flag.reason}</p>
      <p className="mt-1.5 text-[11.5px] text-stone-400">
        {flagSourceLabel(flag.source)}
        {flag.reportedBy ? ` · ${flag.reportedBy}` : ""} · raised {relativeTime(flag.createdAt)}
      </p>
      {flag.resolutionNote && (
        <p className="mt-2 rounded-xl bg-stone-50 p-3 text-[12.5px] text-stone-600">
          {flag.resolutionNote}
          {flag.resolvedBy ? <span className="mt-1 block text-[11.5px] text-stone-400">{flag.resolvedBy} · {formatDate(flag.resolvedAt)}</span> : null}
        </p>
      )}
    </div>
  );
}

export function ActivityRow({ event, onOpen }) {
  return (
    <tr className="transition-colors hover:bg-stone-50">
      <td className="px-4 py-3">
        <p className="font-semibold text-ink">{eventTypeLabel(event.eventType)}</p>
        <p className="truncate text-[11.5px] text-stone-500">{event.summary}</p>
      </td>
      <td className="px-4 py-3 text-stone-600">{event.actor?.name || <span className="text-stone-400">System</span>}</td>
      <td className="px-4 py-3 text-stone-600">{event.targetType ? flagTargetLabel(event.targetType) : <span className="text-stone-400">—</span>}</td>
      <td className="whitespace-nowrap px-4 py-3 text-stone-600">{formatDate(event.createdAt)}</td>
      <td className="px-4 py-3 text-right">
        <button type="button" onClick={onOpen} className="btn-secondary !h-8 !px-2.5 text-[11.5px]">Open</button>
      </td>
    </tr>
  );
}

/** One line of the health report. `ok` false is shown as plainly as true. */
export function HealthLine({ label, ok, detail }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-[13px] text-stone-600">{label}</span>
      <span className="flex items-center gap-2">
        {detail && <span className="text-[11.5px] text-stone-400">{detail}</span>}
        <Badge tone={okTone(ok)}>{okLabel(ok)}</Badge>
      </span>
    </div>
  );
}

export function ResourceLine({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-[13px] text-stone-600">{label}</span>
      <span className="text-[13px] font-semibold tabular-nums text-ink">{percentText(value)}</span>
    </div>
  );
}

export function BackupWarning({ backup }) {
  if (!backup?.warning) return null;
  return (
    <p className="mt-3 flex items-start gap-2 text-[12.5px] text-amber-800">
      <AlertTriangle size={14} className="mt-0.5 shrink-0" /> <span>{backup.warning}</span>
    </p>
  );
}

export function FlagForReviewButton({ onClick, label = "Flag for review" }) {
  return (
    <button type="button" onClick={onClick} className="btn-secondary !h-9 text-[12.5px]">
      <Flag size={14} /> {label}
    </button>
  );
}
