import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse } from "msw";
import { server } from "@/test/server";
import { json, route } from "@/test/fixtures";
import { renderRoutes } from "@/test/utils";
import { useAuthStore } from "@/store/authStore";
import { setTokens } from "@/api/tokenStorage";
import ResetPasswordPage from "./ResetPasswordPage";

const routes = { "/reset-password": <ResetPasswordPage />, "/login": <div>LOGIN PAGE</div> };
const link = "/reset-password?uid=MQ&token=abc-123";

async function fill(newPw = "N3w-pass-9921", confirm = newPw) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("New password"), newPw);
  await user.type(screen.getByLabelText("Confirm new password"), confirm);
  await user.click(screen.getByRole("button", { name: /update password/i }));
  return user;
}

describe("ResetPasswordPage", () => {
  it("sends uid, token and both passwords, then goes to the login page (everyone is signed out)", async () => {
    let body;
    server.use(route.post("/auth/password/reset/", async ({ request }) => ((body = await request.json()), json({ detail: "ok" }))));
    setTokens({ access: "a", refresh: "r" });
    useAuthStore.setState({ user: { id: "1" }, isAuthenticated: true });
    renderRoutes(routes, link);
    await fill();
    expect(await screen.findByText("LOGIN PAGE")).toBeInTheDocument();
    expect(body).toEqual({ uid: "MQ", token: "abc-123", new_password: "N3w-pass-9921", confirm_password: "N3w-pass-9921" });
    expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: false, notice: "password-reset" });
  });

  it("checks that the two passwords match before asking the server", async () => {
    let calls = 0;
    server.use(route.post("/auth/password/reset/", () => (calls++, json({}))));
    renderRoutes(routes, link);
    await fill("N3w-pass-9921", "different");
    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(calls).toBe(0);
  });

  it("shows the server's password rules on the field", async () => {
    server.use(route.post("/auth/password/reset/", () => json({ new_password: ["This password is too common."] }, 400)));
    renderRoutes(routes, link);
    await fill("password1");
    expect(await screen.findByText("This password is too common.")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toHaveAttribute("aria-invalid", "true");
  });

  it("an invalid or already used link explains and offers a new one", async () => {
    server.use(route.post("/auth/password/reset/", () => json({ detail: "Reset link is invalid or has expired.", code: "invalid_token" }, 400)));
    renderRoutes(routes, link);
    await fill();
    expect(await screen.findByRole("alert")).toHaveTextContent("Reset link is invalid or has expired.");
    expect(screen.getByRole("button", { name: /send a new link/i })).toBeInTheDocument();
  });

  it.each([["/reset-password"], ["/reset-password?uid=MQ"], ["/reset-password?token=abc"]])("an incomplete link (%s) never reaches the server", async (url) => {
    let calls = 0;
    server.use(route.post("/auth/password/reset/", () => (calls++, json({}))));
    renderRoutes(routes, url);
    expect(screen.getByRole("alert")).toHaveTextContent(/incomplete/i);
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
    expect(calls).toBe(0);
  });

  it("a throttle and a network failure keep the form usable", async () => {
    let n = 0;
    server.use(route.post("/auth/password/reset/", () => (++n === 1 ? json({ detail: "Request was throttled. Expected available in 20 seconds.", code: "throttled" }, 429) : HttpResponse.error())));
    renderRoutes(routes, link);
    const user = await fill();
    expect(await screen.findByRole("alert")).toHaveTextContent(/try again in 20 seconds/i);
    await user.click(screen.getByRole("button", { name: /update password/i }));
    expect(await screen.findByText(/couldn't reach the server/i)).toBeInTheDocument();
  });

  it("does not double submit", async () => {
    let calls = 0;
    server.use(route.post("/auth/password/reset/", async () => (calls++, await new Promise((r) => setTimeout(r, 50)), json({ detail: "ok" }))));
    renderRoutes(routes, link);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("New password"), "N3w-pass-9921");
    await user.type(screen.getByLabelText("Confirm new password"), "N3w-pass-9921");
    await user.dblClick(screen.getByRole("button", { name: /update password/i }));
    await screen.findByText("LOGIN PAGE");
    expect(calls).toBe(1);
  });
});
