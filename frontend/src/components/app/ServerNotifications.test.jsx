import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { server } from "@/test/server";
import { json, route } from "@/test/fixtures";
import { setTokens } from "@/api/tokenStorage";
import { useAuthStore } from "@/store/authStore";
import ServerNotifications from "./ServerNotifications";

const row = (id, title, read = false) => ({
  id, kind: "new_applicant", title, body: "A server notification.", link: "/company/candidates/app-1",
  payload: {}, read, read_at: read ? "2026-11-12T10:00:00Z" : null, created_at: "2026-11-12T10:00:00Z",
});

function mount() {
  setTokens({ access: "A", refresh: "R" });
  useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: { id: "u1", role: "company", name: "Ali" } });
  return render(<MemoryRouter><ServerNotifications /></MemoryRouter>);
}

describe("ServerNotifications", () => {
  it("loads the server count, paginates, and marks current and all notifications read", async () => {
    let page = 1;
    let unread = 3;
    let readCalls = 0;
    server.use(
      route.get("/notifications/unread-count/", () => json({ count: unread })),
      route.get("/notifications/", ({ request }) => {
        page = Number(new URL(request.url).searchParams.get("page"));
        return json({ count: 3, previous: page > 1 ? "?page=1" : null, next: page === 1 ? "?page=2" : null, results: page === 1 ? [row("n1", "First notice")] : [row("n2", "Second notice")] });
      }),
      route.post("/notifications/n1/read/", () => ((readCalls += 1), (unread = 2), json(row("n1", "First notice", true)))),
      route.post("/notifications/read-all/", () => ((unread = 0), json({ count: 2 }))),
    );
    const user = userEvent.setup();
    mount();
    await waitFor(() => expect(screen.getByRole("button", { name: "Notifications, 3 unread" })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Notifications, 3 unread" }));
    expect(await screen.findByText("First notice")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /First notice/ }));
    await waitFor(() => expect(readCalls).toBe(1));
    await user.click(await screen.findByRole("button", { name: "Notifications, 2 unread" }));
    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Second notice")).toBeInTheDocument();
    expect(page).toBe(2);
    await user.click(screen.getByRole("button", { name: "Mark all read" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument());
    expect(screen.getByText("First notice")).toHaveClass("text-stone-600");
  });

  it("shows an error and retries loading the live inbox", async () => {
    let attempts = 0;
    server.use(
      route.get("/notifications/unread-count/", () => json({ count: 0 })),
      route.get("/notifications/", () => (++attempts === 1 ? json({ detail: "Unavailable", code: "server_error" }, 500) : json({ count: 1, next: null, previous: null, results: [row("n1", "Recovered notice")] }))),
    );
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole("button", { name: "Notifications" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Recovered notice")).toBeInTheDocument();
  });
});
