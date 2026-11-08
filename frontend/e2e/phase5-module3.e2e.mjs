// Phase 5 / Module 3 end-to-end run: job posting, the application-form builder, publish / close / reopen / duplicate / delete,
// the share link, the form preview, the public apply page and who may do what — the real React app against the real Django API.
//
//   E2E_BACKEND_LOG=/path/backend.log E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... node e2e/phase5-module3.e2e.mjs
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { ADMIN, BASE, LOG, PASSWORD, PDF, addMember, api, chromium, createApprovedCompany, localInput, logIn } from "./helpers.mjs";

const SHOTS = process.env.E2E_SHOTS || "e2e-failures";
const run = Date.now().toString(36);
const results = [];
let page;

async function step(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ok   ${name}`);
  } catch (error) {
    results.push({ name, ok: false });
    console.log(`  FAIL ${name}\n       ${error.message.split("\n").slice(0, 14).join("\n       ")}`);
    mkdirSync(SHOTS, { recursive: true });
    await page?.screenshot({ path: `${SHOTS}/${name.replace(/\W+/g, "-")}.png`, fullPage: true }).catch(() => {});
    throw error;
  }
}

const login = async (email) => (await api("/auth/login/", { method: "POST", body: { email, password: PASSWORD } })).data.access;

async function addQuestion(p, { label, type, options = [], required = false, maxLength }) {
  await p.getByRole("button", { name: /add a question/i }).click();
  const form = p.getByRole("form", { name: "New question" });
  await form.getByLabel("Question").fill(label);
  await form.getByLabel("Answer type").selectOption(type);
  for (const option of options) {
    await form.getByRole("button", { name: /add option/i }).click();
    await form.getByLabel(/^Option \d+$/).last().fill(option);
  }
  if (maxLength) await form.getByLabel(/Maximum length/).fill(String(maxLength));
  if (required) await form.getByLabel(/Candidates must answer this/).check();
  await form.getByRole("button", { name: "Add question" }).click();
  await p.getByText("Question added").first().waitFor();
}

async function main() {
  assert(LOG && ADMIN.email && ADMIN.password, "Set E2E_BACKEND_LOG, E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD");
  const browser = await chromium.launch();
  const ctx = async () => (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page = await ctx();
  const consoleErrors = [];
  const watch = (p) => {
    p.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && consoleErrors.push(m.text()));
    p.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  };
  watch(page);

  console.log("Setup (through the API: a company, its team and a second company)");
  const company = await createApprovedCompany("a", run);
  const recruiter = await addMember(company.token, `e2e3-rec-${run}@example.test`, "recruiter");
  const viewer = await addMember(company.token, `e2e3-view-${run}@example.test`, "viewer");
  const hr = await addMember(company.token, `e2e3-hr-${run}@example.test`, "hr_manager");
  const other = await createApprovedCompany("b", run);
  console.log("  ok   company, recruiter, viewer, HR manager and a second company are ready");

  let jobId;
  let slug;
  let shareUrl;
  const title = `Data Engineer ${run}`;

  console.log("Draft, form builder and publishing");

  await step("a draft needs only a title and department; it opens the editor with the form builder", async () => {
    await logIn(page, company.owner, PASSWORD);
    await page.waitForURL(/\/company\/dashboard/);
    await page.goto(`${BASE}/company/jobs/create`);
    await page.getByRole("button", { name: "Save as draft" }).click();
    await page.getByText("Give the role a title").waitFor();
    await page.getByLabel("Role title").fill(title);
    await page.getByLabel("Department").fill("Data Platform");
    await page.getByRole("button", { name: "Save as draft" }).click();
    await page.waitForURL(/\/company\/jobs\/[0-9a-f-]{36}\/edit/);
    jobId = page.url().match(/jobs\/([0-9a-f-]{36})/)[1];
    await page.getByText("Application form").first().waitFor();
  });

  await step("custom questions of several types can be added, with the server's rules shown", async () => {
    await addQuestion(page, { label: "LinkedIn profile", type: "url" });
    await addQuestion(page, { label: "Notice period", type: "single_choice", options: ["Now", "1 month", "3 months"], required: true });
    await addQuestion(page, { label: "Your tools", type: "multiple_choice", options: ["Spark", "Airflow", "dbt"] });
    await addQuestion(page, { label: "Why this role?", type: "long_text", maxLength: 400 });
    await addQuestion(page, { label: "Portfolio PDF", type: "file" });
    await page.getByRole("button", { name: /add a question/i }).click();
    const form = page.getByRole("form", { name: "New question" });
    await form.getByLabel("Question").fill("Broken choice");
    await form.getByLabel("Answer type").selectOption("single_choice");
    await form.getByRole("button", { name: "Add question" }).click();
    await form.getByText(/between 2 and 20 options/i).waitFor();
    await form.getByRole("button", { name: "Cancel" }).click();
  });

  await step("questions can be reordered; the order is stored", async () => {
    await page.getByRole("button", { name: "Move Notice period up" }).click();
    await page.waitForFunction(() => document.querySelector('[aria-label="Custom questions"] li')?.textContent.includes("Notice period"));
    await page.reload();
    await page.getByText("Notice period").first().waitFor();
    const first = await page.locator('[aria-label="Custom questions"] li').first().innerText();
    assert.match(first, /Notice period/);
  });

  await step("publishing an incomplete role lists every missing item; nothing typed is lost", async () => {
    await page.getByRole("button", { name: "Publish role" }).click();
    for (const text of ["Describe the role", "Add at least one required skill", "Choose an employment type", "Add a location, or choose Remote", "Set a deadline"]) await page.getByText(text).first().waitFor();
    assert.equal(await page.getByLabel("Role title").inputValue(), title);
  });

  await step("the server's own rules show on the deadline (too soon, too far)", async () => {
    await page.getByLabel("Employment type").selectOption("full_time");
    await page.getByLabel("Workplace").selectOption("hybrid");
    await page.getByLabel("Location").fill("Lahore");
    await page.getByLabel(/^Description/).fill("Build and run our data pipelines.\nWork with analysts.");
    await page.getByLabel(/^Responsibilities/).fill("Design pipelines\nMonitor quality");
    await page.getByLabel(/^Required skills/).fill("Python");
    await page.getByLabel(/^Required skills/).press("Enter");
    await page.getByLabel(/^Soft skills/).fill("Communication");
    await page.getByLabel(/^Soft skills/).press("Enter");
    await page.getByLabel("Salary from", { exact: true }).fill("150000");
    await page.getByLabel("Salary to", { exact: true }).fill("250000");
    await page.getByLabel("Currency").fill("PKR");
    await page.getByLabel("Show the salary to candidates").check();
    await page.getByLabel("Applications close").fill(localInput(400));
    await page.getByRole("button", { name: "Publish role" }).click();
    await page.getByText("Deadline cannot be more than 6 months ahead.").waitFor();
    await page.getByLabel("Applications close").fill(localInput(0.01));
    await page.getByRole("button", { name: "Publish role" }).click();
    await page.getByText(/at least 1 hour from now/i).waitFor();
  });

  await step("a complete role publishes; the preview shows the real form and the server's share link", async () => {
    await page.getByLabel("Applications close").fill(localInput(30));
    await page.getByRole("button", { name: "Publish role" }).click();
    await page.waitForURL(/\/preview$/);
    shareUrl = await page.getByLabel("Application link").inputValue();
    slug = shareUrl.split("/apply/")[1];
    assert.match(slug, /^[\w-]{6,}$/);
    await page.getByText("PKR 150,000 – 250,000").waitFor();
    const labels = await page.locator("label").allInnerTexts();
    const order = labels.map((l) => l.replace(/\s*\*|\s*\(optional\)/g, "").trim()).filter((l) => !["Spark", "Airflow", "dbt"].includes(l)); // option labels of the multiple-choice question
    assert.deepEqual(order.slice(0, 7), ["Full name", "Email", "Phone number", "Highest education level", "Institution", "Graduation year", "CV"]);
    assert.deepEqual(order.slice(7), ["Notice period", "LinkedIn profile", "Your tools", "Why this role?", "Portfolio PDF"]);
  });

  await step("the share link works for a stranger (no account): the public page shows the role and its form", async () => {
    const visitor = await ctx();
    watch(visitor);
    await visitor.goto(shareUrl.replace(/^https?:\/\/[^/]+/, BASE));
    await visitor.getByRole("heading", { name: title }).waitFor();
    await visitor.getByText("PKR 150,000 – 250,000").waitFor();
    await visitor.getByLabel(/Notice period/).waitFor();
    const schema = await api(`/public/jobs/${slug}/`);
    assert.equal(schema.status, 200);
    assert.equal(schema.data.accepting, true);
    assert.equal(schema.data.fields.length, 12);
    await visitor.close();
  });

  console.log("Editing rules and applications");

  await step("an open role: allowed fields save, locked fields are disabled and the server refuses them", async () => {
    await page.goto(`${BASE}/company/jobs/${jobId}/edit`);
    for (const label of ["Department", "Employment type", "Workplace", "Openings", "Minimum years of experience", "Education"]) assert.equal(await page.getByLabel(label).isDisabled(), true, `${label} is locked`);
    await page.getByLabel("Location").fill("Karachi");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.getByText("Changes saved").first().waitFor();
    const refused = await api(`/jobs/${jobId}/`, { method: "PATCH", token: company.token, body: { department: "Hacked" } });
    assert.equal(refused.status, 409);
    assert.equal(refused.data.code, "field_locked");
  });

  await step("a candidate applies on the public page; the reference is shown", async () => {
    const visitor = await ctx();
    watch(visitor);
    await visitor.goto(`${BASE}/apply/${slug}`);
    await visitor.getByRole("button", { name: /submit application/i }).click();
    await visitor.getByText("Full name is required.").waitFor();
    await visitor.getByLabel(/Full name/).fill("Sara Malik");
    await visitor.getByLabel(/^Email/).fill(`sara-${run}@example.test`);
    await visitor.getByLabel(/Phone number/).fill("+92 300 1234567");
    await visitor.getByLabel(/Highest education level/).selectOption("bachelor");
    await visitor.getByLabel(/Institution/).fill("NUST");
    await visitor.getByLabel(/Graduation year/).fill("2020");
    await visitor.getByLabel(/^CV/).setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: PDF });
    await visitor.getByLabel(/Notice period/).selectOption("1 month");
    await visitor.getByLabel("Spark").check();
    await visitor.getByLabel("dbt").check();
    await visitor.getByLabel(/Why this role/).fill("I love data.");
    await visitor.getByRole("button", { name: /submit application/i }).click();
    await visitor.getByText("Application received").waitFor();
    await visitor.getByText(/IH-[A-Z0-9]{6}/).waitFor();
    await visitor.close();
  });

  await step("applying twice with the same email is refused on the email field", async () => {
    const visitor = await ctx();
    await visitor.goto(`${BASE}/apply/${slug}`);
    await visitor.getByLabel(/Full name/).fill("Sara Malik");
    await visitor.getByLabel(/^Email/).fill(`sara-${run}@example.test`);
    await visitor.getByLabel(/Phone number/).fill("+92 300 1234567");
    await visitor.getByLabel(/Highest education level/).selectOption("bachelor");
    await visitor.getByLabel(/Institution/).fill("NUST");
    await visitor.getByLabel(/Graduation year/).fill("2020");
    await visitor.getByLabel(/^CV/).setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: PDF });
    await visitor.getByLabel(/Notice period/).selectOption("Now");
    await visitor.getByRole("button", { name: /submit application/i }).click();
    await visitor.getByText("You have already applied for this position with this email.").waitFor();
    await visitor.close();
  });

  await step("once an application exists the builder locks: no delete, no new required, the server agrees", async () => {
    await page.reload();
    await page.getByText(/has 1 application/i).waitFor();
    assert.equal(await page.getByRole("button", { name: /^Delete / }).count(), 0);
    await page.getByRole("button", { name: "Edit LinkedIn profile" }).click();
    const form = page.getByRole("form", { name: "Edit question" });
    assert.equal(await form.getByLabel("Answer type").isDisabled(), true);
    assert.equal(await form.getByLabel(/Candidates must answer this/).isDisabled(), true);
    await form.getByLabel("Question").fill("LinkedIn URL");
    await form.getByRole("button", { name: "Save question" }).click();
    await page.getByText("Question updated").first().waitFor();
    const fields = (await api(`/jobs/${jobId}/fields/`, { token: company.token })).data;
    const linkedin = fields.find((f) => f.label === "LinkedIn URL");
    assert.equal((await api(`/jobs/${jobId}/fields/${linkedin.id}/`, { method: "DELETE", token: company.token })).status, 409);
    const required = await api(`/jobs/${jobId}/fields/`, { method: "POST", token: company.token, body: { label: "New required", field_type: "short_text", required: true } });
    assert.equal(required.status, 409);
    assert.equal(required.data.code, "field_locked");
  });

  console.log("Lifecycle");

  await step("the list shows the role with its application count and the department filter", async () => {
    await page.goto(`${BASE}/company/jobs`);
    await page.getByText(title).first().waitFor();
    await page.getByText("1 application").first().waitFor();
    const options = await page.getByLabel("Department").locator("option").allInnerTexts();
    assert(options.includes("Data Platform"), `departments offered: ${options}`);
    await page.getByLabel("Department").selectOption("Data Platform");
    await page.getByText(title).first().waitFor();
    await page.getByPlaceholder("Search by title").fill("zzz-nothing");
    await page.getByText("No roles match").waitFor();
    await page.getByRole("button", { name: /clear filters/i }).click();
  });

  await step("close stops applications (the public page says so), reopen needs a new deadline and keeps the link", async () => {
    await page.getByRole("button", { name: /^close$/i }).first().click();
    await page.getByText("Role closed").first().waitFor();
    const closedSchema = await api(`/public/jobs/${slug}/`);
    assert.equal(closedSchema.data.accepting, false);
    const visitor = await ctx();
    await visitor.goto(`${BASE}/apply/${slug}`);
    await visitor.getByText("Applications are closed").waitFor();
    assert.equal(await visitor.getByRole("button", { name: /submit application/i }).count(), 0);
    await visitor.close();
    await page.getByRole("tab", { name: /closed/i }).click();
    await page.getByRole("button", { name: /reopen/i }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Reopen" }).click();
    await dialog.getByText("Choose the new deadline").waitFor();
    await dialog.getByLabel("New deadline").fill(localInput(400));
    await dialog.getByRole("button", { name: "Reopen" }).click();
    await dialog.getByText(/cannot be more than 6 months/i).waitFor();
    await dialog.getByLabel("New deadline").fill(localInput(20));
    await dialog.getByRole("button", { name: "Reopen" }).click();
    await page.getByText("Role reopened").first().waitFor();
    const after = (await api(`/jobs/${jobId}/`, { token: company.token })).data;
    assert.equal(after.status, "open");
    assert.equal(after.form_slug, slug);
  });

  await step("duplicate creates an editable draft (with the questions); deleting it needs a confirmation", async () => {
    await page.goto(`${BASE}/company/jobs`);
    await page.getByRole("button", { name: new RegExp(`Duplicate ${title}`) }).first().click();
    await page.waitForURL(/\/company\/jobs\/[0-9a-f-]{36}\/edit/);
    await page.getByText("Notice period").first().waitFor();
    assert.equal(await page.getByLabel("Role title").inputValue(), `${title} (copy)`);
    await page.goto(`${BASE}/company/jobs`);
    await page.getByRole("tab", { name: /drafts/i }).click();
    await page.getByRole("button", { name: `Delete ${title} (copy)` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete draft" }).click();
    await page.getByText("Role deleted").first().waitFor();
    await page.getByText(`${title} (copy)`, { exact: true }).waitFor({ state: "detached" });
  });

  await step("a published role cannot be deleted (the server says so)", async () => {
    const refused = await api(`/jobs/${jobId}/`, { method: "DELETE", token: company.token });
    assert.equal(refused.status, 409);
    assert.equal(refused.data.code, "invalid_state");
  });

  console.log("Roles and isolation");

  await step("a recruiter edits, publishes and closes, but cannot delete or reopen", async () => {
    const p = await ctx();
    watch(p);
    await logIn(p, recruiter, PASSWORD);
    await p.waitForURL(/\/company\/dashboard/);
    await p.goto(`${BASE}/company/jobs`);
    await p.getByText(title).first().waitFor();
    assert.equal(await p.getByRole("button", { name: /^close$/i }).count() > 0, true);
    assert.equal(await p.getByRole("button", { name: /^Delete / }).count(), 0);
    const token = await login(recruiter);
    assert.equal((await api(`/jobs/${jobId}/reopen/`, { method: "POST", token, body: { deadline: new Date(Date.now() + 86400000 * 5).toISOString() } })).status, 403);
    await p.close();
  });

  await step("an HR manager can reopen and delete drafts", async () => {
    const token = await login(hr);
    const draft = await api("/jobs/", { method: "POST", token, body: { title: `HR draft ${run}`, department: "People" } });
    assert.equal(draft.status, 201);
    assert.equal((await api(`/jobs/${draft.data.id}/`, { method: "DELETE", token })).status, 204);
  });

  await step("a viewer sees the roles but has no way to change anything", async () => {
    const p = await ctx();
    watch(p);
    await logIn(p, viewer, PASSWORD);
    await p.waitForURL(/\/company\/dashboard/);
    await p.goto(`${BASE}/company/jobs`);
    await p.getByText(title).first().waitFor();
    for (const name of [/post a role/i, /^close$/i, /^publish$/i, /duplicate/i, /^edit$/i]) assert.equal(await p.getByRole("button", { name }).or(p.getByRole("link", { name })).count(), 0, String(name));
    await p.goto(`${BASE}/company/jobs/create`);
    await p.getByText("You can't edit roles").waitFor();
    const token = await login(viewer);
    assert.equal((await api("/jobs/", { method: "POST", token, body: { title: "x", department: "y" } })).status, 403);
    await p.close();
  });

  await step("another company's role is simply not found (no leak)", async () => {
    const p = await ctx();
    watch(p);
    await logIn(p, other.owner, PASSWORD);
    await p.waitForURL(/\/company\/dashboard/);
    await p.goto(`${BASE}/company/jobs/${jobId}/preview`);
    await p.getByText("Role not found").waitFor();
    await p.goto(`${BASE}/company/jobs/${jobId}/edit`);
    await p.getByText("Role not found").waitFor();
    await p.goto(`${BASE}/company/jobs`);
    await p.getByText(title).waitFor({ state: "detached" });
    assert.equal((await api(`/jobs/${jobId}/`, { token: other.token })).status, 404);
    await p.close();
  });

  await step("a suspended company sees the blocked screen on the job pages, and its public page stops accepting", async () => {
    assert.equal((await api(`/platform-admin/companies/${company.companyId}/suspend/`, { method: "POST", token: company.platform, body: { reason: "Suspended for the e2e run" } })).status, 200);
    await page.goto(`${BASE}/company/jobs`);
    await page.getByText("Your company is suspended").waitFor();
    assert.equal((await api(`/public/jobs/${slug}/`)).data.accepting, false);
    assert.equal((await api(`/platform-admin/companies/${company.companyId}/reactivate/`, { method: "POST", token: company.platform })).status, 200);
    await page.getByRole("button", { name: /check again/i }).click();
    await page.goto(`${BASE}/company/jobs`);
    await page.getByText(title).first().waitFor();
  });

  await step("the dashboard's closing-soon row opens the real role preview", async () => {
    // closing soon = deadline within 7 days; moving the deadline of an open role is allowed
    const moved = await api(`/jobs/${jobId}/`, { method: "PATCH", token: company.token, body: { deadline: new Date(Date.now() + 5 * 86400000).toISOString() } });
    assert.equal(moved.status, 200);
    await page.goto(`${BASE}/company/dashboard`);
    await page.getByRole("link", { name: new RegExp(title) }).first().click();
    await page.waitForURL(new RegExp(`/company/jobs/${jobId}/preview`));
    await page.getByRole("heading", { name: title }).waitFor();
  });

  await step("an unknown public link is a clear not-found page", async () => {
    const visitor = await ctx();
    await visitor.goto(`${BASE}/apply/does-not-exist`);
    await visitor.getByText("This job link isn't valid").waitFor();
    await visitor.close();
  });

  await step("no console errors during the whole run", async () => {
    if (consoleErrors.length) console.log(consoleErrors.map((e) => `       - ${e.slice(0, 400).replace(/\n/g, " ")}`).join("\n"));
    assert.deepEqual(consoleErrors, []);
  });

  await browser.close();
}

let failed = false;
try {
  await main();
} catch {
  failed = true;
}
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} steps passed${failed ? " (stopped at the first failure)" : ""}`);
process.exit(failed ? 1 : 0);
