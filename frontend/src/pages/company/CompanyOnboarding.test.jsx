import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { server } from "@/test/server";
import { apiCompanyProfile, detail, json, route } from "@/test/fixtures";
import { useAuthStore } from "@/store/authStore";
import { useCompanyStore } from "@/store/companyStore";
import { useToastStore } from "@/store/toastStore";
import CompanyOnboarding from "./CompanyOnboarding";

const toasts = () => useToastStore.getState().toasts.map((t) => t.title);

function mount({ memberRole = "admin", handlers = [] } = {}) {
  const account = { id: "c1", role: "company", status: "active", name: "Ali", email: "ali@acme.example", memberRole, companyName: "Acme" };
  useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: account });
  useCompanyStore.getState().actions.hydrateProfile(account, { companyName: "Acme", industry: "Technology", companySize: "", website: "", description: "", location: "", ownerName: "Ali", email: "o@acme.example" });
  server.use(...handlers);
  return render(
    <MemoryRouter initialEntries={["/o"]}>
      <Routes>
        <Route path="/o" element={<CompanyOnboarding />} />
        <Route path="*" element={<div>NEXT PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function walk(user) {
  await user.click(screen.getByRole("button", { name: /continue/i }));
  await user.type(screen.getByLabelText("Location"), "Lahore");
  await user.click(screen.getByRole("button", { name: /continue/i }));
  await user.click(screen.getByRole("button", { name: /post your first role/i }));
}

describe("CompanyOnboarding (real API)", () => {
  it("saves only what was filled in through the API, then moves on", async () => {
    let body;
    mount({ handlers: [route.patch("/company/profile/", async ({ request }) => ((body = await request.json()), json(apiCompanyProfile({ headquarters: "Lahore" }))))] });
    await walk(userEvent.setup());
    expect(await screen.findByText("NEXT PAGE")).toBeInTheDocument();
    expect(body).toEqual({ headquarters: "Lahore" });
  });

  it("a server error stays on the wizard, on the step with the field, and nothing is reported as saved", async () => {
    mount({ handlers: [route.patch("/company/profile/", () => json({ headquarters: ["Ensure this field has no more than 200 characters."] }, 400))] });
    await walk(userEvent.setup());
    expect(await screen.findByText("Ensure this field has no more than 200 characters.")).toBeInTheDocument();
    expect(toasts()).not.toContain("Company profile saved");
    expect(screen.queryByText("NEXT PAGE")).not.toBeInTheDocument();
  });

  it("a 403 is reported, not hidden", async () => {
    mount({ handlers: [route.patch("/company/profile/", () => detail(403, "Unauthorized access.", "permission_denied"))] });
    await walk(userEvent.setup());
    await waitFor(() => expect(toasts()).toContain("Profile not saved"));
  });

  it("a non-admin cannot set the profile up", () => {
    mount({ memberRole: "recruiter" });
    expect(screen.getByText(/only a company admin can set up/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /continue/i })).not.toBeInTheDocument();
  });
});
