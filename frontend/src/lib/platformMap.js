// Platform admin panel (Module 13): backend data <-> the shapes the admin screens use.
// One place for the flag enums, what "take action" means per target, and the AI settings fields.

/** What a flag can point at (`FlagTarget`). */
export const FLAG_TARGETS = [
  { value: "user", label: "User" },
  { value: "company", label: "Company" },
  { value: "job", label: "Job" },
  { value: "community", label: "Community" },
  { value: "community_post", label: "Community post" },
];
export const flagTargetLabel = (v) => FLAG_TARGETS.find((t) => t.value === v)?.label ?? v ?? "";

export const FLAG_SOURCES = {
  reported: "Reported by a user",
  admin: "Raised by a platform admin",
  system: "Raised by the system",
};
export const flagSourceLabel = (v) => FLAG_SOURCES[v] ?? v ?? "";

export const FLAG_STATUSES = {
  open: { label: "Open", tone: "warning" },
  reviewing: { label: "Reviewing", tone: "brand" },
  dismissed: { label: "Dismissed", tone: "neutral" },
  actioned: { label: "Actioned", tone: "success" },
};
export const FLAG_STATUS_FILTERS = ["open", "reviewing", "dismissed", "actioned"];
export const flagStatusLabel = (v) => FLAG_STATUSES[v]?.label ?? v ?? "";
export const flagStatusTone = (v) => FLAG_STATUSES[v]?.tone ?? "neutral";

/** What the server recorded it did (`FlagAction`). */
export const FLAG_ACTIONS = {
  none: "No action",
  suspended_user: "User suspended",
  suspended_company: "Company suspended",
  closed_job: "Job closed",
  removed_community: "Community removed",
  removed_post: "Post removed",
};
export const flagActionLabel = (v) => (v && v !== "none" ? FLAG_ACTIONS[v] ?? v : "");

/**
 * The server takes `action: "dismiss" | "act"` and works out the consequence from the flag's
 * target, reusing that object's own service. This is what "act" will do, so the dialog can say so.
 */
export const ACTION_CONSEQUENCE = {
  user: "suspend this user",
  company: "suspend this company",
  job: "close this job",
  community: "remove this community",
  community_post: "archive this post",
};
export const actionConsequence = (targetType) => ACTION_CONSEQUENCE[targetType] ?? "act on this target";

/** A note is always required to resolve a flag; the server answers 400 without one. */
export const NOTE_MIN = 1;
export const NOTE_MAX = 1000;
export const noteError = (text) => (String(text || "").trim().length ? "" : "Write a resolution note.");
export const REASON_MAX = 1000;
export const reasonError = (text) => (String(text || "").trim().length ? "" : "Give a reason.");

export const ALERT_SEVERITIES = {
  info: { label: "Information", tone: "neutral" },
  warning: { label: "Warning", tone: "warning" },
  critical: { label: "Critical", tone: "danger" },
};
export const alertSeverityLabel = (v) => ALERT_SEVERITIES[v]?.label ?? v ?? "";
export const alertSeverityTone = (v) => ALERT_SEVERITIES[v]?.tone ?? "neutral";

/** The AI settings the server stores. Keys are never among them: they live in the environment. */
export const AI_SETTING_FIELDS = [
  { key: "provider", label: "Provider", kind: "text", hint: "openai or fake" },
  { key: "chat_model", label: "Chat model", kind: "text" },
  { key: "eval_model", label: "Evaluation model", kind: "text" },
  { key: "embed_model", label: "Embedding model", kind: "text" },
  { key: "stt_model", label: "Speech-to-text model", kind: "text" },
  { key: "fallback_provider", label: "Fallback provider", kind: "text" },
  { key: "fallback_chat_model", label: "Fallback chat model", kind: "text" },
  { key: "temperature_questions", label: "Temperature, questions", kind: "number", step: "0.1" },
  { key: "temperature_evaluation", label: "Temperature, evaluation", kind: "number", step: "0.1" },
  { key: "max_tokens", label: "Maximum tokens", kind: "number" },
  { key: "timeout_seconds", label: "Timeout, seconds", kind: "number" },
  { key: "screening_min_score", label: "Screening minimum score", kind: "number" },
  { key: "screening_questions", label: "Screening questions", kind: "number" },
  { key: "technical_questions", label: "Technical questions", kind: "number" },
  { key: "mock_questions", label: "Mock interview questions", kind: "number" },
];

/** Only the fields that changed, with numbers sent as numbers. */
export function aiSettingsChanges(draft, base) {
  const changes = {};
  for (const field of AI_SETTING_FIELDS) {
    const next = draft[field.key];
    if (String(next ?? "") === String(base[field.key] ?? "")) continue;
    changes[field.key] = field.kind === "number" ? Number(next) : String(next ?? "").trim();
  }
  return changes;
}

const time = (v) => (v ? Date.parse(v) || null : null);

export function mapFlag(f) {
  return {
    id: f.id,
    targetType: f.target_type,
    targetId: f.target_id,
    target: f.target || null,
    reason: f.reason || "",
    source: f.source,
    status: f.status,
    reportedBy: f.reported_by || "",
    resolutionNote: f.resolution_note || "",
    actionTaken: f.action_taken || "none",
    resolvedBy: f.resolved_by || "",
    createdAt: time(f.created_at),
    resolvedAt: time(f.resolved_at),
  };
}

export function mapAlert(a) {
  return {
    id: a.id,
    kind: a.kind,
    severity: a.severity,
    message: a.message || "",
    isActive: Boolean(a.is_active),
    createdAt: time(a.created_at),
    acknowledgedAt: time(a.acknowledged_at),
    resolvedAt: time(a.resolved_at),
  };
}

export function mapActivityEvent(e) {
  return {
    id: e.id,
    eventType: e.event_type,
    summary: e.summary || "",
    actor: e.actor ? { id: e.actor.id, name: e.actor.full_name } : null,
    companyId: e.company_id ?? null,
    targetType: e.target_type || "",
    targetId: e.target_id || null,
    metadata: e.metadata ?? null,
    createdAt: time(e.created_at),
  };
}

/** An event type like `company.approved` read as "Company approved". */
export function eventTypeLabel(value) {
  const text = String(value || "").replaceAll(".", " · ").replaceAll("_", " ");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

/** A psutil reading the server could not take comes back null; it is never shown as 0. */
export const percentText = (value) => (value === null || value === undefined ? "—" : `${Math.round(value)}%`);
export const okTone = (ok) => (ok ? "success" : "danger");
export const okLabel = (ok) => (ok ? "Reachable" : "Unreachable");

/** Only a platform admin ever reaches these screens; the server refuses everyone else. */
export const isPlatformAdmin = (user) => user?.role === "admin";
