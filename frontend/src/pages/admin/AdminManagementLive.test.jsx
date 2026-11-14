import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { server } from "@/test/server";
import { apiActivityEvent, apiFlag, detail, json, paged, route } from "@/test/fixtures";
import { setTokens } from "@/api/tokenStorage";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import AdminManagementLive from "./AdminManagementLive";

const toasts = () => useToastStore.getState().toasts.map((t) => t.title);

function mount({ events = [apiActivityEvent()], handlers = [] } = {}) {
  setTokens({ access: "a", refresh: "r" });
  useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: { id: "admin", role: "admin", status: "active", name: "Admin" } });
  server.use(...handlers, route.get("/platform-admin/activity/", () => paged(events)));
  render(<MemoryRouter><AdminManagementLive /></MemoryRouter>);
}

describe("AdminManagementLive: the activity log", () => {
  it("lists events with their type, actor and time (TC-46)", async () => {
    mount({ events: [
      apiActivityEvent({ id: "e1", event_type: "user.registered", summary: "Sara registered", target_type: "user" }),
      apiActivityEvent({ id: "e2", event_type: "job.published", summary: "Django Engineer published", target_type: "job" }),
      apiActivityEvent({ id: "e3", event_type: "interview.evaluated", summary: "Screening evaluated", actor: null, target_type: null, target_id: null }),
    ] });
    expect(await screen.findByText("User · registered")).toBeInTheDocument();
    expect(screen.getByText("Job · published")).toBeInTheDocument();
    expect(screen.getByText("Interview · evaluated")).toBeInTheDocument();
    expect(screen.getAllByText("Admin").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("System")).toBeInTheDocument();
  });

  it("offers no way to change or delete an entry", async () => {
    mount();
    await screen.findByText("Company · approved");
    for (const name of [/^edit$/i, /^delete$/i, /^save$/i, /^remove$/i]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });

  it("filters by event type and date through the server", async () => {
    const asked = [];
    mount({ handlers: [route.get("/platform-admin/activity/", ({ request }) => (asked.push(Object.fromEntries(new URL(request.url).searchParams)), paged([apiActivityEvent()])))] });
    const user = userEvent.setup();
    await user.type(await screen.findByPlaceholderText(/Event type/), "company.approved");
    await waitFor(() => expect(asked.at(-1).event_type).toBe("company.approved"));
    await user.type(screen.getByLabelText("From"), "2026-01-01");
    await waitFor(() => expect(asked.at(-1).from).toBe("2026-01-01"));
  });

  it("exports the server's CSV and says it is capped", async () => {
    let askedPath;
    mount({ handlers: [route.get("/platform-admin/activity/export/", ({ request }) => {
      askedPath = new URL(request.url).pathname;
      return new Response("id,event\n1,x\n", { status: 200, headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="activity.csv"' } });
    })] });
    await userEvent.setup().click(await screen.findByRole("button", { name: /export csv/i }));
    await waitFor(() => expect(askedPath).toBe("/api/platform-admin/activity/export/"));
    await waitFor(() => expect(toasts()).toContain("Activity exported"));
  });

  it("flags one entry, pointing a flag at what it is about", async () => {
    let body;
    mount({ handlers: [
      route.get("/platform-admin/activity/evt-1/", () => json(apiActivityEvent())),
      route.post("/platform-admin/activity/evt-1/flag/", async ({ request }) => (body = await request.json(), json(apiFlag(), 201))),
    ] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /^Open$/ }));
    const drawer = await screen.findByRole("dialog", { name: /Company · approved/ });
    expect(within(drawer).getByText(/append-only/)).toBeInTheDocument();
    await user.click(within(drawer).getByRole("button", { name: /flag for review/i }));
    await user.type(within(drawer).getByLabelText(/need review/i), "approved by mistake");
    await user.click(within(drawer).getByRole("button", { name: /raise flag/i }));
    await waitFor(() => expect(body).toEqual({ reason: "approved by mistake" }));
  });

  it("says when an entry points at nothing that can be flagged", async () => {
    mount({ handlers: [route.get("/platform-admin/activity/evt-1/", () => json(apiActivityEvent({ target_type: null, target_id: null })))] });
    await userEvent.setup().click(await screen.findByRole("button", { name: /^Open$/ }));
    expect(await screen.findByText(/Nothing to flag/)).toBeInTheDocument();
  });

  it("surfaces the server's refusal when the target is gone", async () => {
    mount({ handlers: [
      route.get("/platform-admin/activity/evt-1/", () => json(apiActivityEvent())),
      route.post("/platform-admin/activity/evt-1/flag/", () => detail(400, "No target.", "no_target")),
    ] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /^Open$/ }));
    const drawer = await screen.findByRole("dialog");
    await user.click(within(drawer).getByRole("button", { name: /flag for review/i }));
    await user.type(within(drawer).getByLabelText(/need review/i), "wrong");
    await user.click(within(drawer).getByRole("button", { name: /raise flag/i }));
    expect(await within(drawer).findByText("This entry does not point at anything that can be flagged.")).toBeInTheDocument();
  });

  it("says when nothing matches the filters", async () => {
    mount({ events: [] });
    expect(await screen.findByText("No activity for these filters")).toBeInTheDocument();
  });
});
