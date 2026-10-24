// ─── Mock Auth API ──────────────────────────────────────────────────────────
// Simulates backend auth endpoints with realistic delay, persisted in localStorage.
// Replace internals with real Django API calls when backend is ready.
// ─────────────────────────────────────────────────────────────────────────────
import { getPlatformSettings } from "@/store/platformStore";

const MOCK_DELAY = 800;
const delay = (ms = MOCK_DELAY) => new Promise((r) => setTimeout(r, ms));
const DAY = 86400000;

const REGISTERED_USERS_KEY = "intellihire_registered_users";
// Status changes admins make to seed accounts (which are constants and can't be edited in place).
const OVERRIDES_KEY = "intellihire_account_overrides";

// ─── Seed users (always present, never wiped) ────────────────────────────────
const SEED_USERS = [
  {
    id: "usr_c1",
    email: "candidate@test.com",
    password: "password123",
    name: "Ahmed Hassan",
    role: "candidate",
    status: "active",
    desiredRole: "Frontend Developer",
    createdAt: Date.now() - 45 * DAY,
  },
  {
    id: "usr_co1",
    email: "company@test.com",
    password: "password123",
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
    password: "password123",
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

// Active seed accounts, offered as one-click demo logins while auth is mocked.
export const DEMO_USERS = SEED_USERS.filter((u) => u.status === "active").map(
  ({ email, password, role, name }) => ({ email, password, role, name }),
);

const readJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const writeJson = (key, value) => {
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
function loadUsers() {
  const dynamic = readJson(REGISTERED_USERS_KEY, []);
  const overrides = readJson(OVERRIDES_KEY, {});
  const seedEmails = new Set(SEED_USERS.map((u) => u.email));
  return [...SEED_USERS, ...dynamic.filter((u) => !seedEmails.has(u.email))].map((u) => ({
    ...u,
    createdAt: createdAtOf(u),
    ...(overrides[u.id] || {}),
  }));
}

function saveRegisteredUser(user) {
  writeJson(REGISTERED_USERS_KEY, [...readJson(REGISTERED_USERS_KEY, []), user]);
}

// Token format: "mock|{userId}|{timestamp}" — pipe separator avoids
// collision with underscores in user IDs (e.g. "usr_c1").
function generateToken(userId) {
  return `mock|${userId}|${Date.now()}`;
}

function sanitizeUser(user) {
  const safe = { ...user };
  delete safe.password;
  return safe;
}

function assertCanSignIn(user) {
  if (user.status === "suspended") {
    throw new Error("This account has been suspended. Contact support if you think this is a mistake.");
  }
  if (user.status === "rejected") {
    throw new Error("This company application was not approved. Contact support for details.");
  }
}

// ─── Auth API Methods ───────────────────────────────────────────────────────
export const authApi = {
  /**
   * Login — returns { user, token } or throws.
   */
  async login(email, password) {
    await delay();
    const user = loadUsers().find((u) => u.email === email && u.password === password);
    if (!user) throw new Error("Invalid email or password");
    assertCanSignIn(user);
    return { user: sanitizeUser(user), token: generateToken(user.id) };
  },

  /**
   * Register — persists new account to localStorage for cross-reload uniqueness.
   * Honours the platform's sign-up and auto-approval policy.
   */
  async register(userData) {
    const { email, password, name, role, companyName, industry, companySize, website, description, logoFileName } = userData;
    await delay();
    const policy = getPlatformSettings();
    const isCompany = role === "company";
    if (isCompany && !policy.allowCompanySignup) throw new Error("Company sign-ups are paused right now. Please try again later.");
    if (!isCompany && !policy.allowCandidateSignup) throw new Error("Candidate sign-ups are paused right now. Please try again later.");

    // Global email uniqueness — one email, one account, one role. No exceptions.
    const exists = loadUsers().find((u) => u.email === email);
    if (exists) {
      const takenRole = exists.role.charAt(0).toUpperCase() + exists.role.slice(1);
      throw new Error(`An account with this email already exists as a ${takenRole}. Each email can only be used for one account.`);
    }

    const now = Date.now();
    const newUser = {
      id: `usr_${now}`,
      email,
      name,
      role: isCompany ? "company" : "candidate",
      status: isCompany && !policy.autoApproveCompanies ? "pending" : "active",
      createdAt: now,
      ...(isCompany
        ? { companyName, industry, companySize: companySize || "", website: website || "", description: description || "", logoFileName: logoFileName || "", profileComplete: true }
        : {
            desiredRole: userData.desiredRole || "",
            skills: userData.skills || [],
            linkedIn: userData.linkedIn || "",
            github: userData.github || "",
            cvFileName: userData.cvFileName || "",
          }),
    };
    saveRegisteredUser({ ...newUser, password });
    return { user: sanitizeUser(newUser) };
  },

  /**
   * Validate token — checks if a stored token maps to a real, still-permitted user.
   */
  async validateToken(token, ms = 400) {
    await delay(ms);
    if (!token || !token.startsWith("mock|")) throw new Error("Invalid token");
    const userId = token.split("|")[1];
    const user = loadUsers().find((u) => u.id === userId);
    if (!user) throw new Error("User not found");
    assertCanSignIn(user);
    return { user: sanitizeUser(user) };
  },

  /**
   * Change password — verifies the current one. Seed demo accounts are read-only.
   */
  async changePassword(email, currentPassword, newPassword) {
    await delay(700);
    if (SEED_USERS.some((u) => u.email === email)) {
      throw new Error("Demo accounts can't change their password. Register your own account to try this.");
    }
    const stored = readJson(REGISTERED_USERS_KEY, []);
    const idx = stored.findIndex((u) => u.email === email);
    if (idx === -1) throw new Error("Account not found.");
    if (stored[idx].password !== currentPassword) throw new Error("Your current password is incorrect.");
    stored[idx] = { ...stored[idx], password: newPassword };
    writeJson(REGISTERED_USERS_KEY, stored);
    return { ok: true };
  },

  /**
   * Forgot password — mock placeholder.
   */
  async forgotPassword(email) {
    await delay();
    return { message: `If ${email} has an account, a reset link has been sent.` };
  },
};

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
