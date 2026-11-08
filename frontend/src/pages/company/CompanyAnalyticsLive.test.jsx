import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { server } from "@/test/server";
import { apiDashboard, apiJobRow, detail, json, paged, route } from "@/test/fixtures";
import { useAuthStore } from "@/store/authStore";
import { setTokens } from "@/api/tokenStorage";
import CompanyAnalyticsLive from "./CompanyAnalyticsLive";

function mount({ dashboard = apiDashboard(), roles = [apiJobRow({ id: "j1", title: "Backend Engineer", applications_count: 6 }), apiJobRow({ id: "j2", title: "Designer", applications_count: 3 }), apiJobRow({ id: "j3", title: "Nobody applied", applications_count: 0 })], handlers = [] } = {}) {
  setTokens({ access: "a", refresh: "r" });
  useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: { id: "u1", role: "company", status: "active", name: "Ali", email: "ali@acme.example", memberRole: "admin", companyStatus: "approved" } });
  server.use(...handlers, route.get("/company/dashboard/", () => json(dashboard)), route.get("/jobs/", () => paged(roles)));
  render(<MemoryRouter><CompanyAnalyticsLive /></MemoryRouter>);
}

describe("CompanyAnalyticsLive", () => {
  it("shows the real pipeline counts with their share of all applications", async () => {
    mount();
    expect(await screen.findByText("10 applications across 6 roles")).toBeInTheDocument();
    expect(screen.getByText("4 in the last 7 days")).toBeInTheDocument();
    expect(screen.getByText("1 draft · 3 closed")).toBeInTheDocument();
    const applied = screen.getByText("Applied").closest("li");
    expect(applied).toHaveTextContent("3 (30%)");
    expect(screen.getByText("Rejected").closest("li")).toHaveTextContent("1 (10%)");
    expect(screen.getByText("On hold").closest("li")).toHaveTextContent("0 (0%)");
  });

  it("lists applications per role (only roles with applications), each opening its candidates", async () => {
    mount();
    const link = await screen.findByRole("link", { name: /Backend Engineer/ });
    expect(link).toHaveAttribute("href", "/company/jobs/j1/candidates");
    expect(screen.getByRole("link", { name: /Designer/ })).toBeInTheDocument();
    expect(screen.queryByText("Nobody applied")).not.toBeInTheDocument();
  });

  it("asks the server to order the roles by applications", async () => {
    let q;
    mount({ handlers: [route.get("/jobs/", ({ request }) => ((q = Object.fromEntries(new URL(request.url).searchParams)), paged([])))] });
    await screen.findByText("10 applications across 6 roles");
    expect(q).toMatchObject({ ordering: "-applications_count", page_size: "10" });
  });

  it("draws nothing it does not have: no trends, sources or match scores", async () => {
    mount();
    await screen.findByText("10 applications across 6 roles");
    expect(screen.queryByText(/cv match|source breakdown|average/i)).not.toBeInTheDocument();
    expect(screen.getByText(/trends over time, sources and match scores will appear/i)).toBeInTheDocument();
  });

  it("a company with no applications gets an empty state", async () => {
    mount({ dashboard: apiDashboard({ applicants: { total: 0, new_last_7_days: 0 } }), roles: [] });
    expect(await screen.findByText("Nothing to analyse yet")).toBeInTheDocument();
  });

  it("a 403 shows the blocked screen", async () => {
    mount({ handlers: [route.get("/company/dashboard/", () => detail(403, "Unauthorized access.", "permission_denied")), route.get("/auth/me/", () => json({ id: "u1", email: "ali@acme.example", full_name: "Ali", role: "company_admin", status: "active", company: { id: "c0", name: "Acme", member_role: "admin", status: "suspended" } }))] });
    expect(await screen.findByText("Your company is suspended")).toBeInTheDocument();
  });

  it("an error offers a retry that works", async () => {
    let fail = true;
    mount({ handlers: [route.get("/company/dashboard/", () => (fail ? detail(500, "Something went wrong.", "server_error") : json(apiDashboard())))] });
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fail = false;
    await userEvent.setup().click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("10 applications across 6 roles")).toBeInTheDocument();
  });
});
