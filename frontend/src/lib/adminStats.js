import { accountsApi } from "@/api/authApi";
import { useCandidateStore } from "@/store/candidateStore";
import { useCommunityStore } from "@/store/communityStore";
import { getJobs } from "@/data/jobsStore";

const DAY = 86400000;
const WEEK = 7 * DAY;

export const ACCOUNT_STATUS = {
  active: { label: "Active", tone: "success" },
  pending: { label: "Pending", tone: "warning" },
  suspended: { label: "Suspended", tone: "danger" },
  rejected: { label: "Rejected", tone: "danger" },
};

/** Practice records only exist for candidates who have signed in at least once. */
export const practiceRecords = () => useCandidateStore.getState().records;

export function allAccounts() {
  return accountsApi.list();
}

/** Candidates waiting on a private community, across every signed-in candidate. */
export function joinRequests() {
  const records = practiceRecords();
  const catalogue = useCommunityStore.getState().catalogue;
  const out = [];
  for (const [userId, rec] of Object.entries(records)) {
    for (const [communityId, m] of Object.entries(rec.memberships || {})) {
      if (m.status !== "pending") continue;
      const community = catalogue.find((c) => c.id === communityId);
      if (!community) continue;
      out.push({
        id: `${userId}:${communityId}`,
        userId,
        communityId,
        community,
        at: m.at,
        name: rec.profile.fullName,
        email: rec.profile.email,
        headline: rec.profile.headline,
        targetRole: rec.profile.targetRole,
        skills: rec.profile.skills || [],
      });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/** Every completed practice interview on the platform, with its candidate attached. */
export function allSessions() {
  const records = practiceRecords();
  return Object.entries(records).flatMap(([userId, rec]) =>
    (rec.sessions || []).map((s) => ({ ...s, userId, candidate: rec.profile.fullName })),
  );
}

export function practiceSummaryFor(userId) {
  const rec = practiceRecords()[userId];
  if (!rec) return null;
  const sessions = rec.sessions || [];
  const scores = sessions.map((s) => s.summary.overall);
  return {
    sessions: sessions.length,
    avg: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    best: scores.length ? Math.max(...scores) : 0,
    lastAt: sessions.length ? Math.max(...sessions.map((s) => s.completedAt)) : null,
    memberships: Object.values(rec.memberships || {}).filter((m) => m.status === "joined").length,
    targetRole: rec.profile.targetRole,
    profile: rec.profile,
  };
}

const countInRange = (items, at, from, to) => items.filter((i) => at(i) >= from && at(i) < to).length;

/** Platform-wide figures for the dashboard and analytics pages. */
export function platformStats(days = 30) {
  const accounts = allAccounts();
  const sessions = allSessions();
  const catalogue = useCommunityStore.getState().catalogue;
  const jobs = getJobs();
  const now = Date.now();
  const from = now - days * DAY;
  const prevFrom = from - days * DAY;

  const candidates = accounts.filter((a) => a.role === "candidate");
  const companies = accounts.filter((a) => a.role === "company");
  const scores = sessions.map((s) => s.summary.overall);

  const weeks = [];
  const span = Math.min(days, 84);
  for (let t = now - span * DAY; t < now; t += WEEK) {
    weeks.push({
      at: t,
      signups: countInRange(accounts, (a) => a.createdAt, t, t + WEEK),
      candidates: countInRange(candidates, (a) => a.createdAt, t, t + WEEK),
      companies: countInRange(companies, (a) => a.createdAt, t, t + WEEK),
      interviews: countInRange(sessions, (s) => s.completedAt, t, t + WEEK),
    });
  }

  const inRange = (items, at) => countInRange(items, at, from, now);
  const prev = (items, at) => countInRange(items, at, prevFrom, from);

  return {
    accounts,
    sessions,
    totals: {
      accounts: accounts.length,
      candidates: candidates.length,
      companies: companies.length,
      interviews: sessions.length,
      avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      openJobs: jobs.filter((j) => (j.status || "Open") !== "Closed").length,
      communities: catalogue.filter((c) => c.status === "active").length,
    },
    pending: {
      companies: companies.filter((c) => c.status === "pending"),
      requests: joinRequests(),
      suspended: accounts.filter((a) => a.status === "suspended").length,
    },
    deltas: {
      signups: inRange(accounts, (a) => a.createdAt) - prev(accounts, (a) => a.createdAt),
      interviews: inRange(sessions, (s) => s.completedAt) - prev(sessions, (s) => s.completedAt),
    },
    recent: {
      signups: inRange(accounts, (a) => a.createdAt),
      interviews: inRange(sessions, (s) => s.completedAt),
    },
    weeks,
  };
}

export function scoreDistribution(sessions) {
  const buckets = [
    { label: "0–39", min: 0, max: 40 },
    { label: "40–54", min: 40, max: 55 },
    { label: "55–69", min: 55, max: 70 },
    { label: "70–84", min: 70, max: 85 },
    { label: "85–100", min: 85, max: 101 },
  ];
  return buckets.map((b) => ({
    ...b,
    count: sessions.filter((s) => s.summary.overall >= b.min && s.summary.overall < b.max).length,
  }));
}

export function groupCount(items, key) {
  const map = new Map();
  for (const item of items) {
    const k = typeof key === "function" ? key(item) : item[key];
    if (k == null) continue;
    map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}
