import { describe, expect, it } from "vitest";
import { apiAdminCompany, apiCompanyProfile, apiDashboard, apiInvitation, apiMember } from "@/test/fixtures";
import {
  changedCompanyFields, companySizeLabel, isCompanyAdmin, mapAdminCompany, mapCompanyProfile, mapCompanyStatus, mapDashboard, mapInvitation, mapMember, memberRoleLabel,
} from "./companyMap";

describe("company status", () => {
  it.each([["approved", "active"], ["pending", "pending"], ["rejected", "rejected"], ["suspended", "suspended"]])("%s -> %s", (backend, ui) => {
    expect(mapCompanyStatus(backend)).toBe(ui);
  });
  it("passes an unknown status through instead of hiding it", () => expect(mapCompanyStatus("weird")).toBe("weird"));
});

describe("member roles", () => {
  it("labels the backend roles", () => {
    expect(memberRoleLabel("hr_manager")).toBe("HR manager");
    expect(memberRoleLabel("viewer")).toBe("Viewer");
  });
  it("only the admin member role counts as company admin", () => {
    expect(isCompanyAdmin({ memberRole: "admin" })).toBe(true);
    expect(isCompanyAdmin({ memberRole: "recruiter" })).toBe(false);
    expect(isCompanyAdmin(null)).toBe(false);
  });
});

describe("company profile", () => {
  it("maps the backend fields to the names the pages use", () => {
    const p = mapCompanyProfile(apiCompanyProfile({ headquarters: "Lahore", company_size: "11-50", profile_completion: 60, logo: "http://x/l.png" }), { name: "Ali" });
    expect(p).toMatchObject({ companyName: "Acme", location: "Lahore", companySize: "11-50", phone: "+92 300 1234567", email: "hr@acme.example", ownerName: "Ali", status: "active", completion: 60, logo: "http://x/l.png" });
  });
  it("sends only what changed, under backend names, trimmed", () => {
    const base = mapCompanyProfile(apiCompanyProfile(), { name: "Ali" });
    expect(changedCompanyFields({ ...base }, base)).toEqual({});
    expect(changedCompanyFields({ ...base, companyName: " Acme 2 ", location: "Karachi", phone: "+92 300 0000000" }, base)).toEqual({ name: "Acme 2", headquarters: "Karachi", contact_phone: "+92 300 0000000" });
  });
  it("can clear a field", () => {
    const base = mapCompanyProfile(apiCompanyProfile({ website: "https://acme.example" }), {});
    expect(changedCompanyFields({ ...base, website: "" }, base)).toEqual({ website: "" });
  });
  it("labels the sizes the backend accepts", () => expect(companySizeLabel("1000+")).toBe("1,000+ employees"));
});

describe("team", () => {
  it("maps a member", () => {
    expect(mapMember(apiMember({ id: 7, role: "hr_manager", job_title: "Head of HR", is_active: false }))).toMatchObject({ id: 7, name: "Ali Khan", roleLabel: "HR manager", jobTitle: "Head of HR", active: false });
  });
  it("maps an invitation (the status already says expired)", () => {
    expect(mapInvitation(apiInvitation({ status: "expired" }))).toMatchObject({ id: "inv-1", name: "New Hire", status: "expired", roleLabel: "Recruiter" });
  });
});

describe("dashboard", () => {
  it("maps every block", () => {
    const d = mapDashboard(apiDashboard());
    expect(d.jobs).toEqual({ open: 2, draft: 1, closed: 3 });
    expect(d.applicants).toEqual({ total: 10, newLast7Days: 4 });
    expect(d.pipeline.underReview).toBe(2);
    expect(d.closingSoon[0]).toMatchObject({ title: "Backend Engineer", applicationCount: 5 });
    expect(d.recent[0]).toMatchObject({ candidateName: "Sara Malik", status: "submitted" });
    expect(d.team).toEqual({ activeMembers: 3, pendingInvitations: 1 });
    expect(d.company.status).toBe("active");
  });
  it("survives a response with blocks missing (zeros and empty lists, no crash)", () => {
    const d = mapDashboard({});
    expect(d.jobs.open).toBe(0);
    expect(d.closingSoon).toEqual([]);
    expect(d.recent).toEqual([]);
  });
});

describe("admin company row", () => {
  it("maps a list row", () => {
    expect(mapAdminCompany(apiAdminCompany())).toMatchObject({ id: "co-1", companyName: "Acme", name: "Ali Khan", email: "hr@acme.example", status: "pending", adminEmailVerified: true });
  });
  it("shows the reason that matches the status", () => {
    expect(mapAdminCompany(apiAdminCompany({ status: "rejected", rejection_reason: "Not a real company", suspension_reason: "" })).statusReason).toBe("Not a real company");
    expect(mapAdminCompany(apiAdminCompany({ status: "suspended", suspension_reason: "Policy breach here" })).statusReason).toBe("Policy breach here");
    expect(mapAdminCompany(apiAdminCompany({ status: "approved", rejection_reason: "old" })).statusReason).toBe("");
  });
});
