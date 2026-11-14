import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { server } from "@/test/server";
import { apiAdminCompany, apiAdminDashboard, apiAlert, apiHealth, detail, json, paged, route } from "@/test/fixtures";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import AdminDashboardLive from "./AdminDashboardLive";

const toasts = () => useToastStore.getState().toasts.map((t) => t.title);

function mount({ pending = [apiAdminCompany()], handlers = [] } = {}) {
  useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: { id: "admin", role: "admin", status: "active", name: "Admin" } });
  server.use(
    ...handlers,
    route.get("/platform-admin/dashboard/", () => json(apiAdminDashboard())),
    route.get("/platform-admin/health/", () => json(apiHealth())),
    route.get("/platform-admin/alerts/", () => paged([])),
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
  it("shows every metric block from the server's dashboard endpoint", async () => {
    mount();
    expect(await screen.findByText("1 company needs", { exact: false })).toBeInTheDocument();
    // Counts come straight from /platform-admin/dashboard/, keyed by the server's own enums.
    // The label and the number are separate nodes, so read the badge's whole text.
    const badge = (text) => screen.getByText((_, el) => el?.tagName === "SPAN" && el.textContent === text);
    expect(await screen.findByText("People")).toBeInTheDocument();
    expect(badge("Candidates: 30")).toBeInTheDocument();
    expect(badge("Approved: 6")).toBeInTheDocument();
    expect(badge("Screening: 6")).toBeInTheDocument();
    expect(screen.getByText("52")).toBeInTheDocument();      // applications, all time
    expect(screen.getByText("840 ms")).toBeInTheDocument();  // AI average latency
  });

  it("no longer claims any block is 'not connected yet'", async () => {
    mount();
    await screen.findByText("1 company needs", { exact: false });
    expect(screen.queryByText(/not connected yet/i)).not.toBeInTheDocument();
  });

  it("reports system health, including a failing check and a missing backup", async () => {
    mount({ handlers: [route.get("/platform-admin/health/", () => json(apiHealth({
      broker: { ok: false, detail: "ConnectionError" },
      resources: { cpu_percent: null, memory_percent: null, disk_percent: null },
      backup: { last_successful_at: null, size_bytes: 0, warning: "No successful backup in the last 26 hours." },
    })))] });
    expect(await screen.findByText("No successful backup in the last 26 hours.")).toBeInTheDocument();
    expect(screen.getByText("ConnectionError")).toBeInTheDocument();
    expect(screen.getByText("The server could not read its own resource usage.")).toBeInTheDocument();
    expect(screen.getAllByText("Unreachable").length).toBeGreaterThanOrEqual(1);
  });

  it("acknowledges an active alert and says it can come back", async () => {
    let acknowledged = false;
    mount({ handlers: [
      route.get("/platform-admin/alerts/", () => paged([apiAlert()])),
      route.post("/platform-admin/alerts/alert-1/acknowledge/", () => (acknowledged = true, json({}))),
    ] });
    const banner = await screen.findByRole("region", { name: "Active alerts" });
    expect(banner).toHaveTextContent("No worker heartbeat in 10 minutes.");
    await userEvent.setup().click(within(banner).getByRole("button", { name: /acknowledge/i }));
    await waitFor(() => expect(acknowledged).toBe(true));
    await waitFor(() => expect(toasts()).toContain("Alert acknowledged"));
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
