// AI settings and prompt versions (Module 13 §13.2). These are the only platform settings the
// server stores. API keys live in the environment and never pass through this screen.
import { useState } from "react";
import { Check, History, Loader2, RotateCcw, Settings, Sparkles } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/app/primitives";
import { Drawer, Tabs } from "@/components/admin/primitives";
import { ErrorPanel, InlineError, Loading } from "@/components/admin/platformParts";
import { platformAdminApi } from "@/api/platformAdminApi";
import { useRemote } from "@/hooks/useRemote";
import { AI_SETTING_FIELDS, aiSettingsChanges, eventTypeLabel } from "@/lib/platformMap";
import { formatDate } from "@/lib/candidateStats";
import { toast } from "@/store/toastStore";

export default function AdminSettingsLive() {
  const [tab, setTab] = useState("models");
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title={<>AI <em>settings</em></>}
        subtitle="Models, limits and the prompts behind screening, interviews and evaluation."
      />
      <Tabs value={tab} onChange={setTab} options={[{ value: "models", label: "Models and limits" }, { value: "prompts", label: "Prompts" }]} />
      {tab === "models" ? <ModelSettings /> : <Prompts />}
    </div>
  );
}

function ModelSettings() {
  const remote = useRemote((o) => platformAdminApi.aiSettings(o), []);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [general, setGeneral] = useState("");
  const base = remote.data;
  const values = draft ?? base;

  if (remote.status === "error" && !base) return <ErrorPanel message={remote.error.message} onRetry={remote.reload} />;
  if (!values) return <Loading label="Loading the AI settings" />;

  const changes = aiSettingsChanges(values, base);
  const dirty = Object.keys(changes).length > 0;

  const save = async () => {
    setBusy(true);
    setErrors({});
    setGeneral("");
    try {
      const saved = await platformAdminApi.updateAiSettings(changes);
      setDraft(null);
      remote.reload();
      toast({ title: "AI settings saved", message: `Recorded in the activity log. Provider: ${saved.provider}.` });
    } catch (problem) {
      const fieldErrors = {};
      for (const field of AI_SETTING_FIELDS) {
        const message = problem.field?.(field.key);
        if (message) fieldErrors[field.key] = message;
      }
      setErrors(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) setGeneral(problem.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="max-w-3xl p-6">
      <CardHeader icon={Settings} title="Models and limits" subtitle="A model outside the allowed list is refused by the server." />
      <p className="mt-3 rounded-xl bg-stone-50 p-3 text-[12px] leading-relaxed text-stone-500">
        API keys are not stored here and are never shown. They are read from the server's environment.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {AI_SETTING_FIELDS.map((field) => (
          <label key={field.key} className="block text-[12.5px] font-semibold text-stone-600">
            {field.label}
            <input
              type={field.kind === "number" ? "number" : "text"}
              step={field.step}
              value={values[field.key] ?? ""}
              onChange={(e) => { setDraft({ ...values, [field.key]: e.target.value }); setErrors((x) => ({ ...x, [field.key]: "" })); setGeneral(""); }}
              className="field mt-1.5"
            />
            {field.hint && !errors[field.key] && <span className="mt-1 block text-[11.5px] font-normal text-stone-400">{field.hint}</span>}
            {errors[field.key] && <span role="alert" className="mt-1 block text-[12px] font-normal text-red-700">{errors[field.key]}</span>}
          </label>
        ))}
      </div>
      {general && <p role="alert" className="mt-4 text-[12.5px] text-red-700">{general}</p>}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button type="button" onClick={save} disabled={!dirty || busy} className="btn-primary disabled:opacity-50">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Save
        </button>
        {dirty && <button type="button" onClick={() => { setDraft(null); setErrors({}); setGeneral(""); }} className="text-[12.5px] font-semibold text-stone-500 hover:text-ink">Reset</button>}
        {base.updated_at && <span className="ml-auto text-[11.5px] text-stone-400">Last changed {formatDate(base.updated_at)}</span>}
      </div>
      {remote.status === "error" && <InlineError message={remote.error.message} onRetry={remote.reload} />}
    </Card>
  );
}

function Prompts() {
  const [version, setVersion] = useState(0);
  const [openKey, setOpenKey] = useState("");
  const list = useRemote((o) => platformAdminApi.prompts(o), [version]);
  const rows = list.data?.results || list.data || [];

  if (list.status === "error" && !list.data) return <ErrorPanel message={list.error.message} onRetry={list.reload} />;

  return (
    <div className="space-y-4">
      {list.status === "loading" && !list.data ? (
        <Loading label="Loading the prompts" />
      ) : rows.length === 0 ? (
        <EmptyState icon={Sparkles} title="No prompts seeded" message="Modules seed their own prompt templates when they are first used." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((prompt) => (
            <Card key={prompt.key} className="p-5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="brand">v{prompt.version ?? prompt.active_version ?? "?"}</Badge>
                {prompt.model_role && <Badge tone="neutral">{prompt.model_role}</Badge>}
              </div>
              <h2 className="mt-2 text-[15px] font-semibold text-ink">{eventTypeLabel(prompt.key)}</h2>
              <p className="text-[11.5px] text-stone-500">{prompt.key}</p>
              <button type="button" onClick={() => setOpenKey(prompt.key)} className="btn-secondary mt-3 !h-9 text-[12.5px]"><History size={14} /> Versions</button>
            </Card>
          ))}
        </div>
      )}
      {list.status === "error" && <InlineError message={list.error.message} onRetry={list.reload} />}
      {openKey && <PromptVersions promptKey={openKey} onClose={() => setOpenKey("")} onChanged={() => setVersion((v) => v + 1)} />}
    </div>
  );
}

/**
 * Every version of one prompt. A new version becomes active and must pass schema validation and
 * keep every placeholder the previous one had; rollback re-activates an earlier version.
 */
function PromptVersions({ promptKey, onClose, onChanged }) {
  const [version, setVersion] = useState(0);
  const remote = useRemote((o) => platformAdminApi.promptVersions(promptKey, o), [promptKey, version]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ system_text: "", user_text: "" });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const rows = remote.data?.results || remote.data || [];
  const active = rows.find((row) => row.is_active) || rows[0];

  const startEdit = () => {
    setDraft({ system_text: active?.system_text || "", user_text: active?.user_text || "" });
    setError("");
    setEditing(true);
  };

  const save = async () => {
    setBusy("save");
    setError("");
    try {
      await platformAdminApi.savePrompt(promptKey, draft);
      toast({ title: "New version active", message: "The previous one stays available for rollback." });
      setEditing(false);
      setVersion((v) => v + 1);
      onChanged();
    } catch (problem) {
      setError(problem.field?.("system_text") || problem.field?.("user_text") || problem.field?.("output_schema") || problem.message);
    } finally {
      setBusy("");
    }
  };

  const rollback = async (row) => {
    setBusy(`roll-${row.version}`);
    setError("");
    try {
      await platformAdminApi.rollbackPrompt(promptKey, row.version);
      toast({ title: `Rolled back to v${row.version}`, message: "That version is active again." });
      setVersion((v) => v + 1);
      onChanged();
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <Drawer title={eventTypeLabel(promptKey)} subtitle={promptKey} onClose={onClose}>
      {remote.status === "loading" && rows.length === 0 ? <Loading label="Loading versions" /> : remote.status === "error" ? <InlineError message={remote.error.message} onRetry={remote.reload} /> : (
        <div className="space-y-4">
          {error && <InlineError message={error} />}
          {editing ? (
            <>
              <label className="block text-[12.5px] font-semibold text-stone-600">
                System text
                <textarea value={draft.system_text} rows={6} onChange={(e) => { setDraft((d) => ({ ...d, system_text: e.target.value })); setError(""); }} className="field mt-1.5 !h-auto py-2.5 font-mono text-[12px]" />
              </label>
              <label className="block text-[12.5px] font-semibold text-stone-600">
                User text
                <textarea value={draft.user_text} rows={8} onChange={(e) => { setDraft((d) => ({ ...d, user_text: e.target.value })); setError(""); }} className="field mt-1.5 !h-auto py-2.5 font-mono text-[12px]" />
              </label>
              <p className="text-[11.5px] leading-relaxed text-stone-500">
                A new version must pass schema validation and keep every placeholder the current version uses. If it scores worse, roll back.
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={save} disabled={busy === "save"} className="btn-primary disabled:opacity-50">
                  {busy === "save" ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Save as new version
                </button>
                <button type="button" onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
              </div>
            </>
          ) : (
            <>
              <button type="button" onClick={startEdit} className="btn-primary !h-9 text-[12.5px]">Edit and save a new version</button>
              {rows.map((row) => (
                <Card key={row.version} className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={row.is_active ? "success" : "neutral"}>v{row.version}{row.is_active ? " · active" : ""}</Badge>
                      {row.model_role && <Badge tone="neutral">{row.model_role}</Badge>}
                    </div>
                    {!row.is_active && (
                      <button type="button" disabled={busy === `roll-${row.version}`} onClick={() => rollback(row)} className="btn-secondary !h-8 !px-3 text-[12px] disabled:opacity-50">
                        <RotateCcw size={13} /> Roll back to this
                      </button>
                    )}
                  </div>
                  <p className="mt-1.5 text-[11.5px] text-stone-400">{row.created_by || "System"} · {formatDate(row.created_at)}</p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[12.5px] font-semibold text-brand">Show the prompt</summary>
                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl bg-stone-50 p-3 text-[11.5px] leading-relaxed text-stone-600">{row.system_text}

{row.user_text}</pre>
                  </details>
                </Card>
              ))}
            </>
          )}
        </div>
      )}
    </Drawer>
  );
}
