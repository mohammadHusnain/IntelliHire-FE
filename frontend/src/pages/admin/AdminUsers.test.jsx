import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { server } from "@/test/server";
import { apiUser, apiUserDetail, companyUser, detail, json, route } from "@/test/fixtures";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import AdminUsers from "./AdminUsers";

const toasts = () => useToastStore.getState().toasts.map((t) => t.title);
const row = (overrides) => ({ ...apiUser(), date_joined: "2026-01-02T00:00:00Z", last_login: null, email_verified: true, ...overrides });
const page = (results, extra = {}) => json({ count: results.length, next: null, previous: null, results, status_counts: {}, ...extra });

function mount(handlers = []) {
  useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: { id: "admin", role: "admin", status: "active", name: "Admin" } });
  server.use(...handlers, route.get("/platform-admin/users/:id/detail/", () => json(apiUserDetail())));
  return render(
    <MemoryRouter>
      <AdminUsers />
    </MemoryRouter>,
  );
}

describe("AdminUsers (real API)", () => {
  it("lists the accounts from the server", async () => {
    let query;
    mount([route.get("/platform-admin/users/", ({ request }) => ((query = new URL(request.url).searchParams), page([row({ full_name: "Sara Malik" }), row({ id: "2", email: "hr@acme.example", full_name: "Ali Khan", role: "company_admin", company: companyUser().company })])))]);
    expect(await screen.findAllByText("Sara Malik")).not.toHaveLength(0);
    expect(screen.getAllByText("Ali Khan")).not.toHaveLength(0);
    expect(query.getAll("role").sort()).toEqual(["candidate", "company_admin", "hr"]);
    expect(query.get("page_size")).toBe("100");
  });

  it("shows an error with a retry when the list cannot be loaded", async () => {
    let fail = true;
    mount([route.get("/platform-admin/users/", () => (fail ? detail(500, "Something went wrong.", "server_error") : page([row()])))]);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fail = false;
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findAllByText("Sara Malik")).not.toHaveLength(0);
  });

  it("stops at 1,000 accounts and says the list is cut short", async () => {
    let pages = 0;
    mount([
      route.get("/platform-admin/users/", ({ request }) => {
        pages += 1;
        const n = Number(new URL(request.url).searchParams.get("page"));
        const results = Array.from({ length: 100 }, (_, i) => row({ id: `u-${n}-${i}`, email: `u${n}-${i}@x.co`, full_name: `Person ${n}-${i}` }));
        return page(results, { count: 5000, next: "more" });
      }),
    ]);
    expect(await screen.findByText(/showing the first 1,000 accounts/i)).toBeInTheDocument();
    expect(pages).toBe(10);
  });

  it("suspends an account through the API after confirmation, without asking for a reason", async () => {
    let suspended;
    mount([
      route.get("/platform-admin/users/", () => page([row({ id: "u-9", full_name: "Sara Malik" })])),
      route.post("/platform-admin/users/u-9/suspend/", () => ((suspended = true), json(row({ id: "u-9", status: "suspended" })))),
    ]);
    const user = userEvent.setup();
    await screen.findAllByText("Sara Malik");
    await user.click(screen.getAllByRole("button", { name: /^suspend$/i })[0]);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Suspend account" }));
    await waitFor(() => expect(suspended).toBe(true));
    await waitFor(() => expect(toasts()).toContain("Sara Malik suspended"));
  });

  it("reports a failed suspend instead of showing success", async () => {
    mount([
      route.get("/platform-admin/users/", () => page([row({ id: "u-9" })])),
      route.post("/platform-admin/users/u-9/suspend/", () => detail(403, "Unauthorized access.", "permission_denied")),
    ]);
    const user = userEvent.setup();
    await screen.findAllByText("Sara Malik");
    await user.click(screen.getAllByRole("button", { name: /^suspend$/i })[0]);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Suspend account" }));
    await waitFor(() => expect(toasts().some((t) => /could not be suspended/.test(t))).toBe(true));
    expect(toasts().some((t) => /Sara Malik suspended/.test(t))).toBe(false);
  });

  it("reactivates a suspended account", async () => {
    let done;
    mount([
      route.get("/platform-admin/users/", () => page([row({ id: "u-9", status: "suspended" })])),
      route.post("/platform-admin/users/u-9/reactivate/", () => ((done = true), json(row({ id: "u-9" })))),
    ]);
    const user = userEvent.setup();
    await screen.findAllByText("Sara Malik");
    await user.click(screen.getAllByRole("button", { name: /reactivate/i })[0]);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Reactivate" }));
    await waitFor(() => expect(done).toBe(true));
  });

  it("offers no delete, because the backend has none", async () => {
    mount([route.get("/platform-admin/users/", () => page([row()]))]);
    await screen.findAllByText("Sara Malik");
    expect(screen.queryByRole("button", { name: /^delete /i })).not.toBeInTheDocument();
  });
});
