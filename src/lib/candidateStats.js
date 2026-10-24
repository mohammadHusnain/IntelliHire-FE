const DAY = 86400000;

export const PROFILE_CHECKLIST = [
  { key: "photo", label: "Add a profile photo", test: (p) => !!p.photo },
  { key: "headline", label: "Add your headline", test: (p) => !!p.headline?.trim() },
  { key: "targetRole", label: "Choose a target role", test: (p) => !!p.targetRole },
  { key: "skills", label: "List at least three skills", test: (p) => p.skills?.length >= 3 },
  { key: "bio", label: "Write a short bio", test: (p) => p.bio?.trim().length >= 40 },
  { key: "links", label: "Link LinkedIn or GitHub", test: (p) => !!(p.links?.linkedin || p.links?.github) },
  { key: "cv", label: "Upload your CV", test: (p) => !!p.cv },
];

export function profileCompletion(profile) {
  const items = PROFILE_CHECKLIST.map((c) => ({ ...c, done: c.test(profile) }));
  return { percent: Math.round((items.filter((i) => i.done).length / items.length) * 100), items };
}

const startOfDay = (t) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const startOfWeek = (t) => {
  const d = new Date(startOfDay(t));
  const offset = (d.getDay() + 6) % 7; // Monday
  return d.getTime() - offset * DAY;
};

export function sessionStats(sessions, weeklyGoal = 3) {
  const sorted = [...sessions].sort((a, b) => a.completedAt - b.completedAt);
  const scores = sorted.map((s) => s.summary.overall);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const best = scores.length ? Math.max(...scores) : 0;
  const window = Math.min(3, Math.floor(scores.length / 2));
  const improvement = window
    ? Math.round(scores.slice(-window).reduce((a, b) => a + b, 0) / window - scores.slice(0, window).reduce((a, b) => a + b, 0) / window)
    : 0;
  const minutes = Math.round(sorted.reduce((s, x) => s + x.durationSec, 0) / 60);

  // Streak in consecutive weeks with at least one session (daily streaks punish real life).
  let weekStreak = 0;
  if (sorted.length) {
    const weeks = new Set(sorted.map((s) => startOfWeek(s.completedAt)));
    let cursor = startOfWeek(Date.now());
    if (!weeks.has(cursor)) cursor -= 7 * DAY;
    while (weeks.has(cursor)) {
      weekStreak++;
      cursor -= 7 * DAY;
    }
  }
  const thisWeek = sorted.filter((s) => s.completedAt >= startOfWeek(Date.now())).length;

  const dims = ["communication", "structure", "confidence", "technical"];
  const recent = sorted.slice(-3);
  const dimensions = Object.fromEntries(
    dims.map((k) => [k, recent.length ? Math.round(recent.reduce((s, x) => s + x.summary.breakdown[k], 0) / recent.length) : 0]),
  );

  return {
    count: sorted.length,
    avg,
    best,
    improvement,
    minutes,
    weekStreak,
    thisWeek,
    weeklyGoal,
    latest: sorted[sorted.length - 1] || null,
    trend: sorted.map((s) => ({ id: s.id, at: s.completedAt, score: s.summary.overall, role: s.role })),
    dimensions,
  };
}

export function formatDate(t, opts = { month: "short", day: "numeric", year: "numeric" }) {
  return new Date(t).toLocaleDateString("en-GB", opts);
}

export function relativeTime(t) {
  const diff = Date.now() - t;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? "s" : ""} ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d > 1 ? "s" : ""} ago`;
  return formatDate(t, { month: "short", day: "numeric" });
}

export function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m} min${s ? ` ${s} s` : ""}` : `${s} s`;
}

// One set of thresholds everywhere, aligned with verdictFor(): 70+ strong, 55+ developing.
export function toneFor(score) {
  return score >= 70 ? "success" : score >= 55 ? "warning" : "danger";
}

export function scoreTone(score) {
  if (score >= 70) return { text: "text-emerald-600", bg: "bg-emerald-50", ring: "#059669", bar: "bg-emerald-500", label: "Strong" };
  if (score >= 55) return { text: "text-amber-600", bg: "bg-amber-50", ring: "#D97706", bar: "bg-amber-500", label: "Developing" };
  return { text: "text-red-600", bg: "bg-red-50", ring: "#DC2626", bar: "bg-red-500", label: "Needs work" };
}

export const TYPE_LABEL = { general: "General", technical: "Technical", "role-specific": "Role-specific" };
export const DIFFICULTY_LABEL = { entry: "Entry", mid: "Mid", senior: "Senior" };

export function initials(name = "") {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
}
