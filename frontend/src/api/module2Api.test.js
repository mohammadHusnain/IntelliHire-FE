import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { apiAdminCompany, apiCompanyProfile, apiDashboard, apiInvitation, apiMember, bearer, detail, json, paged, route } from "@/test/fixtures";
import { setTokens } from "./tokenStorage";
import { companyApi, isBlocked, mapCompanyFieldErrors } from "./companyApi";
import { platformCompaniesApi } from "./platformCompaniesApi";
import { invitationsApi } from "./invitationsApi";

const user = { name: "Ali" };

describe("companyApi", () => {
  it("loads the profile with the bearer token", async () => {
    setTokens({ access: "A", refresh: "R" });
    let auth;
    server.use(route.get("/company/profile/", ({ request }) => ((auth = bearer(request)), json(apiCompanyProfile()))));
    expect(await companyApi.profile(user)).toMatchObject({ companyName: "Acme", ownerName: "Ali" });
    expect(auth).toBe("Bearer A");
  });

  it("saves only the given fields (PATCH)", async () => {
    setTokens({ access: "A", refresh: "R" });
    let body;
    server.use(route.patch("/company/profile/", async ({ request }) => ((body = await request.json()), json(apiCompanyProfile({ headquarters: "Lahore" })))));
    const saved = await companyApi.saveProfile({ headquarters: "Lahore" }, user);
    expect(body).toEqual({ headquarters: "Lahore" });
    expect(saved.location).toBe("Lahore");
  });

  it("uploads a logo as multipart and removes it with null", async () => {
    setTokens({ access: "A", refresh: "R" });
    let form;
    let removed;
    server.use(
      route.patch("/company/profile/", async ({ request }) => {
        if (request.headers.get("content-type")?.includes("multipart")) form = await request.formData();
        else removed = await request.json();
        return json(apiCompanyProfile());
      }),
    );
    await companyApi.setLogo(new File([new Uint8Array([137, 80, 78, 71])], "logo.png", { type: "image/png" }), user);
    expect(form.get("logo")).toBeTruthy();
    await companyApi.removeLogo(user);
    expect(removed).toEqual({ logo: null });
  });

  it("maps server field errors to form fields", () => {
    expect(mapCompanyFieldErrors({ name: ["A company with this name is already registered."], headquarters: ["Too long."], contact_phone: ["Enter a valid phone number."] })).toEqual({
      companyName: "A company with this name is already registered.",
      location: "Too long.",
      phone: "Enter a valid phone number.",
    });
  });

  it("reads the dashboard, members and invitations (with the status filter)", async () => {
    setTokens({ access: "A", refresh: "R" });
    let status;
    server.use(
      route.get("/company/dashboard/", () => json(apiDashboard())),
      route.get("/company/members/", () => json([apiMember()])),
      route.get("/company/invitations/", ({ request }) => ((status = new URL(request.url).searchParams.get("status")), json([apiInvitation()]))),
    );
    expect((await companyApi.dashboard()).jobs.open).toBe(2);
    expect((await companyApi.members())[0].name).toBe("Ali Khan");
    expect((await companyApi.invitations({ status: "pending" }))[0].email).toBe("newbie@acme.example");
    expect(status).toBe("pending");
  });

  it("changes a member, invites, resends and revokes", async () => {
    setTokens({ access: "A", refresh: "R" });
    const seen = {};
    server.use(
      route.patch("/company/members/5/", async ({ request }) => ((seen.member = await request.json()), json(apiMember({ id: 5, role: "viewer" })))),
      route.post("/company/invitations/", async ({ request }) => ((seen.invite = await request.json()), json(apiInvitation(), 201))),
      route.post("/company/invitations/inv-1/resend/", () => ((seen.resend = true), json(apiInvitation()))),
      route.post("/company/invitations/inv-1/revoke/", () => ((seen.revoke = true), json(apiInvitation({ status: "revoked" })))),
    );
    expect((await companyApi.updateMember(5, { role: "viewer" })).role).toBe("viewer");
    await companyApi.invite({ email: "a@b.co", fullName: "A B", role: "recruiter", jobTitle: "" });
    expect((await companyApi.revokeInvitation("inv-1")).status).toBe("revoked");
    await companyApi.resendInvitation("inv-1");
    expect(seen).toMatchObject({ member: { role: "viewer" }, invite: { email: "a@b.co", full_name: "A B", role: "recruiter", job_title: "" }, resend: true, revoke: true });
  });

  it("surfaces the server's messages and codes (last_admin, 403)", async () => {
    setTokens({ access: "A", refresh: "R" });
    server.use(
      route.patch("/company/members/1/", () => detail(400, "The company must keep at least one active admin.", "last_admin")),
      route.get("/company/dashboard/", () => detail(403, "Unauthorized access.", "permission_denied")),
    );
    await expect(companyApi.updateMember(1, { is_active: false })).rejects.toMatchObject({ code: "last_admin", status: 400 });
    const error = await companyApi.dashboard().catch((e) => e);
    expect(isBlocked(error)).toBe(true);
    expect(isBlocked(new Error("x"))).toBe(false);
  });
});

describe("platformCompaniesApi", () => {
  it("lists with the backend status name, search and paging", async () => {
    setTokens({ access: "A", refresh: "R" });
    let q;
    server.use(route.get("/platform-admin/companies/", ({ request }) => ((q = new URL(request.url).searchParams), paged([apiAdminCompany()], { count: 45, next: "x" }))));
    const page = await platformCompaniesApi.list({ status: "active", search: " acme ", page: 2, pageSize: 20 });
    expect(Object.fromEntries(q)).toEqual({ status: "approved", search: "acme", page: "2", page_size: "20" });
    expect(page).toMatchObject({ count: 45, hasNext: true });
    expect(page.results[0].companyName).toBe("Acme");
  });

  it("'all' is sent as all", async () => {
    setTokens({ access: "A", refresh: "R" });
    let status;
    server.use(route.get("/platform-admin/companies/", ({ request }) => ((status = new URL(request.url).searchParams.get("status")), paged([]))));
    await platformCompaniesApi.list({ status: "all" });
    expect(status).toBe("all");
  });

  it("listAll walks every page and stops at the cap, saying so", async () => {
    setTokens({ access: "A", refresh: "R" });
    const asked = [];
    server.use(route.get("/platform-admin/companies/", ({ request }) => {
      const page = Number(new URL(request.url).searchParams.get("page"));
      asked.push(page);
      return paged([apiAdminCompany({ id: `c${page}` })], { count: 3, next: page < 3 ? "x" : null });
    }));
    expect(await platformCompaniesApi.listAll({ status: "all" })).toMatchObject({ truncated: false, results: [{ id: "c1" }, { id: "c2" }, { id: "c3" }] });
    expect(asked).toEqual([1, 2, 3]);
    asked.length = 0;
    const cut = await platformCompaniesApi.listAll({ status: "all" }, { cap: 2 });
    expect(cut.truncated).toBe(true);
    expect(cut.results).toHaveLength(2);
    expect(asked).toEqual([1, 2]);
  });

  it("builds the per-status counts from one-row requests", async () => {
    setTokens({ access: "A", refresh: "R" });
    const n = { pending: 4, approved: 10, rejected: 2, suspended: 1 };
    server.use(route.get("/platform-admin/companies/", ({ request }) => {
      const params = new URL(request.url).searchParams;
      expect(params.get("page_size")).toBe("1");
      return paged([], { count: n[params.get("status")] });
    }));
    expect(await platformCompaniesApi.counts()).toEqual({ pending: 4, active: 10, rejected: 2, suspended: 1, all: 17 });
  });

  it("approves, rejects and suspends with the reason, reactivates without one", async () => {
    setTokens({ access: "A", refresh: "R" });
    const seen = {};
    server.use(
      route.post("/platform-admin/companies/co-1/approve/", () => ((seen.approve = true), json(apiAdminCompany({ status: "approved" })))),
      route.post("/platform-admin/companies/co-1/reject/", async ({ request }) => ((seen.reject = await request.json()), json(apiAdminCompany({ status: "rejected" })))),
      route.post("/platform-admin/companies/co-1/suspend/", async ({ request }) => ((seen.suspend = await request.json()), json(apiAdminCompany({ status: "suspended" })))),
      route.post("/platform-admin/companies/co-1/reactivate/", () => ((seen.reactivate = true), json(apiAdminCompany({ status: "approved" })))),
    );
    expect((await platformCompaniesApi.approve("co-1")).status).toBe("active");
    await platformCompaniesApi.reject("co-1", "Not a real company");
    await platformCompaniesApi.suspend("co-1", "Policy breach here");
    await platformCompaniesApi.reactivate("co-1");
    expect(seen).toMatchObject({ approve: true, reject: { reason: "Not a real company" }, suspend: { reason: "Policy breach here" }, reactivate: true });
  });

  it("exposes 409 conflicts with their code", async () => {
    setTokens({ access: "A", refresh: "R" });
    server.use(route.post("/platform-admin/companies/co-1/approve/", () => detail(409, "Company has already been reviewed.", "already_reviewed")));
    await expect(platformCompaniesApi.approve("co-1")).rejects.toMatchObject({ status: 409, code: "already_reviewed" });
  });

  it("returns a reason error on its field", async () => {
    setTokens({ access: "A", refresh: "R" });
    server.use(route.post("/platform-admin/companies/co-1/reject/", () => json({ reason: ["Reason must be at least 10 characters."] }, 400)));
    await expect(platformCompaniesApi.reject("co-1", "short")).rejects.toMatchObject({ fieldErrors: { reason: ["Reason must be at least 10 characters."] } });
  });
});

describe("invitationsApi (public)", () => {
  it("reads an invitation without a bearer token and url-encodes the token", async () => {
    setTokens({ access: "A", refresh: "R" });
    let auth = "unset";
    let url;
    server.use(
      http_get(({ request }) => {
        auth = bearer(request);
        url = new URL(request.url).pathname;
        return json({ company: { name: "Acme", logo: null }, role: "recruiter", email: "n@acme.example", full_name: "New Hire" });
      }),
    );
    expect(await invitationsApi.details("a/b c")).toMatchObject({ companyName: "Acme", roleLabel: "Recruiter", email: "n@acme.example" });
    expect(auth).toBeNull();
    expect(url).toBe("/api/public/invitations/a%2Fb%20c/");
  });

  it("accepts with the password pair and returns no tokens", async () => {
    let body;
    server.use(route.post("/public/invitations/tok/accept/", async ({ request }) => ((body = await request.json()), json({ email: "n@acme.example", status: "active" }, 201))));
    expect(await invitationsApi.accept("tok", { fullName: "New Hire", password: "Abcdef-123", confirmPassword: "Abcdef-123" })).toEqual({ email: "n@acme.example", status: "active" });
    expect(body).toEqual({ full_name: "New Hire", password: "Abcdef-123", confirm_password: "Abcdef-123" });
  });

  it("explains each unusable link by its code", async () => {
    for (const code of ["invalid_invitation", "expired", "revoked", "already_used", "company_unavailable"]) {
      server.use(route.get("/public/invitations/t/", () => detail(400, `msg ${code}`, code)));
      await expect(invitationsApi.details("t")).rejects.toMatchObject({ code, message: `msg ${code}` });
    }
  });

  it("resubmits a rejected company with the backend field names", async () => {
    let body;
    server.use(route.post("/auth/register/company/resubmit/", async ({ request }) => ((body = await request.json()), json({ detail: "ok", status: "pending" }))));
    await invitationsApi.resubmitCompany({ email: "o@a.co", password: "pw", companyName: "Acme", industry: "Finance", fullName: "Ali", phone: "+92 300 1" });
    expect(body).toEqual({ official_email: "o@a.co", password: "pw", company_name: "Acme", industry: "Finance", admin_full_name: "Ali", admin_phone: "+92 300 1" });
  });
});

function http_get(resolver) {
  return route.get("/public/invitations/:token/", resolver);
}

