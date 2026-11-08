import { describe, expect, it } from "vitest";
import { StrictMode } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { server } from "@/test/server";
import { detail, json, route } from "@/test/fixtures";
import { renderRoutes, Where } from "@/test/utils";
import AcceptInvitePage from "./AcceptInvitePage";

const invite = { company: { name: "Acme", logo: null }, role: "recruiter", email: "new@acme.example", full_name: "New Hire" };
const routes = { "/accept-invite": <AcceptInvitePage />, "/login": <Where /> };
const link = "/accept-invite?token=tok-123";

async function fill(user, pw = "Fresh-Start-9082", confirm = pw) {
  await user.type(await screen.findByLabelText("Password", { exact: true }), pw);
  await user.type(screen.getByLabelText("Confirm password"), confirm);
  await user.click(screen.getByRole("button", { name: /join the team/i }));
}

describe("AcceptInvitePage", () => {
  it("shows the company and role, prefills the name, and removes the token from the address bar", async () => {
    server.use(route.get("/public/invitations/tok-123/", () => json(invite)));
    renderRoutes({ "/accept-invite": <><AcceptInvitePage /><Where /></> }, link);
    expect(await screen.findByRole("heading", { name: "Join Acme" })).toBeInTheDocument();
    expect(screen.getByText("Recruiter")).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toHaveValue("New Hire");
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(/^\/accept-invite$/));
  });

  it("asks the server once even under StrictMode", async () => {
    let calls = 0;
    server.use(route.get("/public/invitations/tok-123/", () => (calls++, json(invite))));
    renderRoutes({ "/accept-invite": <StrictMode><AcceptInvitePage /></StrictMode> }, link);
    await screen.findByRole("heading", { name: "Join Acme" });
    expect(calls).toBe(1);
  });

  it("accepts, then goes to the login page with a notice (no tokens are issued)", async () => {
    let body;
    server.use(
      route.get("/public/invitations/tok-123/", () => json(invite)),
      route.post("/public/invitations/tok-123/accept/", async ({ request }) => ((body = await request.json()), json({ email: "new@acme.example", status: "active" }, 201))),
    );
    renderRoutes(routes, link);
    await fill(userEvent.setup());
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/login"));
    expect(body).toEqual({ full_name: "New Hire", password: "Fresh-Start-9082", confirm_password: "Fresh-Start-9082" });
    expect(localStorage.getItem("intellihire_session")).toBeNull();
  });

  it("checks the confirmation locally without calling the server", async () => {
    let accepted = false;
    server.use(route.get("/public/invitations/tok-123/", () => json(invite)), route.post("/public/invitations/tok-123/accept/", () => ((accepted = true), json({}))));
    renderRoutes(routes, link);
    await fill(userEvent.setup(), "Fresh-Start-9082", "different");
    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(accepted).toBe(false);
  });

  it("puts the server's password rule on the password field", async () => {
    server.use(
      route.get("/public/invitations/tok-123/", () => json(invite)),
      route.post("/public/invitations/tok-123/accept/", () => json({ password: ["This password is too common."] }, 400)),
    );
    renderRoutes(routes, link);
    await fill(userEvent.setup(), "password123");
    expect(await screen.findByText("This password is too common.")).toBeInTheDocument();
  });

  it("does not submit twice on a double click", async () => {
    let calls = 0;
    server.use(
      route.get("/public/invitations/tok-123/", () => json(invite)),
      route.post("/public/invitations/tok-123/accept/", async () => {
        calls += 1;
        await new Promise((r) => setTimeout(r, 100));
        return json({ email: "new@acme.example", status: "active" }, 201);
      }),
    );
    renderRoutes(routes, link);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Password", { exact: true }), "Fresh-Start-9082");
    await user.type(screen.getByLabelText("Confirm password"), "Fresh-Start-9082");
    const button = screen.getByRole("button", { name: /join the team/i });
    await user.dblClick(button);
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/login"));
    expect(calls).toBe(1);
  });

  it.each([
    ["expired", "This invitation has expired.", /new invitation/i],
    ["revoked", "This invitation was revoked.", /still join/i],
    ["already_used", "This invitation was already used.", /log in with the password/i],
    ["company_unavailable", "The company is not available.", /not active/i],
    ["invalid_invitation", "Invalid invitation.", /invitation email/i],
  ])("a %s link says so with the server's message and what to do", async (code, message, help) => {
    server.use(route.get("/public/invitations/tok-123/", () => detail(400, message, code)));
    renderRoutes(routes, link);
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByText(help)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /join the team/i })).not.toBeInTheDocument();
  });

  it("a missing token asks for the link from the email", async () => {
    renderRoutes(routes, "/accept-invite");
    expect(await screen.findByText("Invitation link needed")).toBeInTheDocument();
  });

  it("an accept that fails with a taken email shows the server message and keeps the form", async () => {
    server.use(
      route.get("/public/invitations/tok-123/", () => json(invite)),
      route.post("/public/invitations/tok-123/accept/", () => detail(400, "An account with this email already exists.", "email_taken")),
    );
    renderRoutes(routes, link);
    await fill(userEvent.setup());
    expect(await screen.findByRole("alert")).toHaveTextContent("An account with this email already exists.");
    expect(screen.getByLabelText("Full name")).toHaveValue("New Hire");
  });

  it("a network failure offers a retry that works", async () => {
    let fail = true;
    server.use(route.get("/public/invitations/tok-123/", () => (fail ? new Response(null, { status: 503 }) : json(invite))));
    renderRoutes(routes, link);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fail = false;
    await userEvent.setup().click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByRole("heading", { name: "Join Acme" })).toBeInTheDocument();
  });
});
