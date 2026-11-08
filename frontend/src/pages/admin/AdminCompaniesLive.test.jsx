import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { HttpResponse } from "msw";
import { server } from "@/test/server";
import { apiAdminCompany, detail, json, paged, route } from "@/test/fixtures";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import AdminCompaniesLive from "./AdminCompaniesLive";
import { downloadFile } from "@/lib/csv";

vi.mock("@/lib/csv", async (original) => ({ ...(await original()), downloadFile: vi.fn() }));

const toasts = () => useToastStore.getState().toasts.map((t) => t.title);
const counts = { pending: 3, approved: 5, rejected: 1, suspended: 2 };

/** The list handler gets the query so tests can assert what was asked. */
function mount({ rows = {}, handlers = [] } = {}) {
  useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: { id: "admin", role: "admin", status: "active", name: "Admin" } });
  const asked = [];
  server.use(
    ...handlers,
    route.get("/platform-admin/companies/", ({ request }) => {
      const q = new URL(request.url).searchParams;
      asked.push(Object.fromEntries(q));
      if (q.get("page_size") === "1") return paged([], { count: counts[q.get("status")] });
      const list = rows[q.get("status")] ?? [apiAdminCompany()];
      return paged(list, { count: list.length });
    }),
  );
  render(<MemoryRouter><AdminCompaniesLive /></MemoryRouter>);
  return asked;
}

describe("AdminCompaniesLive", () => {
  it("shows the pending companies and the per-status counts", async () => {
    const asked = mount();
    expect((await screen.findAllByText("Acme")).length).toBeGreaterThan(0);
    expect(await screen.findByText("3 companies are waiting for a decision.")).toBeInTheDocument();
    expect(asked.find((q) => q.page_size === "20")).toMatchObject({ status: "pending", page: "1" });
  });

  it("switches tabs on the server and resets to page 1", async () => {
    const asked = mount({ rows: { approved: [apiAdminCompany({ id: "co-2", name: "Beta Ltd", status: "approved" })] } });
    await screen.findAllByText("Acme");
    await userEvent.setup().click(screen.getByRole("tab", { name: /^active/i }));
    expect((await screen.findAllByText("Beta Ltd")).length).toBeGreaterThan(0);
    expect(asked.some((q) => q.status === "approved" && q.page === "1")).toBe(true);
  });

  it("searches with a debounce (one request for fast typing)", async () => {
    const asked = mount();
    await screen.findAllByText("Acme");
    await userEvent.setup().type(screen.getByPlaceholderText(/search company/i), "beta");
    await waitFor(() => expect(asked.some((q) => q.search === "beta")).toBe(true));
    expect(asked.filter((q) => q.page_size === "20" && q.search && q.search !== "beta")).toHaveLength(0);
  });

  it("shows an empty state for no match", async () => {
    mount({ rows: { pending: [] } });
    expect(await screen.findByText("No companies waiting")).toBeInTheDocument();
  });

  it("approves after a click through the dialog and refreshes", async () => {
    let approved = false;
    mount({ handlers: [route.post("/platform-admin/companies/co-1/approve/", () => ((approved = true), json(apiAdminCompany({ status: "approved" }))))] });
    const user = userEvent.setup();
    await user.click((await screen.findAllByRole("button", { name: /approve/i }))[0]);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Approve company" }));
    await waitFor(() => expect(approved).toBe(true));
    await waitFor(() => expect(toasts()).toContain("Acme approved"));
  });

  it("rejecting needs a reason of 10+ characters and sends it", async () => {
    let body;
    mount({ handlers: [route.post("/platform-admin/companies/co-1/reject/", async ({ request }) => ((body = await request.json()), json(apiAdminCompany({ status: "rejected" }))))] });
    const user = userEvent.setup();
    await user.click((await screen.findAllByRole("button", { name: /^reject$/i }))[0]);
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Reject company" });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByRole("textbox"), "Not a real company");
    await user.click(confirm);
    await waitFor(() => expect(body).toEqual({ reason: "Not a real company" }));
  });

  it("suspends an approved company with a reason", async () => {
    let body;
    mount({ rows: { pending: [apiAdminCompany({ status: "approved" })] }, handlers: [route.post("/platform-admin/companies/co-1/suspend/", async ({ request }) => ((body = await request.json()), json(apiAdminCompany({ status: "suspended" }))))] });
    const user = userEvent.setup();
    await user.click((await screen.findAllByRole("button", { name: /suspend/i }))[0]);
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByRole("textbox"), "Policy breach here");
    await user.click(within(dialog).getByRole("button", { name: "Suspend company" }));
    await waitFor(() => expect(body).toEqual({ reason: "Policy breach here" }));
  });

  it("a rejected company can be approved (the rejection is overturned) and cannot be reactivated or rejected again", async () => {
    let approved = false;
    mount({
      rows: { pending: [apiAdminCompany({ status: "rejected", rejection_reason: "Not real company" })] },
      handlers: [route.post("/platform-admin/companies/co-1/approve/", () => ((approved = true), json(apiAdminCompany({ status: "approved" }))))],
    });
    await screen.findAllByText("Acme");
    expect(screen.queryByRole("button", { name: /reactivate/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^reject$/i })).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getAllByRole("button", { name: /^approve$/i })[0]);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/overturns the rejection/i);
    await user.click(within(dialog).getByRole("button", { name: "Approve company" }));
    await waitFor(() => expect(approved).toBe(true));
    await waitFor(() => expect(toasts()).toContain("Acme approved"));
  });

  it("reactivates a suspended company", async () => {
    let done = false;
    mount({ rows: { pending: [apiAdminCompany({ status: "suspended", suspension_reason: "Policy breach here" })] }, handlers: [route.post("/platform-admin/companies/co-1/reactivate/", () => ((done = true), json(apiAdminCompany({ status: "approved" }))))] });
    const user = userEvent.setup();
    await user.click((await screen.findAllByRole("button", { name: /reactivate/i }))[0]);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Reactivate" }));
    await waitFor(() => expect(done).toBe(true));
  });

  it.each([
    ["already_reviewed", /already reviewed/i],
    ["invalid_state", /no longer in a state/i],
  ])("a 409 %s is explained, the dialog closes and the list is refreshed", async (code, text) => {
    let lists = 0;
    mount({
      handlers: [
        route.get("/platform-admin/companies/", ({ request }) => {
          const q = new URL(request.url).searchParams;
          if (q.get("page_size") === "1") return paged([], { count: 1 });
          lists += 1;
          return paged([apiAdminCompany()]);
        }),
        route.post("/platform-admin/companies/co-1/approve/", () => detail(409, "Company has already been reviewed.", code)),
      ],
    });
    const user = userEvent.setup();
    await user.click((await screen.findAllByRole("button", { name: /approve/i }))[0]);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Approve company" }));
    await waitFor(() => expect(useToastStore.getState().toasts.some((t) => text.test(t.message))).toBe(true));
    await waitFor(() => expect(lists).toBeGreaterThan(1));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("a network failure mid-action shows an error and does not pretend it worked", async () => {
    mount({ handlers: [route.post("/platform-admin/companies/co-1/approve/", () => HttpResponse.error())] });
    const user = userEvent.setup();
    await user.click((await screen.findAllByRole("button", { name: /approve/i }))[0]);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Approve company" }));
    await waitFor(() => expect(toasts()).toContain("Action failed"));
    expect(toasts()).not.toContain("Acme approved");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("opens the detail drawer with the reason on file and the review details", async () => {
    mount({
      rows: { pending: [apiAdminCompany({ status: "rejected", rejection_reason: "Not a real company" })] },
      handlers: [route.get("/platform-admin/companies/co-1/", () => json(apiAdminCompany({ status: "rejected", rejection_reason: "Not a real company", reviewed_by: "admin@x.co", reviewed_at: "2026-01-05T00:00:00Z", website: "https://acme.example", description: "We build things", headquarters: "Lahore" })))],
    });
    await userEvent.setup().click((await screen.findAllByText("Acme"))[0]);
    expect(await screen.findByText(/Not a real company/)).toBeInTheDocument();
    expect(await screen.findByText("We build things")).toBeInTheDocument();
    expect(screen.getByText("Lahore")).toBeInTheDocument();
  });

  it("pages through the list and falls back to page 1 when the page no longer exists", async () => {
    let missing = false;
    mount({
      handlers: [
        route.get("/platform-admin/companies/", ({ request }) => {
          const q = new URL(request.url).searchParams;
          if (q.get("page_size") === "1") return paged([], { count: 45 });
          if (q.get("page") === "2" && missing) return detail(404, "Invalid page.", "not_found");
          return json({ count: 45, next: q.get("page") === "1" ? "x" : null, previous: null, results: [apiAdminCompany({ id: `co-p${q.get("page")}`, name: `Company page ${q.get("page")}` })] });
        }),
      ],
    });
    const user = userEvent.setup();
    expect((await screen.findAllByText("Company page 1")).length).toBeGreaterThan(0);
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    missing = true;
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(await screen.findByText("That page no longer exists.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /go to page 1/i }));
    expect((await screen.findAllByText("Company page 1")).length).toBeGreaterThan(0);
  });

  it("a list error shows a message and a working retry", async () => {
    let fail = true;
    mount({
      handlers: [
        route.get("/platform-admin/companies/", ({ request }) => {
          const q = new URL(request.url).searchParams;
          if (q.get("page_size") === "1") return paged([], { count: 1 });
          return fail ? detail(500, "Something went wrong.", "server_error") : paged([apiAdminCompany()]);
        }),
      ],
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong.");
    fail = false;
    await userEvent.setup().click(screen.getByRole("button", { name: /try again/i }));
    expect((await screen.findAllByText("Acme")).length).toBeGreaterThan(0);
  });

  it("exports every company of the tab and search (all pages, not only the one on screen) as CSV", async () => {
    const asked = [];
    mount({
      handlers: [
        route.get("/platform-admin/companies/", ({ request }) => {
          const q = new URL(request.url).searchParams;
          asked.push(Object.fromEntries(q));
          if (q.get("page_size") === "1") return paged([], { count: 3 });
          if (q.get("page_size") === "100") {
            const page = Number(q.get("page"));
            return json({ count: 2, next: page === 1 ? "x" : null, previous: null, results: [apiAdminCompany({ id: `c${page}`, name: `Company ${page}`, contact_phone: "+92 300 1234567" })] });
          }
          return paged([apiAdminCompany()]);
        }),
      ],
    });
    await screen.findAllByText("Acme");
    await userEvent.setup().click(screen.getByRole("button", { name: /export csv/i }));
    await waitFor(() => expect(downloadFile).toHaveBeenCalled());
    const [name, content] = downloadFile.mock.calls.at(-1);
    expect(name).toMatch(/^intellihire-companies-pending-\d{4}-\d{2}-\d{2}\.csv$/);
    const lines = content.split("\r\n");
    expect(lines[0]).toBe("Company,Administrator,Administrator email,Official email,Phone,Industry,Status,Registered");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("Company 1");
    expect(lines[2]).toContain("Company 2");
    expect(lines[1]).toContain(",+92 300 1234567,");
    expect(asked.filter((q) => q.page_size === "100").map((q) => q.status)).toEqual(["pending", "pending"]);
    await waitFor(() => expect(toasts()).toContain("Companies exported"));
  });

  it("an export failure is reported and nothing is downloaded", async () => {
    downloadFile.mockClear();
    mount({
      handlers: [
        route.get("/platform-admin/companies/", ({ request }) => {
          const q = new URL(request.url).searchParams;
          if (q.get("page_size") === "1") return paged([], { count: 1 });
          if (q.get("page_size") === "100") return detail(500, "Something went wrong.", "server_error");
          return paged([apiAdminCompany()]);
        }),
      ],
    });
    await screen.findAllByText("Acme");
    await userEvent.setup().click(screen.getByRole("button", { name: /export csv/i }));
    await waitFor(() => expect(toasts()).toContain("Couldn't export"));
    expect(downloadFile).not.toHaveBeenCalled();
  });
});
