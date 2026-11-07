import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { server } from "@/test/server";
import { json, route } from "@/test/fixtures";
import { useAuthStore } from "@/store/authStore";
import { useCompanyStore } from "@/store/companyStore";
import { getTokens, setTokens } from "@/api/tokenStorage";
import RoleProtectedRoute from "@/components/auth/RoleProtectedRoute";
import CompanySettings from "./CompanySettings";

function mount() {
  setTokens({ access: "a", refresh: "r" });
  const account = { id: "c1", role: "company", status: "active", name: "Ali", email: "hr@acme.example", companyName: "Acme" };
  useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: account });
  useCompanyStore.getState().actions.ensure(account); // the company layout does this before the page renders
  return render(
    <MemoryRouter initialEntries={["/s"]}>
      <Routes>
        <Route element={<RoleProtectedRoute allowedRoles={["company"]} />}>
          <Route path="/s" element={<CompanySettings />} />
        </Route>
        <Route path="/login" element={<div>LOGIN PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function submit(user, current, next) {
  await user.type(screen.getByLabelText("Current password"), current);
  await user.type(screen.getByLabelText("New password"), next);
  await user.type(screen.getByLabelText("Confirm new password"), next);
  await user.click(screen.getByRole("button", { name: /update password/i }));
}

describe("CompanySettings: change password (real API)", () => {
  it("signs out and goes to the login page after the server accepts the change", async () => {
    let body;
    server.use(
      route.post("/auth/password/change/", async ({ request }) => ((body = await request.json()), json({ detail: "ok" }))),
      route.post("/auth/logout/", () => json({ detail: "ok" })),
    );
    mount();
    const tab = screen.queryByRole("button", { name: /security/i });
    const user = userEvent.setup();
    if (tab) await user.click(tab);
    await submit(user, "Old-pass-1234", "N3w-pass-9921");
    expect(await screen.findByText("LOGIN PAGE")).toBeInTheDocument();
    expect(body).toEqual({ old_password: "Old-pass-1234", new_password: "N3w-pass-9921" });
    expect(getTokens()).toBeNull();
  });

  it("shows a wrong current password on its field and stays signed in", async () => {
    server.use(route.post("/auth/password/change/", () => json({ old_password: ["Current password is incorrect."] }, 400)));
    mount();
    const tab = screen.queryByRole("button", { name: /security/i });
    const user = userEvent.setup();
    if (tab) await user.click(tab);
    await submit(user, "wrong", "N3w-pass-9921");
    expect(await screen.findByText("Current password is incorrect.")).toBeInTheDocument();
    expect(getTokens()).not.toBeNull();
  });
});
