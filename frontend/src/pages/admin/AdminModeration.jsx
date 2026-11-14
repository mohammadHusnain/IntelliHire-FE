// The moderation queue (Module 13, FR-76). Flags raised by reports, by an admin or by the system.
// Resolving one always needs a note; "take action" reuses the existing service for that object,
// and a flag whose target is already gone can only be dismissed.
import { useState } from "react";
import { ChevronLeft, ChevronRight, Flag, RefreshCw, ShieldCheck } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, PageHeader, StatTile } from "@/components/app/primitives";
import { Tabs } from "@/components/admin/primitives";
import { ErrorPanel, FlagStatusBadge, FlagSummary, InlineError, Loading } from "@/components/admin/platformParts";
import { platformAdminApi } from "@/api/platformAdminApi";
import { useRemote } from "@/hooks/useRemote";
import {
  FLAG_STATUS_FILTERS,
  FLAG_TARGETS,
  NOTE_MAX,
  actionConsequence,
  flagStatusLabel,
  flagTargetLabel,
  mapFlag,
  noteError,
} from "@/lib/platformMap";
import { toast } from "@/store/toastStore";

const PAGE_SIZE = 20;

export default function AdminModeration() {
  const [status, setStatus] = useState("open");
  const [targetType, setTargetType] = useState("");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [open, setOpen] = useState(null);
  const queue = useRemote((o) => platformAdminApi.moderation({ status, targetType, page, pageSize: PAGE_SIZE }, o), [status, targetType, page, version]);

  if (queue.status === "error" && !queue.data) return <ErrorPanel message={queue.error.message} onRetry={queue.reload} />;

  const rows = (queue.data?.results || []).map(mapFlag);
  const refresh = () => setVersion((v) => v + 1);
  const reset = (setter) => (value) => { setter(value); setPage(1); setOpen(null); };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title={<>Moderation <em>queue</em></>}
        subtitle="Reports and flags, with the action recorded against whoever resolved them."
        actions={
          <button type="button" onClick={refresh} aria-label="Refresh the queue" className="icon-btn flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] text-stone-500 hover:bg-stone-50">
            <RefreshCw size={16} />
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={Flag} label={flagStatusLabel(status)} value={queue.data?.count ?? "—"} />
      </div>

      <Tabs value={status} onChange={reset(setStatus)} options={FLAG_STATUS_FILTERS.map((value) => ({ value, label: flagStatusLabel(value) }))} />

      <label>
        <span className="sr-only">Target type</span>
        <select value={targetType} onChange={(e) => reset(setTargetType)(e.target.value)} className="h-11 cursor-pointer rounded-xl border border-[var(--line)] bg-white px-3 text-[13px] font-semibold text-stone-600">
          <option value="">Anything</option>
          {FLAG_TARGETS.map((target) => <option key={target.value} value={target.value}>{target.label}</option>)}
        </select>
      </label>

      {queue.status === "loading" && !queue.data ? (
        <Loading label="Loading the queue" />
      ) : rows.length === 0 ? (
        <EmptyState icon={ShieldCheck} title={status === "open" ? "Nothing to moderate" : "Nothing here"} message={status === "open" ? "No report or flag is waiting on a decision." : `No flag is ${flagStatusLabel(status).toLowerCase()}.`} />
      ) : (
        <div className="space-y-3">
          {rows.map((flag) => (
            <Card key={flag.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <FlagSummary flag={flag} />
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {flag.target?.label && <span className="max-w-[220px] truncate text-[12.5px] font-semibold text-ink">{flag.target.label}</span>}
                  <button type="button" onClick={() => setOpen(flag)} className="btn-secondary !h-9 text-[12.5px]">
                    {["open", "reviewing"].includes(flag.status) ? "Review" : "Details"}
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {queue.data && rows.length > 0 && (
        <div className="flex items-center justify-between gap-3 text-[12.5px] text-stone-500">
          <span>{queue.data.count} flag{queue.data.count === 1 ? "" : "s"}</span>
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Previous page" onClick={() => setPage((v) => Math.max(1, v - 1))} disabled={page <= 1} className="icon-btn flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] disabled:opacity-40"><ChevronLeft size={16} /></button>
            <span>Page {page}</span>
            <button type="button" aria-label="Next page" onClick={() => setPage((v) => v + 1)} disabled={!queue.data.hasNext} className="icon-btn flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] disabled:opacity-40"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {queue.status === "error" && <InlineError message={queue.error.message} onRetry={queue.reload} />}
      {open && <ResolvePanel flag={open} onClose={() => setOpen(null)} onDone={() => { setOpen(null); refresh(); }} />}
    </div>
  );
}

/**
 * Review then resolve. The server takes only `dismiss` or `act` and works out what "act" means
 * from the target, so the dialog says the consequence in words. A missing target allows dismiss only.
 */
function ResolvePanel({ flag, onClose, onDone }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const gone = flag.target === null;
  const decided = ["dismissed", "actioned"].includes(flag.status);

  const review = async () => {
    setBusy("review");
    setError("");
    try {
      await platformAdminApi.review(flag.id);
      toast({ title: "Marked as being reviewed" });
      onDone();
    } catch (problem) {
      setError(problem.status === 409 ? "Another admin is already reviewing this flag." : problem.message);
    } finally {
      setBusy("");
    }
  };

  const resolve = async (action) => {
    const problem = noteError(note);
    if (problem) return setError(problem);
    setBusy(action);
    setError("");
    try {
      await platformAdminApi.resolve(flag.id, { note: note.trim(), action });
      toast({
        title: action === "act" ? "Resolved and acted on" : "Dismissed",
        message: action === "act" ? "The action was recorded against your account." : "No action was taken.",
      });
      onDone();
    } catch (problem2) {
      setError(problem2.field?.("note") || problem2.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <Card className="p-5">
      <CardHeader icon={Flag} title={`${flagTargetLabel(flag.targetType)} flag`} subtitle={decided ? "Already resolved." : "Decide what happens, and say why."} />
      <div className="mt-4 space-y-4">
        <FlagSummary flag={flag} />
        {gone && <p className="rounded-xl bg-amber-50 p-3 text-[12.5px] text-amber-900">What this flag points at no longer exists, so it can only be dismissed.</p>}
        {!decided && (
          <>
            {flag.status === "open" && (
              <button type="button" disabled={Boolean(busy)} onClick={review} className="btn-secondary !h-9 text-[12.5px] disabled:opacity-50">
                Mark as reviewing
              </button>
            )}
            <label className="block text-[12.5px] font-semibold text-stone-600">
              Resolution note (required)
              <textarea value={note} rows={3} maxLength={NOTE_MAX} onChange={(e) => { setNote(e.target.value); setError(""); }} className="field mt-1.5 !h-auto py-2.5" placeholder="What you decided and why." />
            </label>
            {error && <p role="alert" className="text-[12.5px] text-red-700">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={Boolean(busy)} onClick={() => resolve("dismiss")} className="btn-secondary disabled:opacity-50">Dismiss</button>
              {!gone && (
                <button type="button" disabled={Boolean(busy)} onClick={() => resolve("act")} className="btn-dark !bg-red-600 hover:!bg-red-700 disabled:opacity-50">
                  Take action — {actionConsequence(flag.targetType)}
                </button>
              )}
              <button type="button" onClick={onClose} className="ml-auto text-[12.5px] font-semibold text-stone-500 hover:text-ink">Close</button>
            </div>
          </>
        )}
        {decided && (
          <div className="flex items-center gap-2">
            <FlagStatusBadge status={flag.status} />
            <Badge tone="neutral">Nothing further to do</Badge>
            <button type="button" onClick={onClose} className="ml-auto text-[12.5px] font-semibold text-stone-500 hover:text-ink">Close</button>
          </div>
        )}
      </div>
    </Card>
  );
}
