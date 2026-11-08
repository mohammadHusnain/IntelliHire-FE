// ─── Demo account store (mock) ──────────────────────────────────────────────────
// The in-browser account list the admin pages still use for modules that are not connected yet.
// It holds NO passwords for the built-in demo accounts (those live in credentials.js, which is only
// loaded in mock mode), so a real build contains no demo credentials.
// ─────────────────────────────────────────────────────────────────────────────

import { ApiError } from "../errors";

export const MOCK_DELAY = 800;
export const delay = (ms = MOCK_DELAY) => new Promise((r) => setTimeout(r, ms));
const DAY = 86400000;

export const REGISTERED_USERS_KEY = "intellihire_registered_users";
// Status changes admins make to seed accounts (which are constants and can't be edited in place).
const OVERRIDES_KEY = "intellihire_account_overrides";

// ─── Seed users (always present, never wiped) ────────────────────────────────
// Literal env check: the sample accounts are removed from real builds.
const SEED_USERS = import.meta.env.VITE_USE_MOCK_API !== "true" ? [] : [
  {
    id: "usr_c1",
    email: "candidate@test.com",
    name: "Ahmed Hassan",
    role: "candidate",
    status: "active",
    desiredRole: "Frontend Developer",
    createdAt: Date.now() - 45 * DAY,
  },
  {
    id: "usr_co1",
    email: "company@test.com",
    name: "John Smith",
    role: "company",
    status: "active",
    companyName: "Acme Corp",
    industry: "Technology",
    companySize: "51–200 employees",
    website: "https://acme.example",
    description: "Acme builds workflow software for logistics teams across the region.",
    profileComplete: true,
    createdAt: Date.now() - 60 * DAY,
  },
  {
    id: "usr_co2",
    email: "pending@test.com",
    name: "Jane Doe",
    role: "company",
    status: "pending",
    companyName: "NewCo",
    industry: "Finance",
    companySize: "11–50 employees",
    website: "https://newco.example",
    description: "NewCo is an early-stage fintech hiring its first engineering team.",
    profileComplete: false,
    createdAt: Date.now() - 3 * DAY,
  },
];

export const readJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
export const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable — changes last for this session only
  }
};

const isSeed = (id) => SEED_USERS.some((u) => u.id === id);

// Registered ids are usr_<timestamp>, which doubles as the creation time for older records.
const createdAtOf = (u) => u.createdAt || Number(String(u.id).split("_")[1]) || Date.now();

// ─── In-memory user list — seed + registered, with admin overrides applied ───
export function loadUsers() {
  const dynamic = readJson(REGISTERED_USERS_KEY, []);
  const overrides = readJson(OVERRIDES_KEY, {});
  const seedEmails = new Set(SEED_USERS.map((u) => u.email));
  return [...SEED_USERS, ...dynamic.filter((u) => !seedEmails.has(u.email))].map((u) => ({
    ...u,
    createdAt: createdAtOf(u),
    ...(overrides[u.id] || {}),
  }));
}

export function saveRegisteredUser(user) {
  writeJson(REGISTERED_USERS_KEY, [...readJson(REGISTERED_USERS_KEY, []), user]);
}

// Token format: "mock|{userId}|{timestamp}" — pipe separator avoids
// collision with underscores in user IDs (e.g. "usr_c1").
export function generateToken(userId) {
  return `mock|${userId}|${Date.now()}`;
}

export function sanitizeUser(user) {
  const safe = { ...user };
  delete safe.password;
  return safe;
}

export function assertCanSignIn(user) {
  if (user.status === "suspended") {
    throw new ApiError({ status: 403, code: "suspended", message: "This account has been suspended. Contact support if you think this is a mistake." });
  }
  if (user.status === "rejected") {
    throw new ApiError({ status: 403, code: "rejected", message: "This company application was not approved. Contact support for details." });
  }
}

// ─── Admin account management ───────────────────────────────────────────────
export const accountsApi = {
  /** Every account on the platform, newest first, without passwords. */
  list() {
    return loadUsers()
      .map(sanitizeUser)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  /** status: "active" | "suspended" | "pending" | "rejected" */
  async setStatus(id, status, reason = "") {
    await delay(350);
    const patch = { status, statusReason: reason, statusChangedAt: Date.now() };
    if (isSeed(id)) {
      writeJson(OVERRIDES_KEY, { ...readJson(OVERRIDES_KEY, {}), [id]: patch });
    } else {
      const stored = readJson(REGISTERED_USERS_KEY, []);
      const idx = stored.findIndex((u) => u.id === id);
      if (idx === -1) throw new Error("Account not found.");
      stored[idx] = { ...stored[idx], ...patch };
      writeJson(REGISTERED_USERS_KEY, stored);
    }
    return loadUsers().map(sanitizeUser).find((u) => u.id === id);
  },

  async remove(id) {
    await delay(350);
    if (isSeed(id)) throw new Error("Demo accounts can't be deleted. Suspend them instead.");
    const stored = readJson(REGISTERED_USERS_KEY, []);
    if (!stored.some((u) => u.id === id)) throw new Error("Account not found.");
    writeJson(REGISTERED_USERS_KEY, stored.filter((u) => u.id !== id));
    return { ok: true };
  },
};
