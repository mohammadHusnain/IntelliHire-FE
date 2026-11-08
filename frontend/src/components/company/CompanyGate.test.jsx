import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { HttpResponse } from "msw";
import { server } from "@/test/server";
import { apiCompanyProfile, detail, json, route } from "@/test/fixtures";
import { useAuthStore } from "@/store/authStore";
import { useCompanyStore } from "@/store/companyStore";
import { getTokens, setTokens } from "@/api/tokenStorage";
import { CompanyGate } from "./CompanyLayout";

const meWith = (status) => json({ id: "u1", email: "ali@acme.example", full_name: "Ali Khan", role: "company_admin", status: "active", company: { id: "c0", name: "Acme", member_role: "admin", status } });

function mount() {
  setTokens({ access: "a", refresh: "r" });
  useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: { id: "u1", role: "company", status: "active", name: "Ali Khan", email: "ali@acme.example", memberRole: "admin", companyStatus: "approved" } });
  const router = createMemoryRouter([{ path: "/c", element: <CompanyGate />, children: [{ index: true, element: <div>COMPANY PAGE</div> }] }], { initialEntries: ["/c"] });
  return render(<RouterProvider router={router} />);
}

describe("CompanyGate (real API)", () => {
  it("loads the company profile before any company page renders", async () => {
    server.use(route.get("/company/profile/", () => json(apiCompanyProfile({ name: "Acme Ltd", headquarters: "Lahore" }))));
    mount();
    expect(screen.queryByText("COMPANY PAGE")).not.toBeInTheDocument();
    expect(await screen.findByText("COMPANY PAGE")).toBeInTheDocument();
    expect(useCompanyStore.getState().records.u1.profile).toMatchObject({ companyName: "Acme Ltd", location: "Lahore" });
  });

  it("keeps the demo company out: a real company starts with no jobs, applicants or team entries", async () => {
    server.use(route.get("/company/profile/", () => json(apiCompanyProfile())));
    mount();
    await screen.findByText("COMPANY PAGE");
    const record = useCompanyStore.getState().records.u1;
    expect(record.jobs).toEqual([]);
    expect(record.applicants).toEqual([]);
  });

  it.each([
    ["suspended", "Your company is suspended"],
    ["pending", "Your company is awaiting approval"],
    ["rejected", "Your company was not approved"],
    ["approved", "You no longer have access"],
  ])("a 403 with the company %s explains it", async (status, title) => {
    server.use(route.get("/company/profile/", () => detail(403, "Unauthorized access.", "permission_denied")), route.get("/auth/me/", () => meWith(status)));
    mount();
    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.queryByText("COMPANY PAGE")).not.toBeInTheDocument();
  });

  it("'Check again' lets the person back in once the block is lifted", async () => {
    let blocked = true;
    server.use(
      route.get("/company/profile/", () => (blocked ? detail(403, "Unauthorized access.", "permission_denied") : json(apiCompanyProfile()))),
      route.get("/auth/me/", () => meWith(blocked ? "suspended" : "approved")),
    );
    mount();
    await screen.findByText("Your company is suspended");
    blocked = false;
    await userEvent.setup().click(screen.getByRole("button", { name: /check again/i }));
    expect(await screen.findByText("COMPANY PAGE")).toBeInTheDocument();
  });

  it("a network failure offers a retry (not the blocked screen) and keeps the session", async () => {
    let fail = true;
    server.use(route.get("/company/profile/", () => (fail ? HttpResponse.error() : json(apiCompanyProfile()))));
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent(/reach the server/i);
    expect(getTokens()).not.toBeNull();
    fail = false;
    await userEvent.setup().click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("COMPANY PAGE")).toBeInTheDocument();
  });

  it("only a name snapshot of the company profile is written to storage", async () => {
    server.use(route.get("/company/profile/", () => json(apiCompanyProfile({ description: "Secret roadmap", website: "https://acme.example" }))));
    mount();
    await screen.findByText("COMPANY PAGE");
    const stored = localStorage.getItem("intellihire_company") || "";
    expect(stored).not.toContain("Secret roadmap");
    expect(stored).not.toContain("https://acme.example");
  });
});
