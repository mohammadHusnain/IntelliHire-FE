import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { server } from "@/test/server";
import { errors, json, route } from "@/test/fixtures";
import VerifyEmailPage from "./VerifyEmailPage";

const open = (state) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/verify-email", state }]}>
      <Routes>
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/login" element={<div>LOGIN PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );

async function typeCode(user, code) {
  await user.type(screen.getByLabelText("Verification code"), code);
}

describe("VerifyEmailPage", () => {
  it("prefills the email it arrived with and auto-submits once 6 digits are typed", async () => {
    let seen;
    server.use(route.post("/auth/verify-email/", async ({ request }) => ((seen = await request.json()), json({ detail: "Email verified.", status: "active" }))));
    open({ email: "sara@example.com" });
    expect(screen.getByLabelText("Email")).toHaveValue("sara@example.com");
    await typeCode(userEvent.setup(), "123456");
    await waitFor(() => expect(seen).toEqual({ email: "sara@example.com", code: "123456" }));
    expect(await screen.findByText("Email verified")).toBeInTheDocument();
    expect(screen.getByText(/taking you to log in/i)).toBeInTheDocument();
  });

  it("only digits count toward the 6, so other characters are ignored", async () => {
    server.use(route.post("/auth/verify-email/", () => json({ detail: "ok", status: "active" })));
    open({ email: "sara@example.com" });
    await userEvent.setup().type(screen.getByLabelText("Verification code"), "12-34-56");
    expect(await screen.findByText("Email verified")).toBeInTheDocument();
  });

  it("redirects to login shortly after success", async () => {
    server.use(route.post("/auth/verify-email/", () => json({ detail: "ok", status: "active" })));
    open({ email: "sara@example.com" });
    await typeCode(userEvent.setup(), "123456");
    await screen.findByText("Email verified");
    expect(await screen.findByText("LOGIN PAGE", {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it("a company whose email is verified is told it awaits approval, without redirecting on its own", async () => {
    server.use(route.post("/auth/verify-email/", () => json({ detail: "ok", status: "pending_approval" })));
    open({ email: "hr@acme.example" });
    await typeCode(userEvent.setup(), "123456");
    expect(await screen.findByText(/waiting for administrator approval/i)).toBeInTheDocument();
  });

  it("a wrong code shows the server's message and clears the field for another try", async () => {
    server.use(route.post("/auth/verify-email/", () => errors.codeInvalid(4)));
    open({ email: "sara@example.com" });
    await typeCode(userEvent.setup(), "000000");
    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect code. 4 attempts left.");
    expect(screen.getByLabelText("Verification code")).toHaveValue("");
  });

  it("an expired code offers a resend", async () => {
    let resent;
    server.use(
      route.post("/auth/verify-email/", () => errors.codeExpired()),
      route.post("/auth/resend-verification/", async ({ request }) => ((resent = await request.json()), json({ detail: "ok" }))),
    );
    open({ email: "sara@example.com" });
    await typeCode(userEvent.setup(), "123456");
    expect(await screen.findByRole("alert")).toHaveTextContent("This code has expired.");
    await userEvent.setup().click(screen.getByRole("button", { name: /resend verification code/i }));
    expect(await screen.findByText(/new code is on its way/i)).toBeInTheDocument();
    expect(resent).toEqual({ email: "sara@example.com" });
  });

  it("too many wrong attempts locks the code field until a resend", async () => {
    server.use(route.post("/auth/verify-email/", () => errors.codeLocked()));
    open({ email: "sara@example.com" });
    await typeCode(userEvent.setup(), "000000");
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many incorrect attempts.");
    expect(screen.getByLabelText("Verification code")).toBeDisabled();
  });

  it("with no email carried over, the candidate can type one and the button stays off until both fields are filled", async () => {
    open(undefined);
    expect(screen.getByLabelText("Email")).toHaveValue("");
    expect(screen.getByRole("button", { name: /verify/i })).toBeDisabled();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Verification code"), "123456");
    expect(screen.getByRole("button", { name: /verify/i })).toBeDisabled(); // no email yet, so nothing was sent
    await user.type(screen.getByLabelText("Email"), "late@example.com");
    server.use(route.post("/auth/verify-email/", () => json({ detail: "ok", status: "active" })));
    await user.click(screen.getByRole("button", { name: /verify/i }));
    expect(await screen.findByText("Email verified")).toBeInTheDocument();
  });
});
