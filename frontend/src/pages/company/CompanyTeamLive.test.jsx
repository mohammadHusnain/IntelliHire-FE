import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { server } from "@/test/server";
import { apiInvitation, apiMember, detail, json, route } from "@/test/fixtures";
import { useAuthStore } from "@/store/authStore";
import { setTokens } from "@/api/tokenStorage";
import { useToastStore } from "@/store/toastStore";
import CompanyTeamLive from "./CompanyTeamLive";

const toasts = () => useToastStore.getState().toasts.map((t) => t.title);
const me = apiMember({ id: 1, full_name: "Ali Khan", email: "ali@acme.example", role: "admin" });
const bob = apiMember({ id: 2, full_name: "Bob Rao", email: "bob@acme.example", role: "recruiter" });

function mount({ memberRole = "admin", members = [me, bob], invitations = [apiInvitation()], handlers = [] } = {}) {
  setTokens({ access: "a", refresh: "r" });
  useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: { id: "u1", role: "company", status: "active", name: "Ali Khan", email: "ali@acme.example", memberRole, companyStatus: "approved" } });
  // Custom handlers first: the first matching handler wins.
  server.use(...handlers, route.get("/company/members/", () => json(members)), route.get("/company/invitations/", () => json(invitations)));
  return render(<MemoryRouter><CompanyTeamLive /></MemoryRouter>);
}

describe("CompanyTeamLive", () => {
  it("lists the members and the invitations for an admin", async () => {
    mount();
    expect(await screen.findByText("Bob Rao")).toBeInTheDocument();
    expect(await screen.findByText("newbie@acme.example", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send invitation/i })).toBeInTheDocument();
  });

  it("gives your own row no controls (the server refuses self changes)", async () => {
    mount();
    await screen.findByText("Bob Rao");
    expect(screen.queryByLabelText("Role of Ali Khan")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Role of Bob Rao")).toBeInTheDocument();
  });

  it("a non-admin sees the team read-only and never asks for invitations", async () => {
    let asked = false;
    mount({ memberRole: "recruiter", handlers: [route.get("/company/invitations/", () => ((asked = true), detail(403, "Unauthorized access.", "permission_denied")))] });
    expect(await screen.findByText("Bob Rao")).toBeInTheDocument();
    expect(screen.queryByLabelText("Role of Bob Rao")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /send invitation/i })).not.toBeInTheDocument();
    expect(screen.getByText(/only a company admin can invite/i)).toBeInTheDocument();
    expect(asked).toBe(false);
  });

  it("changes a role through the server and reloads the list", async () => {
    let body;
    mount({ handlers: [route.patch("/company/members/2/", async ({ request }) => ((body = await request.json()), json({ ...bob, role: "viewer" })))] });
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByLabelText("Role of Bob Rao"), "viewer");
    await waitFor(() => expect(toasts()).toContain("Role updated"));
    expect(body).toEqual({ role: "viewer" });
  });

  it("deactivates only after confirmation", async () => {
    let body;
    mount({ handlers: [route.patch("/company/members/2/", async ({ request }) => ((body = await request.json()), json({ ...bob, is_active: false })))] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Deactivate" }));
    expect(body).toBeUndefined();
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Deactivate" }));
    await waitFor(() => expect(body).toEqual({ is_active: false }));
  });

  it("shows the server's last_admin refusal and changes nothing", async () => {
    mount({
      members: [me, apiMember({ id: 3, full_name: "Zed Admin", email: "zed@acme.example", role: "admin" })],
      handlers: [route.patch("/company/members/3/", () => detail(400, "The company must keep at least one active admin.", "last_admin"))],
    });
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByLabelText("Role of Zed Admin"), "viewer");
    await waitFor(() => expect(toasts()).toContain("Couldn't do that"));
    expect(useToastStore.getState().toasts.some((t) => /at least one active admin/.test(t.message))).toBe(true);
  });

  it("validates the invitation locally", async () => {
    let called = false;
    mount({ handlers: [route.post("/company/invitations/", () => ((called = true), json(apiInvitation(), 201)))] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /send invitation/i }));
    expect(await screen.findByText("Enter their full name")).toBeInTheDocument();
    expect(screen.getByText("Enter their email")).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it("sends an invitation with the chosen role and clears the form", async () => {
    let body;
    mount({ handlers: [route.post("/company/invitations/", async ({ request }) => ((body = await request.json()), json(apiInvitation(), 201)))] });
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Full name"), "Nina Shah");
    await user.type(screen.getByLabelText("Work email"), "nina@acme.example");
    await user.selectOptions(screen.getByLabelText("Role"), "hr_manager");
    await user.click(screen.getByRole("button", { name: /send invitation/i }));
    await waitFor(() => expect(toasts()).toContain("Invitation sent"));
    expect(body).toEqual({ email: "nina@acme.example", full_name: "Nina Shah", role: "hr_manager", job_title: "" });
    expect(screen.getByLabelText("Work email")).toHaveValue("");
  });

  it.each([
    ["already registered", { email: ["An account with this email already exists."] }],
    ["already invited", { email: ["This email already has a pending invitation."] }],
  ])("%s: the server's message lands on the email field and the form is kept", async (_n, fieldErrors) => {
    mount({ handlers: [route.post("/company/invitations/", () => json(fieldErrors, 400))] });
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Full name"), "Nina Shah");
    await user.type(screen.getByLabelText("Work email"), "nina@acme.example");
    await user.click(screen.getByRole("button", { name: /send invitation/i }));
    expect(await screen.findByText(fieldErrors.email[0])).toBeInTheDocument();
    expect(screen.getByLabelText("Work email")).toHaveValue("nina@acme.example");
  });

  it("resends and revokes a pending invitation", async () => {
    const calls = [];
    mount({
      handlers: [
        route.post("/company/invitations/inv-1/resend/", () => (calls.push("resend"), json(apiInvitation()))),
        route.post("/company/invitations/inv-1/revoke/", () => (calls.push("revoke"), json(apiInvitation({ status: "revoked" })))),
      ],
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /resend/i }));
    await user.click(screen.getByRole("button", { name: /revoke/i }));
    await waitFor(() => expect(calls).toEqual(["resend", "revoke"]));
  });

  it("a 409 on revoke tells the user, and the list is reloaded", async () => {
    let lists = 0;
    mount({
      handlers: [
        route.get("/company/invitations/", () => (lists++, json([apiInvitation()]))),
        route.post("/company/invitations/inv-1/revoke/", () => detail(409, "Only pending invitations can be revoked.", "invalid_state")),
      ],
    });
    await userEvent.setup().click(await screen.findByRole("button", { name: /revoke/i }));
    await waitFor(() => expect(toasts()).toContain("Couldn't do that"));
    await waitFor(() => expect(lists).toBeGreaterThan(1));
  });

  it("offers resend (not revoke) for an expired invitation, and none for accepted or revoked ones", async () => {
    mount({
      invitations: [
        apiInvitation({ id: "e", email: "exp@acme.example", status: "expired" }),
        apiInvitation({ id: "a", email: "acc@acme.example", status: "accepted", accepted_at: "2026-02-02T00:00:00Z" }),
        apiInvitation({ id: "r", email: "rev@acme.example", status: "revoked" }),
      ],
    });
    await screen.findByText("exp@acme.example", { exact: false });
    expect(screen.getAllByRole("button", { name: /resend/i })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /revoke/i })).not.toBeInTheDocument();
  });

  it("filters invitations on the server", async () => {
    const asked = [];
    mount({ handlers: [route.get("/company/invitations/", ({ request }) => (asked.push(new URL(request.url).searchParams.get("status")), json([])))] });
    await userEvent.setup().selectOptions(await screen.findByLabelText("Filter invitations"), "accepted");
    await waitFor(() => expect(asked).toContain("accepted"));
  });

  it("a 403 shows the blocked screen, not a blank page", async () => {
    mount({ handlers: [route.get("/company/members/", () => detail(403, "Unauthorized access.", "permission_denied")), route.get("/auth/me/", () => json({ id: "u1", email: "ali@acme.example", full_name: "Ali Khan", role: "company_admin", status: "active", company: { id: "c0", name: "Acme", member_role: "admin", status: "suspended" } }))] });
    expect(await screen.findByText("Your company is suspended")).toBeInTheDocument();
  });

  it("a load failure offers a retry that works", async () => {
    let fail = true;
    mount({ handlers: [route.get("/company/members/", () => (fail ? detail(500, "Something went wrong.", "server_error") : json([me])))] });
    expect((await screen.findAllByRole("alert"))[0]).toBeInTheDocument();
    fail = false;
    await userEvent.setup().click(screen.getAllByRole("button", { name: /try again/i })[0]);
    expect(await screen.findByText("Ali Khan")).toBeInTheDocument();
  });

  it("an admin edits a member's job title (and their own)", async () => {
    const bodies = [];
    mount({
      handlers: [
        route.patch("/company/members/2/", async ({ request }) => (bodies.push(["2", await request.json()]), json({ ...bob, job_title: "Lead recruiter" }))),
        route.patch("/company/members/1/", async ({ request }) => (bodies.push(["1", await request.json()]), json({ ...me, job_title: "Founder" }))),
      ],
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Edit job title of Bob Rao" }));
    await user.type(screen.getByLabelText("Job title of Bob Rao"), "Lead recruiter");
    await user.click(screen.getByRole("button", { name: "Save job title" }));
    await waitFor(() => expect(toasts()).toContain("Job title updated"));
    await user.click(screen.getByRole("button", { name: "Edit job title of Ali Khan" }));
    await user.type(screen.getByLabelText("Job title of Ali Khan"), "Founder");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(bodies).toEqual([["2", { job_title: "Lead recruiter" }], ["1", { job_title: "Founder" }]]));
  });

  it("clearing a job title sends an empty title; saving the same title sends nothing; Escape cancels", async () => {
    const bodies = [];
    mount({
      members: [me, { ...bob, job_title: "Recruiter" }],
      handlers: [route.patch("/company/members/2/", async ({ request }) => (bodies.push(await request.json()), json({ ...bob, job_title: "" })))],
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Edit job title of Bob Rao" }));
    await user.click(screen.getByRole("button", { name: "Save job title" }));
    expect(bodies).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Edit job title of Bob Rao" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByLabelText("Job title of Bob Rao")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit job title of Bob Rao" }));
    await user.clear(screen.getByLabelText("Job title of Bob Rao"));
    await user.click(screen.getByRole("button", { name: "Save job title" }));
    await waitFor(() => expect(bodies).toEqual([{ job_title: "" }]));
  });

  it("a server error on the job title shows beside the field and keeps the edit open", async () => {
    mount({ handlers: [route.patch("/company/members/2/", () => json({ job_title: ["Ensure this field has no more than 100 characters."] }, 400))] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Edit job title of Bob Rao" }));
    await user.type(screen.getByLabelText("Job title of Bob Rao"), "x");
    await user.click(screen.getByRole("button", { name: "Save job title" }));
    expect(await screen.findByText("Ensure this field has no more than 100 characters.")).toBeInTheDocument();
    expect(screen.getByLabelText("Job title of Bob Rao")).toHaveValue("x");
  });

  it("a non-admin cannot edit job titles", async () => {
    mount({ memberRole: "recruiter", members: [me, { ...bob, job_title: "Recruiter" }] });
    await screen.findByText("Bob Rao");
    expect(screen.queryByRole("button", { name: /edit job title/i })).not.toBeInTheDocument();
    expect(screen.getByText("Recruiter", { selector: "p" })).toBeInTheDocument();
  });
});
