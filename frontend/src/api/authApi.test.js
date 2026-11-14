import { beforeEach, describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { apiUser, errors, json, route, tokens } from "@/test/fixtures";
import { realAuthApi as auth } from "./authApi";
import { clearTokens, setTokens } from "./tokenStorage";

beforeEach(() => clearTokens());

describe("login and session", () => {
  it("returns tokens and the mapped user", async () => {
    server.use(route.post("/auth/login/", () => json({ access: "A", refresh: "R", user: apiUser({ role: "hr", company: { id: "c", name: "Acme", member_role: "recruiter", status: "approved" } }) })));
    const result = await auth.login("a@b.co", "pw");
    expect(result.tokens).toEqual({ access: "A", refresh: "R" });
    expect(result.user).toMatchObject({ role: "company", memberRole: "recruiter" });
  });

  it("sends the credentials without an Authorization header", async () => {
    setTokens(tokens(1));
    let seen;
    server.use(route.post("/auth/login/", async ({ request }) => ((seen = { auth: request.headers.get("authorization"), body: await request.json() }), json({ access: "A", refresh: "R", user: apiUser() }))));
    await auth.login("a@b.co", "pw");
    expect(seen).toEqual({ auth: null, body: { email: "a@b.co", password: "pw" } });
  });

  it("surfaces the server's refusal", async () => {
    server.use(route.post("/auth/login/", () => errors.pendingApproval()));
    await expect(auth.login("a@b.co", "pw")).rejects.toMatchObject({ status: 403, code: "pending_approval" });
  });

  it("me() maps the user and updateMe() sends full_name only", async () => {
    setTokens(tokens(1));
    let patch;
    server.use(
      route.get("/auth/me/", () => json(apiUser())),
      route.patch("/auth/me/", async ({ request }) => ((patch = await request.json()), json(apiUser({ full_name: "New Name" })))),
    );
    expect((await auth.me()).name).toBe("Sara Malik");
    expect((await auth.updateMe({ fullName: "New Name" })).name).toBe("New Name");
    expect(patch).toEqual({ full_name: "New Name" });
  });
});

describe("registration payloads", () => {
  const base = { fullName: "Sara Malik", email: "sara@example.com", password: "pw", confirmPassword: "pw" };

  it("candidate without a CV is JSON with only the fields that were filled", async () => {
    let body;
    server.use(route.post("/auth/register/candidate/", async ({ request }) => ((body = await request.json()), json({ email: "sara@example.com", status: "pending_verification" }, 201))));
    await auth.registerCandidate({ ...base, targetRole: "Backend Developer", skills: ["Python", "SQL"], linkedinUrl: "https://linkedin.com/in/s", githubUrl: "" });
    expect(body).toEqual({ full_name: "Sara Malik", email: "sara@example.com", password: "pw", confirm_password: "pw", target_role: "Backend Developer", skills: ["Python", "SQL"], linkedin_url: "https://linkedin.com/in/s" });
  });

  it("candidate with a CV is multipart with repeated skills keys", async () => {
    let form;
    let contentType;
    server.use(route.post("/auth/register/candidate/", async ({ request }) => ((contentType = request.headers.get("content-type")), (form = await request.formData()), json({ email: "x", status: "pending_verification" }, 201))));
    const cv = new File(["%PDF"], "My CV.pdf", { type: "application/pdf" });
    await auth.registerCandidate({ ...base, targetRole: "QA", skills: ["Testing", "Python"], cvFile: cv });
    expect(contentType).toMatch(/multipart\/form-data/);
    expect(form.getAll("skills")).toEqual(["Testing", "Python"]);
    // (jsdom's File passes through Node's fetch, which drops the file name; the e2e test checks the real name)
    expect(await form.get("resume").text()).toBe("%PDF");
    expect([form.get("full_name"), form.get("target_role"), form.get("confirm_password")]).toEqual(["Sara Malik", "QA", "pw"]);
    expect(form.has("linkedin_url")).toBe(false);
  });

  it("company registration uses the backend field names (work email is the official email)", async () => {
    let body;
    server.use(route.post("/auth/register/company/", async ({ request }) => ((body = await request.json()), json({ email: "hr@acme.example", status: "pending_verification" }, 201))));
    await auth.registerCompany({ ...base, email: "hr@acme.example", companyName: "Acme", industry: "Technology", phone: "+92 300 1234567" });
    expect(body).toEqual({ company_name: "Acme", industry: "Technology", official_email: "hr@acme.example", admin_full_name: "Sara Malik", admin_phone: "+92 300 1234567", password: "pw", confirm_password: "pw" });
  });
});

describe("email and password flows", () => {
  it("verify, resend and forgot send the right bodies without a token", async () => {
    setTokens(tokens(1));
    const seen = {};
    server.use(
      route.post("/auth/verify-email/", async ({ request }) => ((seen.verify = await request.json()), json({ detail: "ok", status: "active" }))),
      route.post("/auth/resend-verification/", async ({ request }) => ((seen.resend = await request.json()), json({ detail: "sent" }))),
      route.post("/auth/password/forgot/", async ({ request }) => ((seen.forgot = [await request.json(), request.headers.get("authorization")]), json({ detail: "sent" }))),
    );
    await auth.verifyEmail("sara@example.com", "123456");
    await auth.resendVerification("a@b.co");
    await auth.forgotPassword("a@b.co");
    expect(seen).toEqual({
      verify: { email: "sara@example.com", code: "123456" },
      resend: { email: "a@b.co" },
      forgot: [{ email: "a@b.co" }, null],
    });
  });

  it("reset maps to new_password / confirm_password", async () => {
    let body;
    server.use(route.post("/auth/password/reset/", async ({ request }) => ((body = await request.json()), json({ detail: "ok" }))));
    await auth.resetPassword({ uid: "u", token: "t", password: "N3w-pass-99", confirmPassword: "N3w-pass-99" });
    expect(body).toEqual({ uid: "u", token: "t", new_password: "N3w-pass-99", confirm_password: "N3w-pass-99" });
  });

  it("change password sends old_password and new_password only", async () => {
    setTokens(tokens(1));
    let body;
    server.use(route.post("/auth/password/change/", async ({ request }) => ((body = await request.json()), json({ detail: "ok" }))));
    await auth.changePassword({ current: "old", next: "N3w-pass-99" });
    expect(body).toEqual({ old_password: "old", new_password: "N3w-pass-99" });
  });
});

describe("logout", () => {
  it("revokes the captured refresh token", async () => {
    let seen;
    server.use(route.post("/auth/logout/", async ({ request }) => ((seen = [request.headers.get("authorization"), await request.json()]), new Response(null, { status: 205 }))));
    await auth.logout(tokens(1));
    expect(seen).toEqual(["Bearer access-1", { refresh: "refresh-1" }]);
  });

  it("does nothing without tokens", async () => {
    let called = false;
    server.use(route.post("/auth/logout/", () => ((called = true), new Response(null, { status: 205 }))));
    await auth.logout(null);
    expect(called).toBe(false);
  });

  it("rotates once and revokes the NEW refresh token when the access token had expired", async () => {
    const calls = [];
    server.use(
      route.post("/auth/logout/", async ({ request }) => {
        const body = await request.json();
        calls.push(["logout", request.headers.get("authorization"), body.refresh]);
        return request.headers.get("authorization") === "Bearer access-2" ? new Response(null, { status: 205 }) : errors.tokenInvalid();
      }),
      route.post("/auth/token/refresh/", () => (calls.push(["refresh"]), json({ access: "access-2", refresh: "refresh-2" }))),
    );
    await auth.logout(tokens(1));
    expect(calls).toEqual([["logout", "Bearer access-1", "refresh-1"], ["refresh"], ["logout", "Bearer access-2", "refresh-2"]]);
  });

  it("never throws, whatever goes wrong", async () => {
    server.use(route.post("/auth/logout/", () => json({}, 500)));
    await expect(auth.logout(tokens(1))).resolves.toBeUndefined();
    const { HttpResponse } = await import("msw");
    server.use(route.post("/auth/logout/", () => HttpResponse.error()));
    await expect(auth.logout(tokens(1))).resolves.toBeUndefined();
    server.use(route.post("/auth/logout/", () => errors.tokenInvalid()), route.post("/auth/token/refresh/", () => errors.tokenInvalid()));
    await expect(auth.logout(tokens(1))).resolves.toBeUndefined();
  });
});
