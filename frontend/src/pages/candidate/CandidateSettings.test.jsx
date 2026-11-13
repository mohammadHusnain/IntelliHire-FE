import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { server } from "@/test/server";
import { detail, json, route } from "@/test/fixtures";
import { useAuthStore } from "@/store/authStore";
import { useCandidateStore } from "@/store/candidateStore";
import { getTokens, setTokens } from "@/api/tokenStorage";
import RoleProtectedRoute from "@/components/auth/RoleProtectedRoute";
import CandidateSettings from "./CandidateSettings";

function mount() {
  setTokens({ access: "a", refresh: "r" });
  const account = { id: "u1", role: "candidate", status: "active", name: "Sara", email: "sara@example.com" };
  useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: account });
  useCandidateStore.getState().actions.ensure(account); // CandidateGate does this before the page renders
  return render(
    <MemoryRouter initialEntries={["/s"]}>
      <Routes>
        <Route element={<RoleProtectedRoute allowedRoles={["candidate"]} />}>
          <Route path="/s" element={<CandidateSettings />} />
        </Route>
        <Route path="/login" element={<div>LOGIN PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function openSecurity() {
  const user = userEvent.setup();
  const tab = screen.queryByRole("button", { name: /security/i });
  if (tab) await user.click(tab);
  return user;
}

async function submit(user, current, next, confirm = next) {
  await user.type(screen.getByLabelText("Current password"), current);
  await user.type(screen.getByLabelText("New password"), next);
  await user.type(screen.getByLabelText("Confirm new password"), confirm);
  await user.click(screen.getByRole("button", { name: /update password/i }));
}

describe("CandidateSettings: change password (real API)", () => {
  it("sends only the old and new password, then signs out and goes to the login page", async () => {
    let body;
    server.use(
      route.post("/auth/password/change/", async ({ request }) => ((body = await request.json()), json({ detail: "ok" }))),
      route.post("/auth/logout/", () => json({ detail: "ok" })),
    );
    mount();
    const user = await openSecurity();
    await submit(user, "Old-pass-1234", "N3w-pass-9921");
    expect(await screen.findByText("LOGIN PAGE")).toBeInTheDocument();
    expect(body).toEqual({ old_password: "Old-pass-1234", new_password: "N3w-pass-9921" });
    expect(getTokens()).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("shows a wrong current password on that field and stays signed in", async () => {
    server.use(route.post("/auth/password/change/", () => json({ old_password: ["Current password is incorrect."] }, 400)));
    mount();
    const user = await openSecurity();
    await submit(user, "wrong", "N3w-pass-9921");
    expect(await screen.findByText("Current password is incorrect.")).toBeInTheDocument();
    expect(getTokens()).not.toBeNull();
    expect(screen.queryByText("LOGIN PAGE")).not.toBeInTheDocument();
  });

  it("shows the server's password-policy message on the new password field", async () => {
    server.use(route.post("/auth/password/change/", () => json({ new_password: ["This password is too common."] }, 400)));
    mount();
    const user = await openSecurity();
    await submit(user, "Old-pass-1234", "password123");
    expect(await screen.findByText("This password is too common.")).toBeInTheDocument();
    expect(getTokens()).not.toBeNull();
  });

  it("checks the confirmation locally without calling the server", async () => {
    let called = false;
    server.use(route.post("/auth/password/change/", () => ((called = true), json({}))));
    mount();
    const user = await openSecurity();
    await submit(user, "Old-pass-1234", "N3w-pass-9921", "different");
    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it("keeps the session on a throttle or network failure", async () => {
    server.use(route.post("/auth/password/change/", () => detail(429, "Request was throttled.", "throttled")));
    mount();
    const user = await openSecurity();
    await submit(user, "Old-pass-1234", "N3w-pass-9921");
    await waitFor(() => expect(screen.getByRole("button", { name: /update password/i })).toBeEnabled());
    expect(getTokens()).not.toBeNull();
  });
});

describe("CandidateSettings: live notification preferences", () => {
  it("shows only supported controls and saves them through the API", async () => {
    let body;
    server.use(
      route.get("/notifications/preferences/", () => json({ email_communities: false, in_app_reminders: true, in_app_communities: true })),
      route.patch("/notifications/preferences/", async ({ request }) => ((body = await request.json()), json({ email_communities: false, in_app_reminders: false, in_app_communities: true }))),
    );
    mount();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /notifications/i }));
    const reminders = await screen.findByRole("switch", { name: "Interview reminders" });
    expect(screen.getByRole("switch", { name: "Community email updates" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Community notifications" })).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: /report summaries|weekly progress|reports ready/i })).not.toBeInTheDocument();
    await user.click(reminders);
    await waitFor(() => expect(body).toEqual({ in_app_reminders: false }));
    expect(reminders).toHaveAttribute("aria-checked", "false");
  });
});
