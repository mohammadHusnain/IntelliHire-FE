import { useCallback, useState } from "react";
import { jobsApi } from "@/api/jobsApi";
import { toast } from "@/store/toastStore";

/**
 * Publish, close, reopen, duplicate and delete for the job list and the job page.
 * Each action disables itself while it runs, reports the server's own message when it is refused, and calls
 * `onChanged()` so the screen re-reads the truth (a 409 means somebody else already changed the job).
 * Every action resolves to the new job (or true for delete), or to null when it failed.
 */
export function useJobActions({ onChanged }) {
  const [busy, setBusy] = useState(() => new Set());

  const run = useCallback(
    async (job, action, { done, refreshOnFail = true, quiet = false } = {}) => {
      if (busy.has(job.id)) return null;
      setBusy((s) => new Set(s).add(job.id));
      try {
        const result = await action();
        if (done) toast(done(result));
        onChanged?.(result);
        return result;
      } catch (error) {
        // `quiet`: the caller shows validation problems itself (next to the inputs), so no toast for a 400.
        if (!(quiet && error.status === 400)) toast({ type: error.status === 409 ? "warning" : "error", title: error.status === 409 ? "Nothing changed" : "Couldn't do that", message: error.fieldErrors?.deadline?.[0] || firstProblem(error) || error.message });
        if (refreshOnFail && (error.status === 409 || error.status === 404)) onChanged?.(null);
        return { error };
      } finally {
        setBusy((s) => {
          const next = new Set(s);
          next.delete(job.id);
          return next;
        });
      }
    },
    [busy, onChanged],
  );

  const isError = (r) => r && typeof r === "object" && "error" in r;

  return {
    busy,
    isError,
    publish: (job, { quiet = false } = {}) =>
      run(job, () => jobsApi.publish(job.id), {
        quiet,
        done: (j) => ({ title: "Role published", message: `${j.title} is now collecting applications.` }),
      }),
    close: (job) =>
      run(job, () => jobsApi.close(job.id), {
        done: (j) => ({ type: "info", title: "Role closed", message: `${j.title} no longer accepts applications.` }),
      }),
    reopen: (job, deadline) =>
      run(job, () => jobsApi.reopen(job.id, deadline), {
        done: (j) => ({ title: "Role reopened", message: `${j.title} accepts applications again.` }),
        refreshOnFail: false,
      }),
    duplicate: (job) =>
      run(job, () => jobsApi.duplicate(job.id), {
        done: (j) => ({ title: "Role duplicated", message: `${j.title} was saved as a draft.` }),
      }),
    remove: (job) =>
      run(job, async () => (await jobsApi.remove(job.id), true), {
        done: () => ({ type: "warning", title: "Role deleted", message: `${job.title} was removed.` }),
      }),
  };
}

/** The first line of a 400 keyed by field (for example a publish refusal), or "". */
function firstProblem(error) {
  const entries = Object.entries(error.fieldErrors || {});
  if (!entries.length) return "";
  const [, messages] = entries[0];
  const text = Array.isArray(messages) ? messages[0] : String(messages);
  return entries.length > 1 ? `${text} (and ${entries.length - 1} more to fix)` : text;
}
