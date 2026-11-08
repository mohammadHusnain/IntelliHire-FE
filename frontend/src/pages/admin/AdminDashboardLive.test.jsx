import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { server } from "@/test/server";
import { apiAdminCompany, detail, json, paged, route } from "@/test/fixtures";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import AdminDashboardLive from "./AdminDashboardLive";

const toasts = () => useToastStore.getState().toasts.map((t) => t.title);

function mount({ pending = [apiAdminCompany()], handlers = [] } = {}) {
  useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: { id: "admin", role: "admin", status: "active", name: "Admin" } });
  server.use(
    ...handlers,
    route.get("/platform-admin/companies/", ({ request }) => {
      const q = new URL(request.url).searchParams;
      if (q.get("page_size") === "1") return paged([], { count: { pending: pending.length, approved: 6, rejected: 1, suspended: 2 }[q.get("status")] });
      return paged(pending);
    }),
    route.get("/platform-admin/users/", ({ request }) => {
      const q = new URL(request.url).searchParams;
      return json({ count: q.getAll("role").length === 1 ? 12 : 40, next: null, previous: null, results: [], status_counts: { suspended: 3 } });
    }),
  );
  render(<MemoryRouter><AdminDashboardLive /></MemoryRouter>);
}

describe("AdminDashboardLive", () => {
  it("shows the live totals", async () => {
    mount();
    expect(await screen.findByText("1 company needs", { exact: false })).toBeInTheDocument();
    // (the big tile numbers count up only when scrolled into view, so check the plain-text figures)
    expect(screen.getByText("6 active")).toBeInTheDocument(); // companies by status come from the counts
    const health = (label) => screen.getAllByText(label).map((e) => e.closest("a")).find(Boolean);
    expect(health("Companies awaiting approval")).toHaveTextContent("1");
    expect(health("Suspended accounts")).toHaveTextContent("3"); // users status_counts
    expect(health("Suspended companies")).toHaveTextContent("2");
  });

  it("says 'not connected yet' for blocks with no backend instead of showing numbers", async () => {
    mount();
    await screen.findByText("1 company needs", { exact: false });
    expect(screen.getAllByText(/not connected yet/i).length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText(/average score/i)).not.toBeInTheDocument();
  });

  it("approves a pending company from the queue", async () => {
    let approved = false;
    mount({ handlers: [route.post("/platform-admin/companies/co-1/approve/", () => ((approved = true), json(apiAdminCompany({ status: "approved" }))))] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /approve/i }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Approve company" }));
    await waitFor(() => expect(approved).toBe(true));
    await waitFor(() => expect(toasts()).toContain("Acme approved"));
  });

  it("a 409 from another admin's decision is explained and the queue refreshed", async () => {
    mount({ handlers: [route.post("/platform-admin/companies/co-1/approve/", () => detail(409, "Company has already been reviewed.", "already_reviewed"))] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /approve/i }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Approve company" }));
    await waitFor(() => expect(toasts()).toContain("Nothing changed"));
  });

  it("an all-clear queue", async () => {
    mount({ pending: [] });
    expect(await screen.findByText("All reviewed")).toBeInTheDocument();
    expect(screen.getByText("Platform is", { exact: false })).toBeInTheDocument();
  });

  it("a load error offers a retry", async () => {
    let fail = true;
    mount({ handlers: [route.get("/platform-admin/users/", () => (fail ? detail(500, "Something went wrong.", "server_error") : json({ count: 1, results: [], status_counts: {} })))] });
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fail = false;
    await userEvent.setup().click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("1 company needs", { exact: false })).toBeInTheDocument();
  });
});
