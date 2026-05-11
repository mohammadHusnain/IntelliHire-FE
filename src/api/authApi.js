// ─── Mock Auth API ──────────────────────────────────────────────────────────
// Simulates backend auth endpoints with realistic delay.
// Replace internals with real Django API calls when backend is ready.
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_DELAY = 800;
const delay = (ms = MOCK_DELAY) => new Promise((r) => setTimeout(r, ms));

// ─── Storage key for persisted registrations ────────────────────────────────
const REGISTERED_USERS_KEY = "intellihire_registered_users";

// ─── Seed users (always present, never wiped) ────────────────────────────────
const SEED_USERS = [
  {
    id: "usr_c1",
    email: "candidate@test.com",
    password: "password123",
    name: "Ahmed Hassan",
    role: "candidate",
    status: "active",
  },
  {
    id: "usr_co1",
    email: "company@test.com",
    password: "password123",
    name: "John Smith",
    role: "company",
    status: "active",
    companyName: "Acme Corp",
    profileComplete: true,
  },
  {
    id: "usr_co2",
    email: "pending@test.com",
    password: "password123",
    name: "Jane Doe",
    role: "company",
    status: "pending",
    companyName: "NewCo",
    profileComplete: false,
  },
];

// ─── In-memory user list — merged from seed + localStorage on every load ─────
function loadUsers() {
  try {
    const stored = localStorage.getItem(REGISTERED_USERS_KEY);
    const dynamic = stored ? JSON.parse(stored) : [];
    // Merge: seed users take priority; dynamic users add on top
    const seedEmails = new Set(SEED_USERS.map((u) => u.email));
    const filtered = dynamic.filter((u) => !seedEmails.has(u.email));
    return [...SEED_USERS, ...filtered];
  } catch {
    return [...SEED_USERS];
  }
}

function saveRegisteredUser(user) {
  try {
    const stored = localStorage.getItem(REGISTERED_USERS_KEY);
    const dynamic = stored ? JSON.parse(stored) : [];
    dynamic.push(user);
    localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(dynamic));
  } catch {
    // localStorage unavailable — uniqueness only guaranteed in-session
  }
}

// Token format: "mock|{userId}|{timestamp}" — pipe separator avoids
// collision with underscores in user IDs (e.g. "usr_c1").
function generateToken(userId) {
  return `mock|${userId}|${Date.now()}`;
}

function sanitizeUser(user) {
  const { password, ...safe } = user;
  return safe;
}

// ─── Auth API Methods ───────────────────────────────────────────────────────
export const authApi = {
  /**
   * Login — returns { user, token } or throws.
   */
  async login(email, password) {
    await delay();
    const users = loadUsers();
    const user = users.find((u) => u.email === email && u.password === password);
    if (!user) throw new Error("Invalid email or password");
    return { user: sanitizeUser(user), token: generateToken(user.id) };
  },

  /**
   * Register — persists new account to localStorage for cross-reload uniqueness.
   */
  async register(userData) {
    const { email, password, name, role, companyName, industry,
            companySize, website, description, logoFileName } = userData;
    await delay();
    const users = loadUsers();
    // Global email uniqueness — one email, one account, one role. No exceptions.
    const exists = users.find((u) => u.email === email);
    if (exists) {
      const takenRole = exists.role.charAt(0).toUpperCase() + exists.role.slice(1);
      throw new Error(
        `An account with this email already exists as a ${takenRole}. Each email can only be used for one account.`
      );
    }

    const newUser = {
      id: `usr_${Date.now()}`,
      email,
      name,
      role: role === "company" ? "company" : "candidate",
      status: role === "company" ? "pending" : "active",
      ...(role === "company"
        ? { companyName, industry, companySize: companySize || "", website: website || "", description: description || "", logoFileName: logoFileName || "", profileComplete: true }
        : {
            desiredRole: userData.desiredRole || "",
            skills: userData.skills || [],
            linkedIn: userData.linkedIn || "",
            github: userData.github || "",
            cvFileName: userData.cvFileName || "",
          }),
    };
    // Persist with password so login works after reload
    saveRegisteredUser({ ...newUser, password });
    return { user: sanitizeUser(newUser) };
  },

  /**
   * Validate token — checks if a stored token maps to a real user.
   */
  async validateToken(token) {
    await delay(400);
    if (!token || !token.startsWith("mock|")) throw new Error("Invalid token");
    const userId = token.split("|")[1];
    const users = loadUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) throw new Error("User not found");
    return { user: sanitizeUser(user) };
  },

  /**
   * Forgot password — mock placeholder.
   */
  async forgotPassword(email) {
    await delay();
    return { message: "If that email exists, a reset link has been sent." };
  },
};
