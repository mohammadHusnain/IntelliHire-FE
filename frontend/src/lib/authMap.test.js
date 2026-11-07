import { describe, expect, it } from "vitest";
import { isSafeInternalPath, mapAdminUser, mapUser, resolvePostLoginPath } from "./authMap";
import { apiUser, companyUser } from "@/test/fixtures";

describe("mapUser", () => {
  it("maps a candidate", () => {
    expect(mapUser(apiUser())).toMatchObject({ id: "11111111-1111-1111-1111-111111111111", email: "sara@example.com", name: "Sara Malik", role: "candidate", status: "active", memberRole: null, companyId: null });
  });

  it.each([
    ["company_admin", "company"],
    ["hr", "company"],
    ["platform_admin", "admin"],
    ["candidate", "candidate"],
  ])("backend role %s is UI role %s and the real role is kept", (role, ui) => {
    const user = mapUser(apiUser({ role }));
    expect([user.role, user.backendRole]).toEqual([ui, role]);
  });

  it("an unknown future role maps to null instead of a guess", () => {
    expect(mapUser(apiUser({ role: "auditor" })).role).toBeNull();
  });

  it.each([
    ["pending_verification", "pending"],
    ["pending_approval", "pending"],
    ["active", "active"],
    ["rejected", "rejected"],
    ["suspended", "suspended"],
  ])("status %s becomes %s and the real status is kept", (status, ui) => {
    const user = mapUser(apiUser({ status }));
    expect([user.status, user.backendStatus]).toEqual([ui, status]);
  });

  it("carries the company and the member role", () => {
    expect(mapUser(companyUser({ role: "hr", company: { id: "c9", name: "Beta", member_role: "recruiter", status: "approved" } }))).toMatchObject({
      role: "company", memberRole: "recruiter", companyId: "c9", companyName: "Beta", companyStatus: "approved",
    });
  });

  it("returns null for nothing and tolerates a missing name", () => {
    expect(mapUser(null)).toBeNull();
    expect(mapUser(undefined)).toBeNull();
    expect(mapUser(apiUser({ full_name: undefined })).name).toBe("");
  });
});

describe("mapAdminUser", () => {
  it("adds dates and verification", () => {
    const user = mapAdminUser({ ...apiUser(), date_joined: "2026-03-01T10:00:00Z", last_login: null, email_verified: true });
    expect(user).toMatchObject({ createdAt: Date.parse("2026-03-01T10:00:00Z"), lastLogin: null, emailVerified: true, role: "candidate" });
  });
});

describe("isSafeInternalPath", () => {
  it.each(["/", "/candidate/dashboard", "/company/jobs?x=1#top", "/a/b-c_d"])("accepts %s", (p) => expect(isSafeInternalPath(p)).toBe(true));
  it.each([
    "//evil.example", "http://evil.example", "https://evil.example/x", "javascript:alert(1)", "/\\evil.example",
    "\\\\evil", "login", "", null, undefined, 5, "/x\ny", "/x\u0000", `/${"a".repeat(2001)}`, "data:text/html,x",
  ])("rejects %j", (p) => expect(isSafeInternalPath(p)).toBe(false));
});

describe("resolvePostLoginPath", () => {
  const candidate = { role: "candidate" };
  const company = { role: "company" };
  const admin = { role: "admin" };
  it("returns the requested page when it is allowed for the role", () => {
    expect(resolvePostLoginPath(candidate, "/candidate/profile?tab=cv")).toBe("/candidate/profile?tab=cv");
    expect(resolvePostLoginPath(company, "/company/jobs")).toBe("/company/jobs");
    expect(resolvePostLoginPath(admin, "/admin/users")).toBe("/admin/users");
    expect(resolvePostLoginPath(candidate, "/")).toBe("/");
  });
  it("falls back to the dashboard for another role's pages", () => {
    expect(resolvePostLoginPath(candidate, "/company/jobs")).toBe("/candidate/dashboard");
    expect(resolvePostLoginPath(company, "/admin/users")).toBe("/company/dashboard");
    expect(resolvePostLoginPath(admin, "/candidate/profile")).toBe("/admin/dashboard");
  });
  it("never redirects to another site or to the auth pages", () => {
    for (const bad of ["//evil.example", "https://evil.example", "javascript:alert(1)", "/login", "/register", "/verify-email", "/reset-password", undefined, null]) {
      expect(resolvePostLoginPath(candidate, bad)).toBe("/candidate/dashboard");
    }
  });
  it("is not fooled by a lookalike prefix", () => {
    expect(resolvePostLoginPath(candidate, "/candidates-evil")).toBe("/candidates-evil");
    expect(resolvePostLoginPath(company, "/candidate")).toBe("/company/dashboard");
  });
  it("falls back to the home page for an unknown role", () => {
    expect(resolvePostLoginPath({ role: null }, "/x")).toBe("/x");
    expect(resolvePostLoginPath(null, "//x")).toBe("/");
  });
});
