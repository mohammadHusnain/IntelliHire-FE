import { useCallback, useEffect, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { notificationsApi } from "@/api/notificationsApi";
import { Toggle } from "@/components/app/primitives";

export default function LiveNotificationPreferences({ fields, sections }) {
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      setPreferences(await notificationsApi.getPreferences({ signal }));
    } catch (cause) {
      if (!signal?.aborted) setError(cause?.message || "Couldn't load notification preferences.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => !controller.signal.aborted && load(controller.signal));
    return () => controller.abort();
  }, [load]);

  const update = async (key, value) => {
    if (saving || !preferences) return;
    const previous = preferences;
    setPreferences({ ...previous, [key]: value });
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      setPreferences({ ...previous, ...(await notificationsApi.updatePreferences({ [key]: value })) });
      setSaved(true);
    } catch (cause) {
      setPreferences(previous);
      setError(cause?.message || "Couldn't save this preference.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p role="status" className="flex items-center gap-2 py-6 text-[13px] text-stone-500"><Loader2 size={16} className="animate-spin" /> Loading preferences…</p>;
  }

  if (error && !preferences) {
    return (
      <div className="py-4" role="alert">
        <p className="text-[13px] text-red-700">{error}</p>
        <button type="button" className="btn-secondary mt-3 !h-9 !px-3 text-[13px]" onClick={() => void load()}>
          <RotateCcw size={14} /> Retry
        </button>
      </div>
    );
  }

  return (
    <>
      {error && <p role="alert" className="mb-3 text-[13px] text-red-700">{error}</p>}
      {saved && <p role="status" className="mb-3 text-[12px] font-medium text-emerald-700">Saved</p>}
      {(sections || [{ fields }]).map((section, index) => (
        <div key={section.label || index} className={index ? "mt-6" : ""}>
          {section.label && <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-stone-400">{section.label}</p>}
          <ul className="divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">
            {section.fields.map((field) => (
              <li key={field.key} className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-ink">{field.title}</p>
                  <p className="mt-0.5 text-[13px] text-stone-500">{field.description}</p>
                </div>
                <Toggle checked={Boolean(preferences?.[field.key])} onChange={(value) => void update(field.key, value)} disabled={saving} label={field.title} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
