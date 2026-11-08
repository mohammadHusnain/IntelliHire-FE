import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { server } from "@/test/server";
import { apiDashboard, detail, json, route } from "@/test/fixtures";
import { useAuthStore } from "@/store/authStore";
import { setTokens } from "@/api/tokenStorage";
import CompanyDashboardLive from "./CompanyDashboardLive";

function mount(dashboard) {
  setTokens({ access: "a", refresh: "r" });
  useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: { id: "u1", role: "company", status: "active", name: "Ali Khan", email: "ali@acme.example", memberRole: "admin", companyStatus: "approved" } });
  if (dashboard) server.use(dashboard);
  return render(<MemoryRouter><CompanyDashboardLive /></MemoryRouter>);
}

describe("CompanyDashboardLive", () => {
  it("shows every block from the server's numbers", async () => {
    mount(route.get("/company/dashboard/", () => json(apiDashboard())));
    expect(await screen.findByText("3 new applicants to", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("4 in the last 7 days")).toBeInTheDocument();
    expect(screen.getByText("1 draft · 3 closed")).toBeInTheDocument();
    expect(screen.getByText("Backend Engineer", { selector: "span.block" })).toBeInTheDocument();
    expect(screen.getByText("Sara Malik")).toBeInTheDocument();
    expect(screen.getByText("Your company profile is 40% complete")).toBeInTheDocument();
    expect(screen.getByText("1 pending invitation")).toBeInTheDocument();
  });

  it("renders no demo numbers; closing-soon rows open the real role preview and recent applications open the candidate", async () => {
    mount(route.get("/company/dashboard/", () => json(apiDashboard())));
    await screen.findByText("Sara Malik");
    expect(screen.queryByText(/average cv match/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /backend engineer/i }).map((l) => l.getAttribute("href"))).toEqual(expect.arrayContaining(["/company/jobs/j1/preview", "/company/candidates/app-1"]));
    expect(screen.getByRole("link", { name: /sara malik/i })).toHaveAttribute("href", "/company/candidates/app-1");
  });

  it("a recent application without an id (an older server) stays plain text", async () => {
    mount(route.get("/company/dashboard/", () => json(apiDashboard({ recent_applications: [{ candidate_name: "Old Row", job_title: "T", submitted_at: "2026-02-28T00:00:00Z", status: "submitted" }] }))));
    expect(await screen.findByText("Old Row")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /old row/i })).not.toBeInTheDocument();
  });

  it("a brand-new company gets friendly empty states, all zeros", async () => {
    mount(route.get("/company/dashboard/", () => json(apiDashboard({
      jobs: { open: 0, draft: 0, closed: 0 }, applicants: { total: 0, new_last_7_days: 0 },
      pipeline: { submitted: 0, under_review: 0, shortlisted: 0, interview: 0, selected: 0, rejected: 0, on_hold: 0 },
      closing_soon: [], recent_applications: [], team: { active_members: 1, pending_invitations: 0 },
      company: { name: "Acme", logo: null, status: "approved", profile_completion: 100 },
    }))));
    expect(await screen.findByText("No applicants yet")).toBeInTheDocument();
    expect(screen.getByText("Nothing closing soon")).toBeInTheDocument();
    expect(screen.getByText("No applications yet")).toBeInTheDocument();
    expect(screen.queryByText(/profile is \d+% complete/)).not.toBeInTheDocument();
  });

  it("a 403 shows the blocked screen", async () => {
    mount(route.get("/company/dashboard/", () => detail(403, "Unauthorized access.", "permission_denied")));
    server.use(route.get("/auth/me/", () => json({ id: "u1", email: "ali@acme.example", full_name: "Ali Khan", role: "company_admin", status: "active", company: { id: "c0", name: "Acme", member_role: "admin", status: "suspended" } })));
    expect(await screen.findByText("Your company is suspended")).toBeInTheDocument();
  });

  it("an error offers a retry that works", async () => {
    let fail = true;
    mount(route.get("/company/dashboard/", () => (fail ? detail(500, "Something went wrong.", "server_error") : json(apiDashboard()))));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fail = false;
    await userEvent.setup().click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("Sara Malik")).toBeInTheDocument();
  });
});
