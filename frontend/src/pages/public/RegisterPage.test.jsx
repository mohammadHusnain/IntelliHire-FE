import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { server } from "@/test/server";
import { detail, json, route } from "@/test/fixtures";
import { renderRoutes } from "@/test/utils";
import RegisterPage from "./RegisterPage";

const routes = { "/register": <RegisterPage />, "/login": <div>LOGIN PAGE</div> };
const cont = () => screen.getByRole("button", { name: /continue|create account/i });

// jsdom has no scrolling
window.scrollTo = vi.fn();

async function accountStep(user, kind) {
  await user.click(screen.getByRole("radio", { name: kind === "company" ? /hire talent/i : /practise interviews/i }));
  await user.type(screen.getByLabelText("Full name"), "Sara Malik");
  await user.type(screen.getByLabelText(kind === "company" ? "Work email" : "Email"), "sara@example.com");
  await user.type(screen.getByLabelText("Password"), "Sunny-Day-4711");
  await user.type(screen.getByLabelText("Confirm password"), "Sunny-Day-4711");
  await user.click(cont());
}

async function candidateSteps(user, file = new File(["%PDF-1.4"], "cv.pdf", { type: "application/pdf" })) {
  await accountStep(user, "candidate");
  await user.click(await screen.findByRole("button", { name: /search or select a role/i }));
  await user.click((await screen.findAllByRole("option"))[0]);
  await user.click((await screen.findAllByRole("button", { name: /^\+ / }))[0]);
  await user.click(cont());
  await user.type(await screen.findByLabelText("LinkedIn profile"), "https://linkedin.com/in/sara");
  await user.type(screen.getByLabelText("GitHub profile"), "https://github.com/sara");
  await user.upload(document.querySelector('input[type="file"]'), file);
  await user.click(cont());
  await screen.findByRole("button", { name: /create account/i });
}

describe("RegisterPage", () => {
  it("validates the first step locally", async () => {
    renderRoutes(routes, "/register");
    const user = userEvent.setup();
    await user.click(cont());
    expect(await screen.findByText("Choose an account type to continue")).toBeInTheDocument();
    expect(screen.getByText("Full name is required")).toBeInTheDocument();
  });

  it("registers a candidate with the profile answers and the CV, then goes to log in", async () => {
    let form;
    server.use(route.post("/auth/register/candidate/", async ({ request }) => ((form = await request.formData()), json({ detail: "ok" }, 201))));
    renderRoutes(routes, "/register");
    const user = userEvent.setup();
    await candidateSteps(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText("LOGIN PAGE")).toBeInTheDocument();
    expect(form.get("full_name")).toBe("Sara Malik");
    expect(form.get("email")).toBe("sara@example.com");
    expect(form.get("linkedin_url")).toBe("https://linkedin.com/in/sara");
    expect(form.get("target_role")).toBeTruthy();
    expect(form.getAll("skills").length).toBe(1);
    expect(form.get("resume")).toBeTruthy();
  });

  it("puts a server error on the right input and returns to the step that holds it", async () => {
    server.use(route.post("/auth/register/candidate/", () => json({ email: ["A user with this email already exists."] }, 400)));
    renderRoutes(routes, "/register");
    const user = userEvent.setup();
    await candidateSteps(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText("A user with this email already exists.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("sara@example.com"); // back on step 1, nothing lost
  });

  it("shows a throttle message and keeps the form so the user can retry", async () => {
    server.use(route.post("/auth/register/candidate/", () => detail(429, "Request was throttled. Expected available in 120 seconds.", "throttled")));
    renderRoutes(routes, "/register");
    const user = userEvent.setup();
    await candidateSteps(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(/throttled|too many|try again/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeEnabled();
  });

  it("refuses a CV that is not a PDF or DOCX before sending anything", async () => {
    renderRoutes(routes, "/register");
    const user = userEvent.setup({ applyAccept: false });
    await accountStep(user, "candidate");
    await user.click(await screen.findByRole("button", { name: /search or select a role/i }));
    await user.click((await screen.findAllByRole("option"))[0]);
    await user.click((await screen.findAllByRole("button", { name: /^\+ / }))[0]);
    await user.click(cont());
    await user.type(await screen.findByLabelText("LinkedIn profile"), "https://linkedin.com/in/sara");
    await user.type(screen.getByLabelText("GitHub profile"), "https://github.com/sara");
    await user.upload(document.querySelector('input[type="file"]'), new File(["x"], "cv.exe"));
    expect(await screen.findByText("Upload a PDF or DOCX file")).toBeInTheDocument();
  });

  it("registers a company with the admin phone number", async () => {
    let body;
    server.use(route.post("/auth/register/company/", async ({ request }) => ((body = await request.json()), json({ detail: "ok" }, 201))));
    renderRoutes(routes, "/register");
    const user = userEvent.setup();
    await accountStep(user, "company");
    await user.type(await screen.findByLabelText("Company name"), "Acme Inc.");
    await user.selectOptions(screen.getByLabelText("Industry"), screen.getAllByRole("option")[1]);
    await user.type(screen.getByLabelText("Your phone number"), "+92 300 1234567");
    await user.click(cont());
    expect(await screen.findByText("LOGIN PAGE")).toBeInTheDocument();
    expect(body).toMatchObject({ company_name: "Acme Inc.", official_email: "sara@example.com", admin_full_name: "Sara Malik", admin_phone: "+92 300 1234567" });
  });
});
