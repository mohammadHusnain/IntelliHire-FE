import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { server } from "@/test/server";
import { apiJobRow, paged, route } from "@/test/fixtures";
import { useAuthStore } from "@/store/authStore";
import { useCommunityStore } from "@/store/communityStore";
import { useCompanyStore } from "@/store/companyStore";
import { setTokens } from "@/api/tokenStorage";
import CompanyCommunity from "./CompanyCommunity";

const community = { id: "com_t", name: "Python Pakistan", description: "Pythonistas", category: "Engineering", members: 120, activeThisWeek: 9, tags: ["python"], avatar: "PP", avatarBg: "#123", isOpen: true, postedJobs: 0, status: "active", createdAt: 1 };

function mount(openJobs) {
  setTokens({ access: "a", refresh: "r" });
  const account = { id: "u1", role: "company", status: "active", name: "Ali", email: "ali@acme.example", memberRole: "admin", companyStatus: "approved" };
  useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: account });
  useCompanyStore.getState().actions.hydrateProfile(account, { companyName: "Acme", ownerName: "Ali", email: "o@acme.example" });
  useCommunityStore.setState({ catalogue: [community] });
  server.use(route.get("/jobs/", () => paged(openJobs)));
  render(<MemoryRouter><CompanyCommunity /></MemoryRouter>);
}

describe("CompanyCommunity (real jobs)", () => {
  it("offers the company's real open roles and copies the server's share link", async () => {
    mount([apiJobRow({ id: "j1", title: "Backend Engineer", location: "Lahore", share_url: "http://localhost:5173/apply/aaa" }), apiJobRow({ id: "j2", title: "Designer", location: "", share_url: "http://localhost:5173/apply/bbb" })]);
    const user = userEvent.setup();
    const select = await screen.findByLabelText("Role to share");
    expect([...select.options].map((o) => o.textContent)).toEqual(["Backend Engineer · Lahore", "Designer"]);
    await user.selectOptions(select, "j2");
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await user.click(screen.getByRole("button", { name: /copy post/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("Designer at Acme — http://localhost:5173/apply/bbb"));
  });

  it("with no open role it says so and disables sharing", async () => {
    mount([]);
    expect(await screen.findByText(/publish a role first/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy post/i })).toBeDisabled();
  });

  it("never offers a role whose deadline already passed", async () => {
    mount([apiJobRow({ id: "j1", title: "Expired role", days_left: 0 }), apiJobRow({ id: "j2", title: "Live role" })]);
    const select = await screen.findByLabelText("Role to share");
    expect([...select.options].map((o) => o.textContent)).toEqual(["Live role · Lahore"]);
  });
});
