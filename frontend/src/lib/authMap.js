// Turns what the backend says into what the UI already understands, in ONE place.
//
//   backend roles  candidate | company_admin | hr | platform_admin
//   UI roles       candidate | company       | company | admin
//
// The real backend role and the company member role stay on the object for later modules.
import { ROLE_DASHBOARDS, ROLES } from "@/config/routes";

const ROLE_MAP = {
  candidate: ROLES.CANDIDATE,
  company_admin: ROLES.COMPANY,
  hr: ROLES.COMPANY,
  platform_admin: ROLES.ADMIN,
};

// The UI knows active | pending | rejected | suspended; the backend splits "pending" in two.
const STATUS_MAP = {
  active: "active",
  pending_verification: "pending",
  pending_approval: "pending",
  rejected: "rejected",
  suspended: "suspended",
};

export function mapUser(api) {
  if (!api || typeof api !== "object") return null;
  const company = api.company || null;
  return {
    id: api.id,
    email: api.email,
    name: api.full_name || "",
    role: ROLE_MAP[api.role] ?? null,
    status: STATUS_MAP[api.status] ?? api.status,
    backendRole: api.role,
    backendStatus: api.status,
    memberRole: company?.member_role ?? null,
    companyId: company?.id ?? null,
    companyName: company?.name ?? "",
    companyStatus: company?.status ?? null,
  };
}

const ROLE_PREFIX = { candidate: "/candidate", company: "/company", admin: "/admin" };
const AUTH_PAGES = ["/login", "/register", "/verify-email", "/reset-password"];

/** An in-app path only: starts with one "/", no scheme, no protocol-relative or backslash tricks. */
export function isSafeInternalPath(path) {
  if (typeof path !== "string" || path.length === 0 || path.length > 2000) return false;
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
  for (let i = 0; i < path.length; i += 1) if (path.charCodeAt(i) < 32) return false; // no control characters
  try {
    const url = new URL(path, "http://localhost");
    return url.origin === "http://localhost";
  } catch {
    return false;
  }
}

/** Where to send a user after login: the requested page if it is safe and allowed for their role, else their dashboard. */
export function resolvePostLoginPath(user, requested) {
  const fallback = ROLE_DASHBOARDS[user?.role] || "/";
  if (!isSafeInternalPath(requested)) return fallback;
  const pathname = requested.split(/[?#]/)[0];
  if (AUTH_PAGES.some((page) => pathname === page)) return fallback;
  const sections = Object.entries(ROLE_PREFIX);
  const section = sections.find(([, prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (section && section[0] !== user?.role) return fallback;
  return requested;
}

/** An account from `GET /platform-admin/users/` in the shape the admin pages use. */
export function mapAdminUser(api) {
  const user = mapUser(api);
  return {
    ...user,
    createdAt: Date.parse(api.date_joined) || 0,
    lastLogin: api.last_login ? Date.parse(api.last_login) : null,
    emailVerified: Boolean(api.email_verified),
  };
}
