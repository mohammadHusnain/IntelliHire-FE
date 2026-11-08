import { describe, expect, it } from "vitest";
import { StrictMode } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse } from "msw";
import { server } from "@/test/server";
import { apiSchema, detail, errors, json, route } from "@/test/fixtures";
import { renderRoutes } from "@/test/utils";
import ApplyPage from "./ApplyPage";

const routes = { "/apply/:slug": <ApplyPage />, "/": <div>HOME</div> };
const at = "/apply/slug123456";
const withCustom = (...fields) => {
  const s = apiSchema();
  s.fields.push(...fields);
  return s;
};
const pdf = () => new File(["%PDF-1.4"], "cv.pdf", { type: "application/pdf" });

async function fillBasics(user) {
  await user.type(await screen.findByLabelText(/Full name/), "Sara Malik");
  await user.type(screen.getByLabelText(/^Email/), "sara@example.com");
  await user.type(screen.getByLabelText(/Phone number/), "+92 300 1234567");
  await user.selectOptions(screen.getByLabelText(/Highest education level/), "bachelor");
  await user.type(screen.getByLabelText(/Institution/), "NUST");
  await user.type(screen.getByLabelText(/Graduation year/), "2020");
  await user.upload(screen.getByLabelText(/^CV/), pdf());
}

describe("ApplyPage: reading the role", () => {
  it("shows the job, the company, the real salary currency and the form with built-in fields first", async () => {
    server.use(route.get("/public/jobs/slug123456/", () => json(apiSchema())));
    renderRoutes(routes, at);
    expect(await screen.findByRole("heading", { name: "Senior Django Engineer" })).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("PKR 100,000 – 200,000")).toBeInTheDocument();
    expect(screen.getByText("Python")).toBeInTheDocument();
    expect(screen.getByText("Communication")).toBeInTheDocument();
    const labels = screen.getAllByText(/^(Full name|Email|Phone number|Highest education level|Institution|Graduation year|CV)/).map((e) => e.textContent.replace(/\s*\*|\(optional\)/g, "").trim());
    expect(labels.slice(0, 7)).toEqual(["Full name", "Email", "Phone number", "Highest education level", "Institution", "Graduation year", "CV"]);
    expect(screen.getByRole("option", { name: "Bachelor's degree" })).toBeInTheDocument();
  });

  it("has no link inside a link (the logo is the only home link)", async () => {
    server.use(route.get("/public/jobs/slug123456/", () => json(apiSchema())));
    renderRoutes(routes, at);
    await screen.findByRole("heading", { name: "Senior Django Engineer" });
    expect(document.querySelectorAll("a a")).toHaveLength(0);
    expect(screen.getAllByRole("link", { name: "IntelliHire home" })).toHaveLength(1);
  });

  it("hides the salary when the server sends none", async () => {
    const s = apiSchema();
    s.job.salary = null;
    server.use(route.get("/public/jobs/slug123456/", () => json(s)));
    renderRoutes(routes, at);
    await screen.findByRole("heading", { name: "Senior Django Engineer" });
    expect(screen.queryByText(/PKR/)).not.toBeInTheDocument();
  });

  it("asks the server once under StrictMode", async () => {
    let calls = 0;
    server.use(route.get("/public/jobs/slug123456/", () => (calls++, json(apiSchema()))));
    renderRoutes({ "/apply/:slug": <StrictMode><ApplyPage /></StrictMode> }, at);
    await screen.findByRole("heading", { name: "Senior Django Engineer" });
    expect(calls).toBe(1);
  });

  it("an unknown slug (or a draft) is a clear not-found page", async () => {
    server.use(route.get("/public/jobs/slug123456/", () => detail(404, "Job not found.", "not_found")));
    renderRoutes(routes, at);
    expect(await screen.findByText("This job link isn't valid")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /submit/i })).not.toBeInTheDocument();
  });

  it("a closed job shows the role and the server's message, with no form", async () => {
    server.use(route.get("/public/jobs/slug123456/", () => json(apiSchema({ accepting: false, message: "This position is no longer accepting applications." }))));
    renderRoutes(routes, at);
    expect(await screen.findByText("Applications are closed")).toBeInTheDocument();
    expect(screen.getByText("This position is no longer accepting applications.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /submit/i })).not.toBeInTheDocument();
  });

  it("a load failure offers a retry that works", async () => {
    let fail = true;
    server.use(route.get("/public/jobs/slug123456/", () => (fail ? HttpResponse.error() : json(apiSchema()))));
    renderRoutes(routes, at);
    expect(await screen.findByRole("alert")).toHaveTextContent(/reach the server/i);
    fail = false;
    await userEvent.setup().click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByRole("heading", { name: "Senior Django Engineer" })).toBeInTheDocument();
  });
});

describe("ApplyPage: applying", () => {
  const schemaWithCustom = () => withCustom(
    { key: "linkedin", label: "LinkedIn", type: "url", required: false, options: [], option_labels: null, help_text: "", max_length: null, built_in: false },
    { key: "skills", label: "Your skills", type: "multiple_choice", required: true, options: ["Python", "SQL", "Go"], option_labels: null, help_text: "Pick all that apply", max_length: null, built_in: false },
    { key: "notice", label: "Notice period", type: "single_choice", required: false, options: ["Now", "1 month"], option_labels: null, help_text: "", max_length: null, built_in: false },
    { key: "why", label: "Why us?", type: "long_text", required: false, options: [], option_labels: null, help_text: "", max_length: 300, built_in: false },
  );

  it("requires the required fields locally and sends nothing", async () => {
    let sent = false;
    server.use(route.get("/public/jobs/slug123456/", () => json(schemaWithCustom())), route.post("/public/jobs/slug123456/apply/", () => ((sent = true), json({}, 201))));
    renderRoutes(routes, at);
    await userEvent.setup().click(await screen.findByRole("button", { name: /submit application/i }));
    expect(await screen.findByText("Full name is required.")).toBeInTheDocument();
    expect(screen.getByText("CV is required.")).toBeInTheDocument();
    expect(screen.getByText("Your skills is required.")).toBeInTheDocument();
    expect(sent).toBe(false);
  });

  it("refuses a CV that is not a PDF or DOCX, or is over 5 MB, before sending", async () => {
    let sent = false;
    server.use(route.get("/public/jobs/slug123456/", () => json(apiSchema())), route.post("/public/jobs/slug123456/apply/", () => ((sent = true), json({}, 201))));
    renderRoutes(routes, at);
    const user = userEvent.setup({ applyAccept: false });
    await fillBasics(user);
    await user.upload(screen.getByLabelText(/^CV/), new File(["x"], "cv.exe"));
    await user.click(screen.getByRole("button", { name: /submit application/i }));
    expect(await screen.findByText("Only PDF and DOCX files are accepted.")).toBeInTheDocument();
    await user.upload(screen.getByLabelText(/^CV/), new File([new Uint8Array(5 * 1024 * 1024 + 1)], "cv.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: /submit application/i }));
    expect(await screen.findByText("File must be 5 MB or smaller.")).toBeInTheDocument();
    expect(sent).toBe(false);
  });

  it("submits every answer (multiple choice as repeated keys, the CV as a file) and shows the reference", async () => {
    let form;
    server.use(
      route.get("/public/jobs/slug123456/", () => json(schemaWithCustom())),
      route.post("/public/jobs/slug123456/apply/", async ({ request }) => ((form = await request.formData()), json({ reference: "IH-ABC123", job_title: "Senior Django Engineer", company: "Acme", submitted_at: "2026-01-01T00:00:00Z" }, 201))),
    );
    renderRoutes(routes, at);
    const user = userEvent.setup();
    await fillBasics(user);
    await user.click(screen.getByLabelText("Python"));
    await user.click(screen.getByLabelText("Go"));
    await user.selectOptions(screen.getByLabelText(/Notice period/), "1 month");
    await user.type(screen.getByLabelText(/Why us/), "Great team");
    await user.click(screen.getByRole("button", { name: /submit application/i }));
    expect(await screen.findByText("Application received")).toBeInTheDocument();
    expect(screen.getByText("IH-ABC123")).toBeInTheDocument();
    expect(form.get("full_name")).toBe("Sara Malik");
    expect(form.get("education_level")).toBe("bachelor");
    expect(form.getAll("skills")).toEqual(["Python", "Go"]);
    expect(form.get("notice")).toBe("1 month");
    expect(form.has("linkedin")).toBe(false);
    expect(form.get("hp-website")).toBe("");
    expect(form.get("resume")).toBeTruthy();
  });

  it("puts every server message on its own field and keeps what was typed", async () => {
    server.use(
      route.get("/public/jobs/slug123456/", () => json(apiSchema())),
      route.post("/public/jobs/slug123456/apply/", () => json({ email: ["Enter a valid email address."], phone: ["Enter a valid phone number."], graduation_year: ["Graduation year must be between 1970 and 2032."] }, 400)),
    );
    renderRoutes(routes, at);
    const user = userEvent.setup();
    await fillBasics(user);
    await user.click(screen.getByRole("button", { name: /submit application/i }));
    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid phone number.")).toBeInTheDocument();
    expect(screen.getByText("Graduation year must be between 1970 and 2032.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Full name/)).toHaveValue("Sara Malik");
  });

  it("a duplicate application is reported on the email field", async () => {
    server.use(route.get("/public/jobs/slug123456/", () => json(apiSchema())), route.post("/public/jobs/slug123456/apply/", () => json({ email: ["You have already applied for this position with this email."] }, 400)));
    renderRoutes(routes, at);
    const user = userEvent.setup();
    await fillBasics(user);
    await user.click(screen.getByRole("button", { name: /submit application/i }));
    expect(await screen.findByText("You have already applied for this position with this email.")).toBeInTheDocument();
  });

  it("a job that closed while the form was open switches to the closed page", async () => {
    server.use(route.get("/public/jobs/slug123456/", () => json(apiSchema())), route.post("/public/jobs/slug123456/apply/", () => detail(410, "This position is no longer accepting applications.", "gone")));
    renderRoutes(routes, at);
    const user = userEvent.setup();
    await fillBasics(user);
    await user.click(screen.getByRole("button", { name: /submit application/i }));
    expect(await screen.findByText("Applications are closed")).toBeInTheDocument();
    expect(screen.queryByText("Application received")).not.toBeInTheDocument();
  });

  it("a throttle disables the button with a countdown", async () => {
    server.use(route.get("/public/jobs/slug123456/", () => json(apiSchema())), route.post("/public/jobs/slug123456/apply/", () => errors.throttled(30)));
    renderRoutes(routes, at);
    const user = userEvent.setup();
    await fillBasics(user);
    await user.click(screen.getByRole("button", { name: /submit application/i }));
    expect(await screen.findByRole("button", { name: /try again in \d+s/i })).toBeDisabled();
  });

  it.each([
    ["too large", () => errors.tooLarge(), /too large/i],
    ["a server error", () => detail(503, "We could not save your application. Please try again.", "x"), /something went wrong/i],
    ["a network failure", () => HttpResponse.error(), /reach the server/i],
  ])("%s is explained and the form keeps its answers", async (_n, make, text) => {
    server.use(route.get("/public/jobs/slug123456/", () => json(apiSchema())), route.post("/public/jobs/slug123456/apply/", make));
    renderRoutes(routes, at);
    const user = userEvent.setup();
    await fillBasics(user);
    await user.click(screen.getByRole("button", { name: /submit application/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(text);
    expect(screen.getByLabelText(/Full name/)).toHaveValue("Sara Malik");
    expect(screen.getByRole("button", { name: /submit application/i })).toBeEnabled();
  });

  it("does not submit twice on a double click", async () => {
    let calls = 0;
    server.use(
      route.get("/public/jobs/slug123456/", () => json(apiSchema())),
      route.post("/public/jobs/slug123456/apply/", async () => {
        calls += 1;
        await new Promise((r) => setTimeout(r, 150));
        return json({ reference: "IH-ABC123", job_title: "T", company: "Acme", submitted_at: "2026-01-01T00:00:00Z" }, 201);
      }),
    );
    renderRoutes(routes, at);
    const user = userEvent.setup();
    await fillBasics(user);
    await user.dblClick(screen.getByRole("button", { name: /submit application/i }));
    await waitFor(() => expect(screen.getByText("Application received")).toBeInTheDocument());
    expect(calls).toBe(1);
  });
});
