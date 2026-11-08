// Applications (candidates) and their review: backend data <-> the shapes the candidate screens use.
// One place for the seven statuses, labels, limits, date parameters and who may change what.
import { educationLabel } from "./jobMap";

/** The backend's seven statuses, in pipeline order. `board` columns follow this order (rejected last). */
export const APPLICATION_STATUSES = [
  { value: "submitted", label: "Applied", tone: "neutral", hint: "New applications" },
  { value: "under_review", label: "Under review", tone: "warning", hint: "Being looked at" },
  { value: "shortlisted", label: "Shortlisted", tone: "brand", hint: "Worth interviewing" },
  { value: "interview", label: "Interview", tone: "warning", hint: "Interview stage" },
  { value: "selected", label: "Selected", tone: "success", hint: "Chosen for the role" },
  { value: "on_hold", label: "On hold", tone: "neutral", hint: "Paused" },
  { value: "rejected", label: "Rejected", tone: "danger", hint: "Not proceeding" },
];
export const statusLabel = (value) => APPLICATION_STATUSES.find((s) => s.value === value)?.label ?? value ?? "";
export const statusTone = (value) => APPLICATION_STATUSES.find((s) => s.value === value)?.tone ?? "neutral";

export const LIMITS = { statusNote: 1000, note: 2000, bulk: 50, pageSize: 20, boardPage: 10, boardMax: 100 };

export const ORDERINGS = [
  { value: "-submitted_at", label: "Newest first" },
  { value: "submitted_at", label: "Oldest first" },
  { value: "full_name", label: "Name A–Z" },
  { value: "-full_name", label: "Name Z–A" },
];

/** Only people who may edit roles may change a status or write a note (the server enforces it as well). */
export const canChangeStatus = (user) => ["admin", "hr_manager", "recruiter"].includes(user?.memberRole);

const time = (v) => (v ? Date.parse(v) || null : null);

export function mapApplicationRow(a) {
  return {
    id: a.id,
    reference: a.reference,
    name: a.full_name || "",
    email: a.email || "",
    phone: a.phone || "",
    educationLevel: a.education_level || "",
    educationLabel: educationLabel(a.education_level),
    institution: a.institution || "",
    status: a.status,
    submittedAt: time(a.submitted_at),
    hasCv: Boolean(a.has_cv),
    job: a.job ? { id: a.job.id, title: a.job.title } : null,
  };
}

export const mapNote = (n) => ({
  id: n.id,
  text: n.text,
  author: n.author?.full_name || "",
  createdAt: time(n.created_at),
});

export function mapApplication(a) {
  return {
    ...mapApplicationRow({ ...a, has_cv: Boolean(a.resume) }),
    graduationYear: a.graduation_year ?? null,
    resume: a.resume ? { name: a.resume.name || "CV" } : null,
    answers: (a.answers || []).map((x) => ({ key: x.key, label: x.label, type: x.type, value: x.value ?? null })),
    statusHistory: (a.status_history || []).map((h) => ({
      from: h.from_status || null,
      to: h.to_status,
      by: h.changed_by?.full_name || "",
      note: h.note || "",
      at: time(h.changed_at),
    })),
    notes: (a.notes || []).map(mapNote),
    updatedAt: time(a.updated_at),
  };
}

/** A calendar date as the server filters it (YYYY-MM-DD). Anything else is ignored. */
export const dateParam = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value : "");

/** http(s) links only: an answer such as "javascript:..." is shown as text, never as a link. */
export const safeUrl = (value) => (/^https?:\/\//i.test(String(value || "")) ? String(value) : null);

/** The name of a downloaded file made safe to show (never trusted as a path). */
export const cleanFileName = (name) => String(name || "file").replace(/[\\/\0]/g, "_");
