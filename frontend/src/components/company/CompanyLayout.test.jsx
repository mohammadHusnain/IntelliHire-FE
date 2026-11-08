import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { server } from "@/test/server";
import { apiJobRow, detail, paged, route } from "@/test/fixtures";
import { Where } from "@/test/utils";
import { useAuthStore } from "@/store/authStore";
import { useCompanyStore } from "@/store/companyStore";
import { setTokens } from "@/api/tokenStorage";
import CompanyLayout from "./CompanyLayout";

describe("CompanyLayout command palette (real roles)", () => {
  it("lists the company's real open roles and opens one on its preview page", async () => {
    setTokens({ access: "a", refresh: "r" });
    const account = { id: "u1", role: "company", status: "active", name: "Ali", email: "ali@acme.example", memberRole: "admin", companyStatus: "approved" };
    useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: account });
    useCompanyStore.getState().actions.hydrateProfile(account, { companyName: "Acme", ownerName: "Ali", email: "o@acme.example" });
    server.use(route.get("/jobs/", () => paged([apiJobRow({ id: "j1", title: "Backend Engineer" }), apiJobRow({ id: "j2", title: "Expired One", days_left: 0 })])));
    render(
      <MemoryRouter initialEntries={["/company/dashboard"]}>
        <Routes>
          <Route element={<CompanyLayout />}>
            <Route path="/company/dashboard" element={<div>DASH</div>} />
          </Route>
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    await screen.findByText("DASH");
    await user.keyboard("{Control>}k{/Control}");
    const item = await screen.findByText("Backend Engineer");
    expect(screen.queryByText("Expired One")).not.toBeInTheDocument();
    await user.click(item);
    expect(await screen.findByTestId("where")).toHaveTextContent("/company/jobs/j1/preview");
  });
});

describe("CompanyLayout: who is offered 'Post a role'", () => {
  const setup = (memberRole) => {
    setTokens({ access: "a", refresh: "r" });
    const account = { id: "u1", role: "company", status: "active", name: "Ali", email: "ali@acme.example", memberRole, companyStatus: "approved" };
    useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: account });
    useCompanyStore.getState().actions.hydrateProfile(account, { companyName: "Acme", ownerName: "Ali", email: "o@acme.example" });
    server.use(route.get("/jobs/", () => paged([])));
    render(
      <MemoryRouter initialEntries={["/company/dashboard"]}>
        <Routes>
          <Route element={<CompanyLayout />}>
            <Route path="/company/dashboard" element={<div>DASH</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
  };

  it.each(["admin", "hr_manager", "recruiter"])("a %s sees the shortcut", async (role) => {
    setup(role);
    await screen.findByText("DASH");
    expect(screen.getAllByRole("link", { name: /post a role/i }).length).toBeGreaterThan(0);
  });

  it("a viewer does not (the server would refuse them)", async () => {
    setup("viewer");
    await screen.findByText("DASH");
    expect(screen.queryByRole("link", { name: /post a role/i })).not.toBeInTheDocument();
  });
});

describe("CompanyLayout: the sidebar review badge", () => {
  function setupBadge(handler) {
    setTokens({ access: "a", refresh: "r" });
    const account = { id: "u1", role: "company", status: "active", name: "Ali", email: "ali@acme.example", memberRole: "admin", companyStatus: "approved" };
    useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: account });
    useCompanyStore.getState().actions.hydrateProfile(account, { companyName: "Acme", ownerName: "Ali", email: "o@acme.example" });
    server.use(route.get("/jobs/", () => paged([])), handler);
    render(
      <MemoryRouter initialEntries={["/company/dashboard"]}>
        <Routes>
          <Route element={<CompanyLayout />}>
            <Route path="/company/dashboard" element={<div>DASH</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
  }

  it("shows how many applications wait for a first look (a count-only request for the whole company)", async () => {
    let q;
    setupBadge(route.get("/applications/", ({ request }) => ((q = Object.fromEntries(new URL(request.url).searchParams)), paged([], { count: 7 }))));
    await screen.findByText("DASH");
    await waitFor(() => expect(screen.getAllByText("7").length).toBeGreaterThan(0));
    expect(q).toEqual({ status: "submitted", page_size: "1", page: "1" });
  });

  it("shows no badge (rather than a wrong number) when the count cannot be read", async () => {
    setupBadge(route.get("/applications/", () => detail(500, "Something went wrong.", "server_error")));
    await screen.findByText("DASH");
    expect(screen.queryByText("7")).not.toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
