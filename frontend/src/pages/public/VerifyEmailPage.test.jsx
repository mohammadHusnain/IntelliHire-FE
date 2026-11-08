import { StrictMode } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse } from "msw";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { server } from "@/test/server";
import { errors, json, route } from "@/test/fixtures";
import VerifyEmailPage from "./VerifyEmailPage";

function Url() {
  const l = useLocation();
  return <div data-testid="url">{l.pathname + l.search}</div>;
}

const open = (search, { strict = false } = {}) => {
  const tree = (
    <MemoryRouter initialEntries={[`/verify-email${search}`]}>
      <Routes>
        <Route path="/verify-email" element={<><VerifyEmailPage /><Url /></>} />
        <Route path="/login" element={<div>LOGIN PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
};

describe("VerifyEmailPage", () => {
  it("verifies once, shows success and removes the token from the address bar", async () => {
    const seen = [];
    server.use(route.post("/auth/verify-email/", async ({ request }) => (seen.push(await request.json()), json({ detail: "Email verified.", status: "active" }))));
    open("?token=abc%3A1xPhuD%3AdEf");
    expect(await screen.findByText("Email verified")).toBeInTheDocument();
    expect(screen.getByText(/you can log in now/i)).toBeInTheDocument();
    expect(seen).toEqual([{ token: "abc:1xPhuD:dEf" }]); // %3A is decoded to ":"
    // the address bar is cleaned right after the result is shown (a separate navigation), so wait for it
    await waitFor(() => expect(screen.getByTestId("url").textContent).not.toContain("token"));
    expect(screen.getByTestId("url")).toHaveTextContent("/verify-email");
  });

  it("calls the API exactly once even under React StrictMode (effects run twice)", async () => {
    let calls = 0;
    server.use(route.post("/auth/verify-email/", () => (calls++, json({ detail: "ok", status: "active" }))));
    open("?token=t", { strict: true });
    await screen.findByText("Email verified");
    expect(calls).toBe(1);
  });

  it("a company whose email is verified is told it awaits approval", async () => {
    server.use(route.post("/auth/verify-email/", () => json({ detail: "ok", status: "pending_approval" })));
    open("?token=t");
    expect(await screen.findByText(/waiting for administrator approval/i)).toBeInTheDocument();
  });

  it("a link opened a second time (already verified) still shows success", async () => {
    server.use(route.post("/auth/verify-email/", () => json({ detail: "Email already verified.", status: "active" })));
    open("?token=t");
    expect(await screen.findByText("Email verified")).toBeInTheDocument();
  });

  it("an expired link offers a new one", async () => {
    let resent;
    server.use(
      route.post("/auth/verify-email/", () => errors.expired()),
      route.post("/auth/resend-verification/", async ({ request }) => ((resent = await request.json()), json({ detail: "ok" }))),
    );
    open("?token=old");
    expect(await screen.findByText("This link has expired")).toBeInTheDocument();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "sara@example.com");
    await user.click(screen.getByRole("button", { name: /resend verification email/i }));
    expect(await screen.findByText(/new link is on its way/i)).toBeInTheDocument();
    expect(resent).toEqual({ email: "sara@example.com" });
  });

  it("an invalid or tampered link says so", async () => {
    server.use(route.post("/auth/verify-email/", () => errors.invalidLink()));
    open("?token=tampered");
    expect(await screen.findByText("This link isn't valid")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid verification link.");
  });

  it("a missing token explains what to do without calling the API", async () => {
    let calls = 0;
    server.use(route.post("/auth/verify-email/", () => (calls++, json({}))));
    open("");
    expect(await screen.findByText("Verification link needed")).toBeInTheDocument();
    expect(calls).toBe(0);
  });

  it("a network error can be retried and then succeeds", async () => {
    let attempt = 0;
    server.use(route.post("/auth/verify-email/", () => (++attempt === 1 ? HttpResponse.error() : json({ detail: "ok", status: "active" }))));
    open("?token=t");
    expect(await screen.findByText(/couldn't verify it yet/i)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("Email verified")).toBeInTheDocument();
    expect(attempt).toBe(2);
  });

  it("success links to the login page", async () => {
    server.use(route.post("/auth/verify-email/", () => json({ detail: "ok", status: "active" })));
    open("?token=t");
    await userEvent.setup().click(await screen.findByRole("link", { name: /go to log in/i }));
    expect(await screen.findByText("LOGIN PAGE")).toBeInTheDocument();
  });
});
