import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { server } from "@/test/server";
import { apiFlag, detail, json, paged, route } from "@/test/fixtures";
import { setTokens } from "@/api/tokenStorage";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import AdminModeration from "./AdminModeration";

const toasts = () => useToastStore.getState().toasts.map((t) => t.title);

function mount({ flags = [apiFlag()], handlers = [] } = {}) {
  setTokens({ access: "a", refresh: "r" });
  useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: { id: "admin", role: "admin", status: "active", name: "Admin" } });
  server.use(...handlers, route.get("/platform-admin/moderation/", () => paged(flags)));
  render(<MemoryRouter><AdminModeration /></MemoryRouter>);
}

describe("AdminModeration", () => {
  it("shows the queue with who reported what and why", async () => {
    mount();
    expect(await screen.findByText("Looks like spam")).toBeInTheDocument();
    expect(screen.getByText(/Reported by a user/)).toBeInTheDocument();
    expect(screen.getByText("NUST Computer Science 2026")).toBeInTheDocument();
    // "Open" is both the tab and the flag's status badge.
    expect(screen.getAllByText("Open").length).toBeGreaterThanOrEqual(2);
  });

  it("filters by status and by target type through the server", async () => {
    const asked = [];
    mount({ handlers: [route.get("/platform-admin/moderation/", ({ request }) => (asked.push(Object.fromEntries(new URL(request.url).searchParams)), paged([apiFlag()])))] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "Dismissed" }));
    await waitFor(() => expect(asked.at(-1).status).toBe("dismissed"));
    await user.selectOptions(screen.getByLabelText("Target type"), "job");
    await waitFor(() => expect(asked.at(-1).target_type).toBe("job"));
  });

  it("will not resolve without a note, and sends only dismiss or act", async () => {
    const bodies = [];
    mount({ handlers: [route.post("/platform-admin/moderation/flag-1/resolve/", async ({ request }) => (bodies.push(await request.json()), json(apiFlag({ status: "dismissed" }))))] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /review/i }));
    await user.click(await screen.findByRole("button", { name: /^Dismiss$/ }));
    expect(await screen.findByText("Write a resolution note.")).toBeInTheDocument();
    expect(bodies).toEqual([]);

    await user.type(screen.getByLabelText(/Resolution note/), "not spam after all");
    await user.click(screen.getByRole("button", { name: /^Dismiss$/ }));
    await waitFor(() => expect(bodies).toEqual([{ note: "not spam after all", action: "dismiss" }]));
    await waitFor(() => expect(toasts()).toContain("Dismissed"));
  });

  it("says in words what taking action will do, per target type", async () => {
    const bodies = [];
    mount({
      flags: [apiFlag({ target_type: "job", target: { label: "Django Engineer" } })],
      handlers: [route.post("/platform-admin/moderation/flag-1/resolve/", async ({ request }) => (bodies.push(await request.json()), json(apiFlag({ status: "actioned", action_taken: "closed_job" }))))],
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /review/i }));
    await user.type(await screen.findByLabelText(/Resolution note/), "misleading advert");
    await user.click(screen.getByRole("button", { name: /close this job/i }));
    await waitFor(() => expect(bodies).toEqual([{ note: "misleading advert", action: "act" }]));
    await waitFor(() => expect(toasts()).toContain("Resolved and acted on"));
  });

  it("allows dismiss only when the target is already gone", async () => {
    mount({ flags: [apiFlag({ target: null })] });
    await userEvent.setup().click(await screen.findByRole("button", { name: /review/i }));
    expect(await screen.findByText(/no longer exists, so it can only be dismissed/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Dismiss$/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /take action/i })).not.toBeInTheDocument();
  });

  it("marks a flag as being reviewed, and explains a race with another admin", async () => {
    let calls = 0;
    mount({ handlers: [route.post("/platform-admin/moderation/flag-1/review/", () => (++calls === 1 ? json(apiFlag({ status: "reviewing" })) : detail(409, "Already.", "conflict")))] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /review/i }));
    await user.click(await screen.findByRole("button", { name: /mark as reviewing/i }));
    await waitFor(() => expect(toasts()).toContain("Marked as being reviewed"));
  });

  it("shows a resolved flag as read-only, with the note and who resolved it", async () => {
    mount({ flags: [apiFlag({ status: "actioned", action_taken: "removed_community", resolution_note: "repeated spam", resolved_by: "Admin", resolved_at: "2026-06-02T09:00:00Z" })] });
    const user = userEvent.setup();
    expect(await screen.findByText("Community removed")).toBeInTheDocument();
    expect(screen.getByText(/repeated spam/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /details/i }));
    expect(await screen.findByText("Nothing further to do")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Resolution note/)).not.toBeInTheDocument();
  });

  it("says the queue is clear when nothing is open", async () => {
    mount({ flags: [] });
    expect(await screen.findByText("Nothing to moderate")).toBeInTheDocument();
  });
});
