import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { server } from "@/test/server";
import { detail, errors, json, route } from "@/test/fixtures";
import { renderRoutes, Where } from "@/test/utils";
import ResubmitCompanyPage from "./ResubmitCompanyPage";

const routes = { "/resubmit-company": <ResubmitCompanyPage />, "/login": <Where /> };

async function fill(user) {
  await user.type(screen.getByLabelText("Official email"), "owner@acme.example");
  await user.type(screen.getByLabelText("Password"), "Sunny-Day-4711");
  await user.type(screen.getByLabelText("Company name"), "Acme Inc.");
  await user.selectOptions(screen.getByLabelText("Industry"), "Finance");
  await user.type(screen.getByLabelText("Your full name"), "Ali Khan");
  await user.type(screen.getByLabelText("Your phone number"), "+92 300 1234567");
  await user.click(screen.getByRole("button", { name: /submit for review/i }));
}

describe("ResubmitCompanyPage", () => {
  it("requires every field before calling the server", async () => {
    let called = false;
    server.use(route.post("/auth/register/company/resubmit/", () => ((called = true), json({}))));
    renderRoutes(routes, "/resubmit-company");
    await userEvent.setup().click(screen.getByRole("button", { name: /submit for review/i }));
    expect(await screen.findByText("Enter the email you registered with")).toBeInTheDocument();
    expect(screen.getByText("Phone number is required")).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it("sends the corrected details and goes to the login page", async () => {
    let body;
    server.use(route.post("/auth/register/company/resubmit/", async ({ request }) => ((body = await request.json()), json({ detail: "ok", status: "pending" }))));
    renderRoutes(routes, "/resubmit-company");
    await fill(userEvent.setup());
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/login"));
    expect(body).toEqual({ official_email: "owner@acme.example", password: "Sunny-Day-4711", company_name: "Acme Inc.", industry: "Finance", admin_full_name: "Ali Khan", admin_phone: "+92 300 1234567" });
  });

  it("puts a taken company name on its field", async () => {
    server.use(route.post("/auth/register/company/resubmit/", () => json({ company_name: ["A company with this name is already registered."] }, 400)));
    renderRoutes(routes, "/resubmit-company");
    await fill(userEvent.setup());
    expect(await screen.findByText("A company with this name is already registered.")).toBeInTheDocument();
  });

  it.each([
    ["wrong password", () => detail(400, "Invalid email or password.", "invalid_credentials"), "Invalid email or password."],
    ["not a rejected company", () => detail(400, "This registration is not awaiting corrections.", "not_rejected"), "This registration is not awaiting corrections."],
  ])("%s shows the server's message and keeps the form", async (_n, make, message) => {
    server.use(route.post("/auth/register/company/resubmit/", make));
    renderRoutes(routes, "/resubmit-company");
    await fill(userEvent.setup());
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByLabelText("Company name")).toHaveValue("Acme Inc.");
  });

  it("a throttle disables the button with a countdown", async () => {
    server.use(route.post("/auth/register/company/resubmit/", () => errors.throttled(30)));
    renderRoutes(routes, "/resubmit-company");
    await fill(userEvent.setup());
    expect(await screen.findByRole("button", { name: /try again in \d+s/i })).toBeDisabled();
  });
});
