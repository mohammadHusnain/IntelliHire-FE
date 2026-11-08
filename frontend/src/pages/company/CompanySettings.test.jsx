import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { server } from "@/test/server";
import { apiCompanyProfile, detail, json, route } from "@/test/fixtures";
import { useToastStore } from "@/store/toastStore";
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

// ── Company profile (real API) ──────────────────────────────────────────────────

const toasts = () => useToastStore.getState().toasts.map((t) => t.title);

function mountProfile({ memberRole = "admin", profile = apiCompanyProfile({ headquarters: "Lahore", company_size: "11-50" }), handlers = [] } = {}) {
  setTokens({ access: "a", refresh: "r" });
  const account = { id: "c1", role: "company", status: "active", name: "Ali", email: "ali@acme.example", memberRole, companyName: "Acme" };
  useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: account });
  useCompanyStore.getState().actions.hydrateProfile(account, {
    companyName: profile.name, industry: profile.industry, companySize: profile.company_size, website: profile.website, description: profile.description,
    location: profile.headquarters, phone: profile.contact_phone, logo: profile.logo, ownerName: "Ali", email: profile.official_email, createdAt: Date.parse(profile.created_at),
  });
  server.use(...handlers);
  return render(
    <MemoryRouter initialEntries={["/s"]}>
      <Routes>
        <Route element={<RoleProtectedRoute allowedRoles={["company"]} />}>
          <Route path="/s" element={<CompanySettings />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("CompanySettings: company profile (real API)", () => {
  it("shows the server profile and the backend's company sizes", () => {
    mountProfile();
    expect(screen.getByLabelText("Company name")).toHaveValue("Acme");
    expect(screen.getByLabelText("Location")).toHaveValue("Lahore");
    expect(screen.getByLabelText("Team size")).toHaveValue("11-50");
    expect(screen.getByRole("option", { name: "1,000+ employees" })).toBeInTheDocument();
    expect(screen.getByLabelText("Contact phone")).toHaveValue("+92 300 1234567");
  });

  it("shows when the company registered ('member since')", async () => {
    mountProfile();
    await userEvent.setup().click(screen.getByRole("button", { name: /security/i }));
    expect(screen.getByText("Member since")).toBeInTheDocument();
    expect(screen.getByText(/January.*2026|2026.*January/)).toBeInTheDocument();
  });

  it("hides the tabs that have no backend (notifications, your data)", () => {
    mountProfile();
    expect(screen.queryByRole("button", { name: /notifications/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /your data/i })).not.toBeInTheDocument();
  });

  it("sends only the changed field", async () => {
    let body;
    mountProfile({ handlers: [route.patch("/company/profile/", async ({ request }) => ((body = await request.json()), json(apiCompanyProfile({ headquarters: "Karachi", company_size: "11-50" }))))] });
    const user = userEvent.setup();
    const location = screen.getByLabelText("Location");
    await user.clear(location);
    await user.type(location, "Karachi");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(toasts()).toContain("Company profile saved"));
    expect(body).toEqual({ headquarters: "Karachi" });
  });

  it("puts a taken company name on its field and keeps the draft", async () => {
    mountProfile({ handlers: [route.patch("/company/profile/", () => json({ name: ["A company with this name is already registered."] }, 400))] });
    const user = userEvent.setup();
    const name = screen.getByLabelText("Company name");
    await user.clear(name);
    await user.type(name, "Taken Inc");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("A company with this name is already registered.")).toBeInTheDocument();
    expect(screen.getByLabelText("Company name")).toHaveValue("Taken Inc");
    expect(toasts()).toContain("Profile not saved");
  });

  it("shows the server's phone error on the phone field", async () => {
    mountProfile({ handlers: [route.patch("/company/profile/", () => json({ contact_phone: ["Enter a valid phone number."] }, 400))] });
    const user = userEvent.setup();
    const phone = screen.getByLabelText("Contact phone");
    await user.clear(phone);
    await user.type(phone, "abc");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Enter a valid phone number.")).toBeInTheDocument();
  });

  it("a 403 on save is reported, never shown as saved", async () => {
    mountProfile({ handlers: [route.patch("/company/profile/", () => detail(403, "Unauthorized access.", "permission_denied"))] });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Website"), "https://acme.example");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(toasts()).toContain("Profile not saved"));
    expect(toasts()).not.toContain("Company profile saved");
  });

  it("a non-admin member sees the profile read-only", () => {
    mountProfile({ memberRole: "recruiter" });
    expect(screen.getByLabelText("Company name")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
    expect(screen.getByText(/only a company admin can change/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /upload|replace/i })).not.toBeInTheDocument();
  });

  it("refuses a logo that is not JPG/PNG or is over 2 MB before any upload", async () => {
    let called = false;
    mountProfile({ handlers: [route.patch("/company/profile/", () => ((called = true), json(apiCompanyProfile())))] });
    const input = document.querySelector('input[type="file"]');
    await userEvent.setup({ applyAccept: false }).upload(input, new File(["x"], "logo.gif", { type: "image/gif" }));
    await waitFor(() => expect(toasts()).toContain("Unsupported file"));
    await userEvent.setup().upload(input, new File([new Uint8Array(2 * 1024 * 1024 + 1)], "logo.png", { type: "image/png" }));
    await waitFor(() => expect(toasts()).toContain("Image too large"));
    expect(called).toBe(false);
  });

  it("uploads a valid logo and shows it", async () => {
    mountProfile({ handlers: [route.patch("/company/profile/", () => json(apiCompanyProfile({ logo: "http://api.test/media/logo.png" })))] });
    await userEvent.setup().upload(document.querySelector('input[type="file"]'), new File([new Uint8Array([137, 80])], "logo.png", { type: "image/png" }));
    await waitFor(() => expect(toasts()).toContain("Logo updated"));
    expect(await screen.findByAltText("Company logo")).toHaveAttribute("src", "http://api.test/media/logo.png");
  });
});
