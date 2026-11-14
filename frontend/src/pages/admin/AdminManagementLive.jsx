// The activity log (Module 13, FR-76 / TC-46). Read-only by design: it can be filtered, read and
// exported, never written to. An entry can be flagged, which points a moderation flag at its target.
import { useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2, RefreshCw, ScrollText, SearchX } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, StatTile } from "@/components/app/primitives";
import { Drawer, SearchField } from "@/components/admin/primitives";
import { ActivityRow, ErrorPanel, InlineError, Loading } from "@/components/admin/platformParts";
import { platformAdminApi } from "@/api/platformAdminApi";
import { useDebounced } from "@/hooks/useDebounced";
import { useRemote } from "@/hooks/useRemote";
import { REASON_MAX, eventTypeLabel, flagTargetLabel, mapActivityEvent, reasonError } from "@/lib/platformMap";
import { saveBlob } from "@/lib/download";
import { formatDate } from "@/lib/candidateStats";
import { toast } from "@/store/toastStore";

const PAGE_SIZE = 20;

export default function AdminManagementLive() {
  const [eventType, setEventType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [openId, setOpenId] = useState("");
  const [exporting, setExporting] = useState(false);
  const typed = useDebounced(eventType);
  const filters = { eventType: typed.trim(), from, to };
  const list = useRemote((o) => platformAdminApi.activity({ ...filters, page, pageSize: PAGE_SIZE }, o), [JSON.stringify(filters), page, version]);
  const reset = (setter) => (value) => { setter(value); setPage(1); };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { blob, filename } = await platformAdminApi.exportActivity(filters);
      saveBlob(blob, filename || "activity.csv");
      toast({ title: "Activity exported", message: "The server caps the file at 5000 rows." });
    } catch (problem) {
      toast({ type: "error", title: "Export failed", message: problem.message });
    } finally {
      setExporting(false);
    }
  };

  if (list.status === "error" && !list.data) return <ErrorPanel message={list.error.message} onRetry={list.reload} />;
  const rows = (list.data?.results || []).map(mapActivityEvent);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title={<>Activity <em>log</em></>}
        subtitle="Everything that happened, with the actor and the time. Read-only."
        actions={
          <>
            <button type="button" onClick={exportCsv} disabled={exporting} className="btn-secondary disabled:opacity-50">
              {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Export CSV
            </button>
            <button type="button" onClick={() => setVersion((v) => v + 1)} aria-label="Refresh the log" className="icon-btn flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] text-stone-500 hover:bg-stone-50"><RefreshCw size={16} /></button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={ScrollText} label="Entries matching" value={list.data?.count ?? "—"} />
      </div>

      <div className="flex flex-col gap-2 lg:flex-row">
        <SearchField value={eventType} onChange={reset(setEventType)} placeholder="Event type, e.g. company.approved" className="flex-1" />
        <label className="flex items-center gap-1.5 text-[12.5px] text-stone-500">From <input type="date" aria-label="From" value={from} onChange={(e) => reset(setFrom)(e.target.value)} className="h-11 rounded-xl border border-[var(--line)] bg-white px-3 text-[13px]" /></label>
        <label className="flex items-center gap-1.5 text-[12.5px] text-stone-500">to <input type="date" aria-label="To" value={to} onChange={(e) => reset(setTo)(e.target.value)} className="h-11 rounded-xl border border-[var(--line)] bg-white px-3 text-[13px]" /></label>
      </div>

      {list.status === "loading" && !list.data ? (
        <Loading label="Loading the log" />
      ) : rows.length === 0 ? (
        <EmptyState icon={SearchX} title="No activity for these filters" message="Clear the filters or widen the dates." action={<button type="button" onClick={() => { setEventType(""); setFrom(""); setTo(""); setPage(1); }} className="btn-secondary">Clear filters</button>} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="border-b border-[var(--line)] bg-stone-50/70 text-[11px] font-semibold uppercase text-stone-500">
                <tr><th className="px-4 py-3">Event</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Target</th><th className="px-4 py-3">When</th><th className="px-4 py-3"></th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {rows.map((event) => <ActivityRow key={event.id} event={event} onOpen={() => setOpenId(event.id)} />)}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-3 text-[12.5px] text-stone-500">
            <span>{list.data.count} entr{list.data.count === 1 ? "y" : "ies"}</span>
            <div className="flex items-center gap-3">
              <button type="button" aria-label="Previous page" onClick={() => setPage((v) => Math.max(1, v - 1))} disabled={page <= 1} className="icon-btn flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] disabled:opacity-40"><ChevronLeft size={16} /></button>
              <span>Page {page}</span>
              <button type="button" aria-label="Next page" onClick={() => setPage((v) => v + 1)} disabled={!list.data.hasNext} className="icon-btn flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] disabled:opacity-40"><ChevronRight size={16} /></button>
            </div>
          </div>
        </Card>
      )}
      {list.status === "error" && <InlineError message={list.error.message} onRetry={list.reload} />}
      {openId && <EventDrawer eventId={openId} onClose={() => setOpenId("")} onFlagged={() => setVersion((v) => v + 1)} />}
    </div>
  );
}

function EventDrawer({ eventId, onClose, onFlagged }) {
  const detail = useRemote((o) => platformAdminApi.activityEvent(eventId, o), [eventId]);
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const event = detail.data ? mapActivityEvent(detail.data) : null;

  const flag = async () => {
    const problem = reasonError(reason);
    if (problem) return setError(problem);
    setBusy(true);
    setError("");
    try {
      await platformAdminApi.flagActivity(eventId, reason.trim());
      toast({ title: "Flagged for review", message: "A flag now points at what this entry is about." });
      setOpen(false);
      setReason("");
      onFlagged();
    } catch (problem2) {
      setError(problem2.code === "no_target" ? "This entry does not point at anything that can be flagged." : problem2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer title={event ? eventTypeLabel(event.eventType) : "Event"} subtitle={event?.summary} onClose={onClose}>
      {detail.status === "loading" && !event ? <Loading label="Loading the entry" /> : detail.status === "error" ? <InlineError message={detail.error.message} onRetry={detail.reload} /> : event ? (
        <div className="space-y-5">
          <dl className="divide-y divide-[var(--line)] text-[13px]">
            {[
              ["Actor", event.actor?.name || "System"],
              ["Target", event.targetType ? `${flagTargetLabel(event.targetType)} ${event.targetId || ""}`.trim() : "—"],
              ["When", formatDate(event.createdAt)],
            ].map(([key, value]) => (
              <div key={key} className="flex justify-between gap-3 py-2"><dt className="text-stone-500">{key}</dt><dd className="min-w-0 truncate text-right font-medium text-ink">{value}</dd></div>
            ))}
          </dl>
          {event.metadata && Object.keys(event.metadata).length > 0 && (
            <section>
              <h3 className="text-[12.5px] font-semibold text-ink">Metadata</h3>
              <pre className="mt-2 overflow-x-auto rounded-xl bg-stone-50 p-3 text-[11.5px] leading-relaxed text-stone-600">{JSON.stringify(event.metadata, null, 2)}</pre>
            </section>
          )}
          <p className="text-[11.5px] text-stone-500">The log is append-only: nothing here can be edited or deleted.</p>
          {event.targetType ? (
            open ? (
              <div className="rounded-xl border border-[var(--line)] p-3">
                <label className="block text-[12px] font-semibold text-stone-600">
                  Why does this need review?
                  <textarea value={reason} rows={3} maxLength={REASON_MAX} onChange={(e) => { setReason(e.target.value); setError(""); }} className="field mt-1.5 !h-auto py-2.5" autoFocus />
                </label>
                {error && <p role="alert" className="mt-1 text-[12px] text-red-700">{error}</p>}
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={flag} disabled={busy} className="btn-primary !h-9 text-[12.5px] disabled:opacity-50">Raise flag</button>
                  <button type="button" onClick={() => { setOpen(false); setError(""); }} className="btn-secondary !h-9 text-[12.5px]">Cancel</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setOpen(true)} className="btn-secondary !h-9 text-[12.5px]">Flag for review</button>
            )
          ) : (
            <Badge tone="neutral">Nothing to flag: this entry points at no object</Badge>
          )}
        </div>
      ) : null}
    </Drawer>
  );
}
