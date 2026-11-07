import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { server } from "@/test/server";
import { errors, json, route } from "@/test/fixtures";
import ForgotPasswordModal from "./ForgotPasswordModal";

const open = (props = {}) => render(<ForgotPasswordModal open onClose={() => {}} {...props} />);

describe("ForgotPasswordModal", () => {
  it("asks for a valid email first", async () => {
    let calls = 0;
    server.use(route.post("/auth/password/forgot/", () => (calls++, json({}))));
    open();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));
    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(calls).toBe(0);
  });

  it("shows the same neutral confirmation, whatever the server knows", async () => {
    let body;
    server.use(route.post("/auth/password/forgot/", async ({ request }) => ((body = await request.json()), json({ detail: "If that email is registered, a reset link has been sent." }))));
    open({ initialEmail: " sara@example.com " });
    await userEvent.setup().click(screen.getByRole("button", { name: /send reset link/i }));
    expect(await screen.findByText("Check your inbox")).toBeInTheDocument();
    expect(screen.getByText(/if an account exists for/i)).toBeInTheDocument();
    expect(body).toEqual({ email: "sara@example.com" });
  });

  it("explains a throttle", async () => {
    server.use(route.post("/auth/password/forgot/", () => errors.throttled(600)));
    open({ initialEmail: "sara@example.com" });
    await userEvent.setup().click(screen.getByRole("button", { name: /send reset link/i }));
    expect(await screen.findByText(/try again in 10 minutes/i)).toBeInTheDocument();
  });

  it("cannot be double submitted", async () => {
    let calls = 0;
    server.use(route.post("/auth/password/forgot/", async () => (calls++, await new Promise((r) => setTimeout(r, 50)), json({}))));
    open({ initialEmail: "sara@example.com" });
    await userEvent.setup().dblClick(screen.getByRole("button", { name: /send reset link/i }));
    await screen.findByText("Check your inbox");
    expect(calls).toBe(1);
  });
});
