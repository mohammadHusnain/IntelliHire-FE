import { describe, expect, it } from "vitest";
import { HttpResponse } from "msw";
import { server } from "@/test/server";
import { apiUser, companyUser, errors, json, route, tokens } from "@/test/fixtures";
import { getTokens, setTokens, SESSION_KEY } from "@/api/tokenStorage";
import { handleSessionEnded, useAuthStore } from "./authStore";

const store = () => useAuthStore.getState();
const loginOk = (user = apiUser()) => route.post("/auth/login/", () => json({ access: "A1", refresh: "R1", user }));

describe("login", () => {
  it("stores the tokens, builds the user and reports success", async () => {
    server.use(loginOk());
    const result = await store().login("sara@example.com", "pw");
    expect(result).toMatchObject({ success: true, user: { name: "Sara Malik", role: "candidate" } });
    expect(getTokens()).toEqual({ access: "A1", refresh: "R1" });
    expect(store()).toMatchObject({ isAuthenticated: true, isLoading: false, error: null });
  });

  it("does not cache the user in storage (it is rebuilt from the server on every load)", async () => {
    server.use(loginOk());
    await store().login("a", "b");
    expect(localStorage.getItem(SESSION_KEY)).not.toBeNull();
    expect(localStorage.getItem("intellihire_user")).toBeNull();
    expect(JSON.stringify(Object.values(localStorage))).not.toContain("Sara Malik");
  });

  it("maps a company admin to the company role", async () => {
    server.use(loginOk(companyUser()));
    expect((await store().login("a", "b")).user).toMatchObject({ role: "company", memberRole: "admin" });
  });

  it.each([
    ["invalid credentials", errors.invalidCredentials, 401, "invalid_credentials"],
    ["pending verification", errors.pendingVerification, 403, "pending_verification"],
    ["pending approval", errors.pendingApproval, 403, "pending_approval"],
    ["rejected", errors.rejected, 403, "rejected"],
    ["suspended", errors.suspended, 403, "suspended"],
  ])("a failed login (%s) returns the server message and code and stores nothing", async (_n, make, status, code) => {
    server.use(route.post("/auth/login/", make));
    const result = await store().login("a", "b");
    expect(result).toMatchObject({ success: false, status, code });
    expect(result.error).toBeTruthy();
    expect(getTokens()).toBeNull();
    expect(store().isAuthenticated).toBe(false);
    expect(store().isLoading).toBe(false);
  });

  it("returns the wait on a throttle", async () => {
    server.use(route.post("/auth/login/", () => errors.throttled(41)));
    expect(await store().login("a", "b")).toMatchObject({ success: false, code: "throttled", retryAfterSeconds: 41 });
  });

  it("returns a network failure as a flagged result, never a thrown error", async () => {
    server.use(route.post("/auth/login/", () => HttpResponse.error()));
    expect(await store().login("a", "b")).toMatchObject({ success: false, isNetwork: true });
  });
});

describe("registration never signs the user in", () => {
  it("candidate", async () => {
    server.use(route.post("/auth/register/candidate/", () => json({ email: "a@b.co", status: "pending_verification" }, 201)));
    expect(await store().registerCandidate({ fullName: "A", email: "a@b.co", password: "p", confirmPassword: "p" })).toMatchObject({ success: true, email: "a@b.co" });
    expect(getTokens()).toBeNull();
    expect(store().isAuthenticated).toBe(false);
  });

  it("returns field errors for the form", async () => {
    server.use(route.post("/auth/register/company/", () => json({ official_email: ["Email already registered."], admin_phone: ["Enter a valid phone number."] }, 400)));
    const result = await store().registerCompany({ fullName: "A", email: "a@b.co", password: "p", confirmPassword: "p", companyName: "X", industry: "Y", phone: "1" });
    expect(result).toMatchObject({ success: false, fieldErrors: { official_email: ["Email already registered."], admin_phone: ["Enter a valid phone number."] } });
  });
});

describe("initialize", () => {
  it("without tokens: signed out, ready", async () => {
    await store().initialize();
    expect(store()).toMatchObject({ isInitialized: true, isAuthenticated: false, bootError: null });
  });

  it("with tokens: rebuilds the user from /me", async () => {
    setTokens(tokens(1));
    server.use(route.get("/auth/me/", () => json(apiUser({ full_name: "Fresh Name" }))));
    await store().initialize();
    expect(store().user.name).toBe("Fresh Name");
    expect(store().isAuthenticated).toBe(true);
  });

  it("never trusts a cached user: a role change on the server wins", async () => {
    setTokens(tokens(1));
    localStorage.setItem("intellihire_user", JSON.stringify({ id: "x", role: "admin" }));
    server.use(route.get("/auth/me/", () => json(apiUser({ role: "candidate" }))));
    await store().initialize();
    expect(store().user.role).toBe("candidate");
    expect(localStorage.getItem("intellihire_user")).toBeNull(); // the old demo key is removed
  });

  it("a token that /me refuses (and refresh cannot fix) ends in a clean signed-out state", async () => {
    setTokens(tokens(1));
    server.use(route.get("/auth/me/", () => errors.tokenInvalid()), route.post("/auth/token/refresh/", () => errors.tokenInvalid()));
    await store().initialize();
    expect(store()).toMatchObject({ isInitialized: true, isAuthenticated: false, bootError: null });
    expect(getTokens()).toBeNull();
  });

  it("an expired access token is refreshed silently on boot", async () => {
    setTokens(tokens(1));
    server.use(
      route.get("/auth/me/", ({ request }) => (request.headers.get("authorization") === "Bearer A2" ? json(apiUser()) : errors.tokenInvalid())),
      route.post("/auth/token/refresh/", () => json({ access: "A2", refresh: "R2" })),
    );
    await store().initialize();
    expect(store().isAuthenticated).toBe(true);
    expect(getTokens()).toEqual({ access: "A2", refresh: "R2" });
  });

  it("when the server is unreachable the session is KEPT and a retry is offered", async () => {
    setTokens(tokens(1));
    server.use(route.get("/auth/me/", () => HttpResponse.error()));
    await store().initialize();
    expect(store()).toMatchObject({ isInitialized: true, isAuthenticated: false });
    expect(store().bootError).toMatch(/reach the server/);
    expect(getTokens()).toEqual(tokens(1));
    server.use(route.get("/auth/me/", () => json(apiUser())));
    await store().initialize();
    expect(store()).toMatchObject({ isAuthenticated: true, bootError: null });
  });

  it("a 5xx at boot keeps the session too", async () => {
    setTokens(tokens(1));
    server.use(route.get("/auth/me/", () => json({}, 503)));
    await store().initialize();
    expect(store().bootError).toBeTruthy();
    expect(getTokens()).toEqual(tokens(1));
  });

  it("corrupt stored data is treated as signed out", async () => {
    localStorage.setItem(SESSION_KEY, "{broken");
    await store().initialize();
    expect(store()).toMatchObject({ isInitialized: true, isAuthenticated: false });
  });

  it("a suspended account (401 account_inactive) is signed out with a notice", async () => {
    setTokens(tokens(1));
    const { setSessionEndedHandler } = await import("@/api/client");
    setSessionEndedHandler(handleSessionEnded);
    server.use(route.get("/auth/me/", () => errors.accountInactive()));
    await store().initialize();
    expect(store()).toMatchObject({ isAuthenticated: false, notice: "suspended" });
    expect(getTokens()).toBeNull();
  });
});

describe("logout", () => {
  it("signs out locally at once and revokes the refresh token in the background", async () => {
    setTokens(tokens(1));
    useAuthStore.setState({ user: { id: "1" }, isAuthenticated: true });
    let revoked;
    server.use(route.post("/auth/logout/", async ({ request }) => ((revoked = [request.headers.get("authorization"), await request.json()]), new Response(null, { status: 205 }))));
    const pending = store().logout();
    expect(store().isAuthenticated).toBe(false); // already, before the request finished
    expect(getTokens()).toBeNull();
    await pending;
    expect(revoked).toEqual(["Bearer access-1", { refresh: "refresh-1" }]);
  });

  it("still signs out when the server is down", async () => {
    setTokens(tokens(1));
    useAuthStore.setState({ user: { id: "1" }, isAuthenticated: true });
    server.use(route.post("/auth/logout/", () => HttpResponse.error()));
    await store().logout();
    expect(store().isAuthenticated).toBe(false);
    expect(getTokens()).toBeNull();
  });

  it("is harmless when already signed out", async () => {
    await expect(store().logout()).resolves.toBeUndefined();
  });
});

describe("password flows end the session everywhere", () => {
  const signedIn = () => {
    setTokens(tokens(1));
    useAuthStore.setState({ user: { id: "1", role: "candidate" }, isAuthenticated: true });
  };

  it("change password success signs out with a notice", async () => {
    signedIn();
    server.use(route.post("/auth/password/change/", () => json({ detail: "ok" })));
    expect(await store().changePassword({ current: "old", next: "N3w-pass-99" })).toMatchObject({ success: true });
    expect(store()).toMatchObject({ isAuthenticated: false, notice: "password-changed" });
    expect(getTokens()).toBeNull();
  });

  it("a wrong current password keeps the session and returns the field error", async () => {
    signedIn();
    server.use(route.post("/auth/password/change/", () => json({ old_password: ["Current password is incorrect."] }, 400)));
    const result = await store().changePassword({ current: "x", next: "N3w-pass-99" });
    expect(result).toMatchObject({ success: false, fieldErrors: { old_password: ["Current password is incorrect."] } });
    expect(store().isAuthenticated).toBe(true);
    expect(getTokens()).toEqual(tokens(1));
  });

  it("reset password success clears any local session and sets a notice", async () => {
    signedIn();
    server.use(route.post("/auth/password/reset/", () => json({ detail: "ok" })));
    await store().resetPassword({ uid: "u", token: "t", password: "N3w-pass-99", confirmPassword: "N3w-pass-99" });
    expect(store()).toMatchObject({ isAuthenticated: false, notice: "password-reset" });
  });

  it("an invalid reset link keeps everything as it was", async () => {
    server.use(route.post("/auth/password/reset/", () => json({ detail: "Reset link is invalid or has expired.", code: "invalid_token" }, 400)));
    const result = await store().resetPassword({ uid: "u", token: "t", password: "p", confirmPassword: "p" });
    expect(result).toMatchObject({ success: false, code: "invalid_token", error: "Reset link is invalid or has expired." });
    expect(store().notice).toBeNull();
  });
});

describe("other actions", () => {
  it("verify, resend and forgot return results and never throw", async () => {
    server.use(
      route.post("/auth/verify-email/", () => json({ detail: "ok", status: "active" })),
      route.post("/auth/resend-verification/", () => errors.throttled(5)),
      route.post("/auth/password/forgot/", () => HttpResponse.error()),
    );
    expect(await store().verifyEmail("t")).toMatchObject({ success: true, status: "active" });
    expect(await store().resendVerification("a@b.co")).toMatchObject({ success: false, retryAfterSeconds: 5 });
    expect(await store().forgotPassword("a@b.co")).toMatchObject({ success: false, isNetwork: true });
  });

  it("updateMe updates the user in the store", async () => {
    setTokens(tokens(1));
    server.use(route.patch("/auth/me/", () => json(apiUser({ full_name: "Renamed" }))));
    expect((await store().updateMe({ fullName: "Renamed" })).user.name).toBe("Renamed");
    expect(store().user.name).toBe("Renamed");
  });

  it("refresh re-reads the user, and ends the session when the server refuses", async () => {
    setTokens(tokens(1));
    server.use(route.get("/auth/me/", () => json(apiUser({ full_name: "Again" }))));
    expect((await store().refresh()).user.name).toBe("Again");
    server.use(route.get("/auth/me/", () => errors.tokenInvalid()), route.post("/auth/token/refresh/", () => errors.tokenInvalid()));
    await store().refresh();
    expect(store()).toMatchObject({ isAuthenticated: false, notice: "expired" });
  });

  it("refresh with a network failure does not sign the user out", async () => {
    setTokens(tokens(1));
    useAuthStore.setState({ user: { id: "1" }, isAuthenticated: true });
    server.use(route.get("/auth/me/", () => HttpResponse.error()));
    expect((await store().refresh()).error).toMatch(/reach the server/);
    expect(store().isAuthenticated).toBe(true);
  });

  it("getDashboardPath follows the mapped role", () => {
    useAuthStore.setState({ user: { role: "company" } });
    expect(store().getDashboardPath()).toBe("/company/dashboard");
    useAuthStore.setState({ user: { role: "admin" } });
    expect(store().getDashboardPath()).toBe("/admin/dashboard");
    useAuthStore.setState({ user: null });
    expect(store().getDashboardPath()).toBe("/login");
  });

  it("clearNotice", () => {
    useAuthStore.setState({ notice: "expired" });
    store().clearNotice();
    expect(store().notice).toBeNull();
  });
});

describe("cross-tab and server-ended sessions", () => {
  it("handleSessionEnded signs out with the reason", () => {
    useAuthStore.setState({ user: { id: "1" }, isAuthenticated: true });
    handleSessionEnded("expired");
    expect(store()).toMatchObject({ isAuthenticated: false, notice: "expired" });
  });
});

