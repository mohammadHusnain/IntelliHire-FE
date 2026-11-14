import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse } from "msw";
import { server } from "@/test/server";
import { apiUser, companyUser, detail, errors, json, route } from "@/test/fixtures";
import { renderRoutes } from "@/test/utils";
import { useAuthStore } from "@/store/authStore";
import { getTokens } from "@/api/tokenStorage";
import LoginPage from "./LoginPage";

const routes = {
  "/login": <LoginPage />,
  "/candidate/dashboard": <div>CANDIDATE DASHBOARD</div>,
  "/candidate/profile": <div>CANDIDATE PROFILE</div>,
  "/company/dashboard": <div>COMPANY DASHBOARD</div>,
  "/admin/dashboard": <div>ADMIN DASHBOARD</div>,
};
const loginWith = (user) => route.post("/auth/login/", () => json({ access: "A", refresh: "R", user }));

async function logIn(email = "sara@example.com", password = "Sunny-Day-4711") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: /log in/i }));
  return user;
}

describe("LoginPage", () => {
  it("only asks that the fields are filled in: the server owns the password rules", async () => {
    renderRoutes(routes, "/login");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /log in/i }));
    expect(await screen.findByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveFocus();
    // a short password is NOT refused by the page: the request goes out and the server decides
    server.use(route.post("/auth/login/", () => errors.invalidCredentials()));
    await user.type(screen.getByLabelText("Email"), "a@b.co");
    await user.type(screen.getByLabelText("Password"), "abc");
    await user.click(screen.getByRole("button", { name: /log in/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password.");
  });

  it.each([
    ["candidate", apiUser(), "CANDIDATE DASHBOARD"],
    ["company admin", companyUser(), "COMPANY DASHBOARD"],
    ["hr", companyUser({ role: "hr" }), "COMPANY DASHBOARD"],
    ["platform admin", apiUser({ role: "platform_admin" }), "ADMIN DASHBOARD"],
  ])("a %s lands on their own dashboard", async (_n, user, text) => {
    server.use(loginWith(user));
    renderRoutes(routes, "/login");
    await logIn();
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(getTokens()).toEqual({ access: "A", refresh: "R" });
  });

  it("returns to the page the user asked for when their role may open it", async () => {
    server.use(loginWith(apiUser()));
    renderRoutes(routes, { pathname: "/login", state: { from: { pathname: "/candidate/profile", search: "?tab=cv" } } });
    await logIn();
    expect(await screen.findByText("CANDIDATE PROFILE")).toBeInTheDocument();
  });

  it.each([["another role's page", "/company/dashboard"], ["another site", "//evil.example/x"], ["a full URL", "https://evil.example"], ["javascript", "javascript:alert(1)"]])(
    "ignores a requested path that is %s",
    async (_n, from) => {
      server.use(loginWith(apiUser()));
      renderRoutes(routes, { pathname: "/login", state: { from: { pathname: from } } });
      await logIn();
      expect(await screen.findByText("CANDIDATE DASHBOARD")).toBeInTheDocument();
    },
  );

  it("shows the server's message on a wrong password and keeps the typed email", async () => {
    server.use(route.post("/auth/login/", () => errors.invalidCredentials()));
    renderRoutes(routes, "/login");
    await logIn("sara@example.com", "wrong-password");
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password.");
    expect(screen.getByLabelText("Email")).toHaveValue("sara@example.com");
    expect(getTokens()).toBeNull();
  });

  it("an unverified account gets the message and a resend action that works", async () => {
    let resent;
    server.use(
      route.post("/auth/login/", () => errors.pendingVerification()),
      route.post("/auth/resend-verification/", async ({ request }) => ((resent = await request.json()), json({ detail: "ok" }))),
    );
    renderRoutes(routes, "/login");
    const user = await logIn();
    expect(await screen.findByText("Please verify your email before logging in.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /resend verification code/i }));
    expect(await screen.findByText(/new code is on its way/i)).toBeInTheDocument();
    expect(resent).toEqual({ email: "sara@example.com" });
  });

  it("the resend action explains a throttle", async () => {
    server.use(route.post("/auth/login/", () => errors.pendingVerification()), route.post("/auth/resend-verification/", () => errors.throttled(1800)));
    renderRoutes(routes, "/login");
    const user = await logIn();
    await user.click(await screen.findByRole("button", { name: /resend verification code/i }));
    expect(await screen.findByText(/try again in 30 minutes/i)).toBeInTheDocument();
  });

  it.each([
    ["pending approval", errors.pendingApproval, "Your company account is awaiting administrator approval."],
    ["rejected", errors.rejected, "Your company registration was not approved."],
    ["suspended", errors.suspended, "Your account has been suspended."],
  ])("%s shows the server's message and no resend action", async (_n, make, message) => {
    server.use(route.post("/auth/login/", make));
    renderRoutes(routes, "/login");
    await logIn();
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByRole("button", { name: /resend/i })).not.toBeInTheDocument();
  });

  it("a throttle disables the button and counts down", async () => {
    server.use(route.post("/auth/login/", () => errors.throttled(30)));
    renderRoutes(routes, "/login");
    await logIn();
    expect(await screen.findByRole("alert")).toHaveTextContent("Try again in 30 seconds");
    const button = await screen.findByRole("button", { name: /try again in \d+s/i });
    expect(button).toBeDisabled();
  });

  it("a network failure is explained", async () => {
    server.use(route.post("/auth/login/", () => HttpResponse.error()));
    renderRoutes(routes, "/login");
    await logIn();
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't reach the server/i);
  });

  it("a double submit sends one request", async () => {
    let calls = 0;
    server.use(route.post("/auth/login/", async () => (calls++, await new Promise((r) => setTimeout(r, 60)), json({ access: "A", refresh: "R", user: apiUser() }))));
    renderRoutes(routes, "/login");
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "a@b.co");
    await user.type(screen.getByLabelText("Password"), "pw-pw-pw-1");
    const button = screen.getByRole("button", { name: /log in/i });
    await user.dblClick(button);
    await screen.findByText("CANDIDATE DASHBOARD");
    expect(calls).toBe(1);
  });

  it.each([
    ["expired", "Your session expired. Please log in again."],
    ["suspended", "Your account has been suspended."],
    ["password-changed", "Password updated. Log in with your new password."],
    ["password-reset", "Password updated. Log in with your new password."],
  ])("shows the %s notice", (notice, text) => {
    useAuthStore.setState({ notice });
    renderRoutes(routes, "/login");
    expect(screen.getByRole("status")).toHaveTextContent(text);
  });

  it("tells a new user to verify their email, with the address", () => {
    renderRoutes(routes, { pathname: "/login", state: { registered: true, email: "new@example.com" } });
    expect(screen.getByText(/open the verification link we emailed to/i)).toBeInTheDocument();
    expect(screen.getByText("new@example.com")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("new@example.com");
  });

  it("has no demo accounts in real mode", () => {
    renderRoutes(routes, "/login");
    expect(screen.queryByText(/demo account/i)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/password123|12345678/);
  });
});

describe("LoginPage: company states (Module 2)", () => {
  it("a rejected company sees the server's message and a link to submit again", async () => {
    server.use(route.post("/auth/login/", () => errors.rejected()));
    renderRoutes(routes, "/login");
    await logIn();
    expect(await screen.findByRole("alert")).toHaveTextContent("Your company registration was not approved.");
    expect(screen.getByRole("link", { name: /submit again/i })).toHaveAttribute("href", "/resubmit-company");
  });

  it("a company awaiting approval sees the server's message and no resubmit link", async () => {
    server.use(route.post("/auth/login/", () => errors.pendingApproval()));
    renderRoutes(routes, "/login");
    await logIn();
    expect(await screen.findByRole("alert")).toHaveTextContent("awaiting administrator approval");
    expect(screen.queryByRole("link", { name: /submit again/i })).not.toBeInTheDocument();
  });

  it("shows a welcome after accepting an invitation, with the email filled in", async () => {
    renderRoutes(routes, { pathname: "/login", state: { invited: true, email: "new@acme.example" } });
    expect(await screen.findByText(/you have joined the team/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("new@acme.example");
  });

  it("shows a confirmation after a company was sent for review again", async () => {
    renderRoutes(routes, { pathname: "/login", state: { resubmitted: true, email: "o@acme.example" } });
    expect(await screen.findByText(/sent for review again/i)).toBeInTheDocument();
  });

  it("a deactivated member sees the server's message and no resubmit link", async () => {
    server.use(route.post("/auth/login/", () => detail(403, "Your access to this company has been turned off. Contact your company admin.", "member_deactivated")));
    renderRoutes(routes, "/login");
    await logIn();
    expect(await screen.findByRole("alert")).toHaveTextContent("Your access to this company has been turned off.");
    expect(screen.queryByRole("link", { name: /submit again/i })).not.toBeInTheDocument();
  });

  it("explains a session that ended because the member was deactivated", async () => {
    useAuthStore.setState({ notice: "deactivated" });
    renderRoutes(routes, "/login");
    expect(await screen.findByRole("status")).toHaveTextContent("Your access to this company has been turned off.");
  });
});
