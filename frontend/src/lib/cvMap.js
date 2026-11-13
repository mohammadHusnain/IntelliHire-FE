// CV analysis and shortlisting (Module 6): backend data <-> the shapes the screening screens use.
// One place for the screening labels, the run modes, the weight rule and who may do what.

/**
 * The six labels the server derives for HR (`cv_label`), from Module 6's `labels.py`.
 * `null` means the CV has not been looked at yet.
 */
export const CV_LABELS = {
  shortlisted: { label: "Shortlisted", tone: "brand" },
  meets_threshold: { label: "Meets threshold", tone: "success" },
  not_shortlisted: { label: "Not shortlisted", tone: "neutral" },
  manual_review: { label: "Manual review required", tone: "warning" },
  analysing: { label: "Analysing", tone: "neutral" },
  failed: { label: "Analysis failed", tone: "danger" },
};
export const cvLabel = (key) => CV_LABELS[key]?.label ?? "Not analysed";
export const cvLabelTone = (key) => CV_LABELS[key]?.tone ?? "neutral";

/** The analysis states of one CV, as the ranking filter offers them (`none` = never analysed). */
export const ANALYSIS_STATES = [
  { value: "", label: "All analysis states" },
  { value: "completed", label: "Completed" },
  { value: "queued", label: "Queued" },
  { value: "processing", label: "Processing" },
  { value: "failed", label: "Failed" },
  { value: "manual_review", label: "Manual review" },
  { value: "none", label: "Not analysed" },
];
export const analysisStateLabel = (value) =>
  ANALYSIS_STATES.find((state) => state.value === value)?.label ?? "Not analysed";

/**
 * What "Begin CV screening" can do (the server's `mode`). The descriptions are shown in the
 * confirmation dialog, because the three modes cost very different amounts of AI work.
 */
export const RUN_MODES = [
  { value: "missing", label: "Not yet analysed", description: "Reads the CVs that were never analysed and retries the ones that failed. The usual choice." },
  { value: "full", label: "Every CV again", description: "Reads every CV from scratch, including ones already analysed. Use after changing how CVs are read." },
  { value: "rescore", label: "Re-score only", description: "Recomputes scores from what was already read, without reading any CV again. Use after changing the role's skills or the weights." },
];
export const runMode = (value) => RUN_MODES.find((mode) => mode.value === value) ?? RUN_MODES[0];

/** The four scoring parts. They must add up to exactly 100; the server refuses anything else. */
export const WEIGHT_FIELDS = [
  { key: "weight_skills", label: "Skills", hint: "Required skills found in the CV" },
  { key: "weight_experience", label: "Experience", hint: "Years against the role's minimum" },
  { key: "weight_education", label: "Education", hint: "Highest level against the role's level" },
  { key: "weight_semantic", label: "Semantic fit", hint: "How close the CV reads to the role" },
];
export const WEIGHTS_TOTAL = 100;

/** Every weight as a number, missing or unparseable values counting as 0. */
export function weightValues(source = {}) {
  return WEIGHT_FIELDS.reduce((all, field) => ({ ...all, [field.key]: Number(source[field.key]) || 0 }), {});
}
export const weightsTotal = (source = {}) => Object.values(weightValues(source)).reduce((sum, value) => sum + value, 0);

/**
 * The client-side copy of the server's rule, so an impossible save is never sent.
 * Returns a message, or "" when the weights are acceptable.
 */
export function weightsError(source = {}) {
  const values = weightValues(source);
  if (WEIGHT_FIELDS.some((field) => !/^\d{1,3}$/.test(String(source[field.key] ?? "").trim()) || values[field.key] > 100)) {
    return "Each weight is a whole number from 0 to 100.";
  }
  const total = weightsTotal(source);
  if (total !== WEIGHTS_TOTAL) return `The four weights must add up to 100. They add up to ${total}.`;
  return "";
}

/** A threshold is a whole number from 0 to 100 (the server's rule). */
export const validThreshold = (value) => /^\d{1,3}$/.test(String(value ?? "").trim()) && Number(value) <= 100;

/** 0 to 100 as a plain integer string, or an em dash when there is no score. */
export const scoreText = (value) => (value == null || value === "" ? "—" : String(Math.round(Number(value))));
/** Badge tone for a score. The bands match the default threshold of 70. */
export const scoreTone = (value) => (Number(value) >= 70 ? "success" : Number(value) >= 55 ? "warning" : "danger");
/** ProgressBar colour for a score (the bar takes a class, not a tone name). */
export const scoreBarTone = (value) => (Number(value) >= 70 ? "bg-emerald-500" : Number(value) >= 55 ? "bg-amber-500" : "bg-red-500");

// Who may do what. These mirror Module6_CVAnalysis/permissions.py exactly, so the UI never
// offers a control the server would refuse with a 403.
/** Change the screening settings and shortlist by threshold: company admin and HR manager. */
export const canManageScreening = (user) => ["admin", "hr_manager"].includes(user?.memberRole);
/** Start or repeat an analysis: company admin, HR manager and recruiter. Viewers only read. */
export const canRunScreening = (user) => ["admin", "hr_manager", "recruiter"].includes(user?.memberRole);

/** Shown beside anything a model wrote, as the guide's §6.5 requires. */
export const AI_NOTICE = "AI-generated, for review by a person";
