// Phase 5 / Module 4 end-to-end run: candidates of a role and of the company, the profile, status changes with notes and history,
// notes, bulk moves, CV and file downloads, the CSV export, counts everywhere, and who may do what — the real React app against the real Django API.
//
//   E2E_BACKEND_LOG=/path/backend.log E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... node e2e/phase5-module4.e2e.mjs
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { ADMIN, BASE, LOG, PASSWORD, PDF, addMember, api, applyPublic, chromium, createApprovedCompany, createPublishedJob, logIn } from "./helpers.mjs";

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
const CV = (marker) => Buffer.concat([PDF, Buffer.from(`\n% ${marker}\n`)]);
const PORTFOLIO = Buffer.concat([PDF, Buffer.from("\n% PORTFOLIO-MARKER\n")]);
const LEVELS = ["none", "intermediate", "bachelor", "master", "phd"];

async function main() {
  assert(LOG && ADMIN.email && ADMIN.password, "Set E2E_BACKEND_LOG, E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD");
  const browser = await chromium.launch();
  const ctx = async () => (await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })).newPage();
  page = await ctx();
  const consoleErrors = [];
  const watch = (p) => {
    p.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && consoleErrors.push(m.text()));
    p.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  };
  watch(page);

  console.log("Setup (through the API: companies, team, a published role and 27 real applications)");
  const company = await createApprovedCompany("a", run);
  const recruiter = await addMember(company.token, `e2e4-rec-${run}@example.test`, "recruiter");
  const viewer = await addMember(company.token, `e2e4-view-${run}@example.test`, "viewer");
  const hr = await addMember(company.token, `e2e4-hr-${run}@example.test`, "hr_manager");
  const other = await createApprovedCompany("b", run);
  const title = `Backend Engineer ${run}`;
  const job = await createPublishedJob(company.token, {
    title,
    autoAnalyse: false, // since Phase 2 Module 6 a scored CV moves an application to under review by itself; this run drives every status by hand
    fields: [
      { label: "LinkedIn profile", field_type: "url" },
      { label: "Notice period", field_type: "single_choice", options: ["Now", "1 month", "3 months"], required: true },
      { label: "Your tools", field_type: "multiple_choice", options: ["Spark", "Airflow", "dbt"] },
      { label: "Why this role?", field_type: "long_text" },
      { label: "Portfolio", field_type: "file" },
    ],
  });
  await createPublishedJob(other.token, { title: `Other company role ${run}` });
  const references = {};
  const base = (i, extra = {}) => ({
    full_name: `Person ${String(i).padStart(2, "0")}`, email: `p${i}-${run}@example.test`, phone: "+92 300 1234567",
    education_level: LEVELS[i % 5], institution: `University ${i}`, graduation_year: String(2010 + (i % 12)), notice_period: "Now", ...extra,
  });
  for (let i = 1; i <= 27; i += 1) {
    let extra = {};
    let files = { resume: { name: `cv-${i}.pdf`, type: "application/pdf", bytes: CV(`CV-MARKER-${i}`) } };
    if (i === 1) {
      extra = { full_name: "Zoë Åström", institution: "=HYPERLINK(\"http://evil.example\")", linkedin_profile: "https://linkedin.com/in/zoe", your_tools: ["Spark", "dbt"], why_this_role: "I love data.\nAnd pipelines.", notice_period: "1 month" };
      files = { ...files, portfolio: { name: "portfolio.pdf", type: "application/pdf", bytes: PORTFOLIO } };
    }
    references[i] = await applyPublic(job.slug, base(i, extra), files);
  }
  // spread the statuses through the API (a real teammate would do this in the UI)
  const list = (await api(`/jobs/${job.id}/applications/?page_size=100`, { token: company.token })).data.results;
  const byName = Object.fromEntries(list.map((a) => [a.full_name, a.id]));
  for (const [n, status] of [[2, "under_review"], [3, "under_review"], [4, "shortlisted"], [5, "shortlisted"], [6, "interview"], [7, "selected"], [8, "on_hold"], [9, "rejected"], [10, "rejected"], [11, "rejected"]]) {
    await api(`/applications/${byName[`Person ${String(n).padStart(2, "0")}`]}/status/`, { method: "PATCH", token: company.token, body: { status } });
  }
  const zoeId = byName["Zoë Åström"];
  console.log("  ok   27 applications exist: 2 under review, 2 shortlisted, 1 interview, 1 selected, 1 on hold, 3 rejected, 17 applied");

  console.log("Browsing");

  await step("the role list links the applications count to the role's candidates; the header counts agree with the server", async () => {
    await logIn(page, company.owner, PASSWORD);
    await page.waitForURL(/\/company\/dashboard/);
    await page.goto(`${BASE}/company/jobs`);
    await page.getByRole("link", { name: /27 applications/ }).first().click();
    await page.waitForURL(new RegExp(`/company/jobs/${job.id}/candidates`));
    await page.getByText("27 applications · 17 awaiting first review").waitFor();
  });

  await step("the board has one column per status with the right counts", async () => {
    const expected = { Applied: 17, "Under review": 2, Shortlisted: 2, Interview: 1, Selected: 1, "On hold": 1, Rejected: 3 };
    for (const [name, count] of Object.entries(expected)) {
      await page.getByRole("region", { name }).getByText(String(count), { exact: true }).first().waitFor();
    }
    // the Applied column shows the first 10 and offers the rest
    await page.getByRole("region", { name: "Applied" }).getByRole("button", { name: /show more \(7\)/i }).waitFor();
  });

  await step("the list: a tab per status with its count, search by name, reference and email, education filter, ordering, pages", async () => {
    await page.getByRole("radio", { name: /list/i }).click();
    await page.getByRole("tab", { name: /^Rejected/ }).click();
    await page.getByText("Person 09").first().waitFor();
    await page.getByText("Person 12").first().waitFor({ state: "detached" }); // only the rejected ones are left
    await page.getByRole("tab", { name: /^All/ }).click();
    await page.getByText(/Page 1 of 2/).waitFor();
    await page.getByRole("button", { name: /next/i }).click();
    await page.getByText(/Page 2 of 2/).waitFor();
    const search = page.getByPlaceholder(/search name, email or reference/i);
    await search.fill(references[12]);
    await page.getByText("Person 12").first().waitFor();
    await page.getByText(/Page \d of \d/).waitFor({ state: "detached" });
    await search.fill(`p13-${run}@example`);
    await page.getByText("Person 13").first().waitFor();
    await search.fill("Zoë");
    await page.getByText("Zoë Åström").first().waitFor();
    await search.fill("");
    await page.getByLabel("Education").selectOption("phd");
    await page.getByText("Person 04").first().waitFor(); // i % 5 === 4 is phd
    await page.getByText("Person 06").first().waitFor({ state: "detached" }); // the education filter is applied on the server
    await page.getByLabel("Education").selectOption("");
    await page.getByLabel("Order by").selectOption("-full_name");
    await page.getByRole("tab", { name: /^All/ }).click();
    await page.getByText("Zoë Åström").first().waitFor();
  });

  await step("the date filter keeps today's applications and drops a past range", async () => {
    const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
    await page.getByLabel("Applied from").fill(day(-1));
    await page.getByLabel("Applied to").fill(day(1));
    await page.getByText("Zoë Åström").first().waitFor();
    await page.getByLabel("Applied from").fill("2020-01-01");
    await page.getByLabel("Applied to").fill("2020-01-02");
    await page.getByText("No candidates match").waitFor();
    await page.getByRole("button", { name: /clear filters/i }).click();
    await page.getByText("Zoë Åström").first().waitFor();
  });

  await step("the company-wide view lists every role's candidates and the role filter narrows it (counts come from one request per status)", async () => {
    await page.goto(`${BASE}/company/candidates`);
    await page.getByText("27 applications · 17 awaiting first review").waitFor();
    await page.getByLabel("Role").selectOption(job.id);
    await page.getByText(/pipeline for/i).waitFor();
    assert.match(page.url(), new RegExp(`/company/jobs/${job.id}/candidates`));
  });

  console.log("Profile, downloads and notes");

  await step("a candidate's profile shows contact, education, every answer type and the history", async () => {
    await page.goto(`${BASE}/company/candidates/${zoeId}`);
    await page.getByRole("heading", { name: /Zoë Åström/ }).waitFor();
    await page.getByText(`reference ${references[1]}`, { exact: false }).waitFor();
    await page.getByText("1 month").waitFor();
    await page.getByRole("link", { name: /linkedin.com\/in\/zoe/ }).waitFor();
    await page.getByText("Spark").first().waitFor();
    await page.getByText("dbt").first().waitFor();
    await page.getByText(/I love data\./).waitFor();
    await page.getByText("Applied", { exact: true }).first().waitFor();
    assert.equal(await page.getByText(/cv match|screening|technical/i).count(), 0, "no invented scores");
  });

  await step("the CV and a file answer download byte for byte with the server's file name", async () => {
    const [cv] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /^download$/i }).click()]);
    assert.equal(cv.suggestedFilename(), "cv-1.pdf");
    assert.deepEqual(readFileSync(await cv.path()), CV("CV-MARKER-1"));
    const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /portfolio.pdf/ }).click()]);
    assert.equal(file.suggestedFilename(), "portfolio.pdf");
    assert.deepEqual(readFileSync(await file.path()), PORTFOLIO);
  });

  await step("'View CV' opens a new tab pointing at the authenticated file (a blob), never at the bare API address", async () => {
    const [popup] = await Promise.all([page.context().waitForEvent("page"), page.getByRole("button", { name: /view cv/i }).click()]);
    // A headless browser has no PDF viewer, so it turns the blob into a download; a normal browser shows it. Either way the bytes are the CV.
    const outcome = await Promise.race([
      popup.waitForEvent("download", { timeout: 15000 }).then(async (d) => ({ bytes: readFileSync(await d.path()) })),
      popup.waitForURL(/^blob:/, { timeout: 15000 }).then(() => ({ blob: true })).catch(() => new Promise(() => {})),
    ]);
    if (outcome.bytes) assert.deepEqual(outcome.bytes, CV("CV-MARKER-1"));
    else assert.equal(outcome.blob, true);
    await popup.close().catch(() => {});
    assert.equal((await fetch(`${BASE}/api/applications/${zoeId}/resume/`)).status, 401);
  });

  await step("changing the status with a note writes who/when/note to the history; the same status is not offered; moving back works", async () => {
    await page.getByRole("button", { name: "Change status" }).click();
    let dialog = page.getByRole("dialog");
    assert.equal(await dialog.getByRole("option", { name: "Applied" }).count(), 0, "the current status is not offered");
    await dialog.getByLabel("New status").selectOption("shortlisted");
    await dialog.getByLabel(/^Note/).fill("Strong portfolio, call her");
    await dialog.getByRole("button", { name: "Update status" }).click();
    await page.getByText("Strong portfolio, call her").first().waitFor();
    await page.getByText("Applied → Shortlisted").waitFor();
    await page.getByText("Owner a", { exact: false }).first().waitFor();
    // reject, then move back
    await page.getByRole("button", { name: "Reject" }).click();
    dialog = page.getByRole("dialog");
    assert.equal(await dialog.getByLabel("New status").inputValue(), "rejected");
    await dialog.getByRole("button", { name: "Update status" }).click();
    await page.getByText("Shortlisted → Rejected").waitFor();
    await page.getByRole("button", { name: "Change status" }).click();
    await page.getByRole("dialog").getByLabel("New status").selectOption("under_review");
    await page.getByRole("dialog").getByRole("button", { name: "Update status" }).click();
    await page.getByText("Rejected → Under review").waitFor();
    const detail = (await api(`/applications/${zoeId}/`, { token: company.token })).data;
    assert.deepEqual(detail.status_history.map((h) => h.to_status), ["submitted", "shortlisted", "rejected", "under_review"]);
    assert.equal(detail.status_history[1].note, "Strong portfolio, call her");
  });

  await step("a note is saved for the team, newest first, without touching the status", async () => {
    await page.getByLabel("Add a note").fill("First call on Monday");
    await page.getByRole("button", { name: /save note/i }).click();
    const saved = (text) => page.locator("li p.whitespace-pre-line", { hasText: text }).waitFor();
    await saved("First call on Monday");
    await page.getByLabel("Add a note").fill("Second call booked");
    await page.getByRole("button", { name: /save note/i }).click();
    await saved("Second call booked");
    await page.reload();
    await saved("Second call booked");
    const notes = await page.locator("li p.whitespace-pre-line").allInnerTexts();
    assert.deepEqual(notes.filter((t) => /call/i.test(t)).slice(0, 2), ["Second call booked", "First call on Monday"]);
    const stored = (await api(`/applications/${zoeId}/notes/`, { token: company.token })).data;
    assert.deepEqual(stored.map((n) => n.text), ["Second call booked", "First call on Monday"]);
    assert.equal((await api(`/applications/${zoeId}/`, { token: company.token })).data.status, "under_review");
  });

  console.log("Bulk, export and counts");

  await step("bulk move: one request each; a forced failure is reported honestly and the rest still move", async () => {
    await page.goto(`${BASE}/company/jobs/${job.id}/candidates`);
    await page.getByRole("radio", { name: /list/i }).click();
    await page.getByRole("tab", { name: /^Applied/ }).click();
    await page.getByText("Person 12").first().waitFor();
    const failId = byName["Person 13"];
    await page.route(`**/api/applications/${failId}/status/`, (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ detail: "boom" }) }));
    const rows = page.locator("table tbody tr");
    for (const n of ["12", "13", "14"]) await rows.filter({ hasText: `Person ${n}` }).getByRole("checkbox").check();
    await page.getByText("3 selected").waitFor();
    await page.getByRole("button", { name: /change status…/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/new status for 3 candidates/i).selectOption("shortlisted");
    await dialog.getByLabel(/^Note/).fill("Bulk review");
    await dialog.getByRole("button", { name: "Update status" }).click();
    await page.getByText("2 moved, 1 not").first().waitFor();
    await page.unroute(`**/api/applications/${failId}/status/`);
    const after = (await api(`/jobs/${job.id}/applications/?page_size=100`, { token: company.token })).data.results;
    const statusOf = (n) => after.find((a) => a.full_name === `Person ${n}`).status;
    assert.deepEqual(["12", "13", "14"].map(statusOf), ["shortlisted", "submitted", "shortlisted"]);
  });

  await step("the board and the server's counts agree after all the changes", async () => {
    await page.reload();
    const counts = (await api(`/jobs/${job.id}/applications/?page_size=1`, { token: company.token })).data.status_counts;
    assert.equal(counts.total, 27);
    const names = { submitted: "Applied", under_review: "Under review", shortlisted: "Shortlisted", interview: "Interview", selected: "Selected", on_hold: "On hold", rejected: "Rejected" };
    for (const [status, name] of Object.entries(names)) {
      await page.getByRole("region", { name }).getByText(String(counts[status]), { exact: true }).first().waitFor();
    }
  });

  await step("the CSV export is the server's file: BOM, a column per question, every application, formula-like text defused", async () => {
    await page.goto(`${BASE}/company/jobs/${job.id}/candidates`);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /export csv/i }).click()]);
    assert.match(download.suggestedFilename(), /^applications-.*\.csv$/);
    const text = readFileSync(await download.path(), "utf8");
    assert.equal(text.charCodeAt(0), 0xfeff, "BOM for Excel");
    const lines = text.slice(1).trim().split(/\r?\n/);
    for (const label of ["LinkedIn profile", "Notice period", "Your tools", "Why this role?", "Portfolio"]) assert(lines[0].includes(label), `column ${label}`);
    assert.equal(lines.filter((l) => /Person \d\d|Zoë/.test(l)).length >= 27, true);
    assert(text.includes("'=HYPERLINK"), "the formula-like institution is prefixed");
  });

  await step("the sidebar badge, the dashboard and the role's counts say the same thing, and a new application shows up on refresh", async () => {
    await page.goto(`${BASE}/company/dashboard`);
    const submitted = (await api(`/jobs/${job.id}/applications/?page_size=1`, { token: company.token })).data.status_counts.submitted;
    await page.getByRole("link", { name: /candidates/i }).first().waitFor();
    await page.getByText(String(submitted), { exact: true }).first().waitFor();
    await applyPublic(job.slug, base(28), { resume: { name: "cv-28.pdf", type: "application/pdf", bytes: CV("CV-MARKER-28") } });
    await page.goto(`${BASE}/company/candidates`);
    await page.getByText(`28 applications · ${submitted + 1} awaiting first review`).waitFor();
  });

  await step("a recent application on the dashboard opens that candidate", async () => {
    await page.goto(`${BASE}/company/dashboard`);
    await page.getByRole("link", { name: /Person 28/ }).first().click();
    await page.waitForURL(/\/company\/candidates\/[0-9a-f-]{36}/);
    await page.getByRole("heading", { name: /Person 28/ }).waitFor();
  });

  await step("analytics shows the real pipeline and applications per role", async () => {
    await page.goto(`${BASE}/company/analytics`);
    await page.getByText("28 applications across 1 roles", { exact: false }).waitFor();
    await page.getByRole("link", { name: new RegExp(title) }).waitFor();
  });

  console.log("Roles and isolation");

  await step("a viewer reads everything but has no controls; the server refuses them too", async () => {
    const p = await ctx();
    watch(p);
    await logIn(p, viewer, PASSWORD);
    await p.waitForURL(/\/company\/dashboard/);
    await p.goto(`${BASE}/company/candidates/${zoeId}`);
    await p.getByRole("heading", { name: /Zoë Åström/ }).waitFor();
    await p.getByText("Second call booked").waitFor();
    for (const name of ["Change status", "Reject"]) assert.equal(await p.getByRole("button", { name }).count(), 0, name);
    assert.equal(await p.getByLabel("Add a note").count(), 0);
    await p.goto(`${BASE}/company/jobs/${job.id}/candidates`);
    await p.getByRole("radio", { name: /list/i }).click();
    await p.getByText("Person 12").first().waitFor();
    assert.equal(await p.getByRole("checkbox").count(), 0);
    const token = await login(viewer);
    assert.equal((await api(`/applications/${zoeId}/status/`, { method: "PATCH", token, body: { status: "rejected" } })).status, 403);
    assert.equal((await api(`/applications/${zoeId}/notes/`, { method: "POST", token, body: { text: "nope" } })).status, 403);
    await p.close();
  });

  await step("a recruiter and an HR manager can change status and write notes", async () => {
    for (const [email, status] of [[recruiter, "on_hold"], [hr, "interview"]]) {
      const token = await login(email);
      assert.equal((await api(`/applications/${zoeId}/notes/`, { method: "POST", token, body: { text: `note by ${email}` } })).status, 201);
      assert.equal((await api(`/applications/${zoeId}/status/`, { method: "PATCH", token, body: { status } })).status, 200);
      assert.equal((await api(`/applications/${zoeId}/status/`, { method: "PATCH", token, body: { status } })).status, 400, "the same status is refused");
    }
  });

  await step("another company's candidate and role are simply not found (no leak)", async () => {
    const p = await ctx();
    watch(p);
    await logIn(p, other.owner, PASSWORD);
    await p.waitForURL(/\/company\/dashboard/);
    await p.goto(`${BASE}/company/candidates/${zoeId}`);
    await p.getByText("Candidate not found").waitFor();
    await p.goto(`${BASE}/company/jobs/${job.id}/candidates`);
    await p.getByText("Role not found").waitFor();
    await p.goto(`${BASE}/company/candidates`);
    await p.getByText("No applicants yet").waitFor();
    assert.equal((await api(`/applications/${zoeId}/`, { token: other.token })).status, 404);
    assert.equal((await api(`/applications/${zoeId}/notes/`, { token: other.token })).status, 404);
    await p.close();
  });

  await step("a deactivated member's open session is refused with the blocked screen", async () => {
    const p = await ctx();
    watch(p);
    await logIn(p, recruiter, PASSWORD);
    await p.waitForURL(/\/company\/dashboard/);
    const members = (await api("/company/members/", { token: company.token })).data;
    const id = members.find((m) => m.email === recruiter).id;
    assert.equal((await api(`/company/members/${id}/`, { method: "PATCH", token: company.token, body: { is_active: false } })).status, 200);
    await p.goto(`${BASE}/company/candidates`);
    await p.getByText("You no longer have access").waitFor();
    await api(`/company/members/${id}/`, { method: "PATCH", token: company.token, body: { is_active: true } });
    await p.close();
  });

  await step("a suspended company sees the blocked screen on the candidate pages", async () => {
    assert.equal((await api(`/platform-admin/companies/${company.companyId}/suspend/`, { method: "POST", token: company.platform, body: { reason: "Suspended for the e2e run" } })).status, 200);
    await page.goto(`${BASE}/company/candidates`);
    await page.getByText("Your company is suspended").waitFor();
    await page.goto(`${BASE}/company/candidates/${zoeId}`);
    await page.getByText("Your company is suspended").waitFor();
    assert.equal((await api(`/platform-admin/companies/${company.companyId}/reactivate/`, { method: "POST", token: company.platform })).status, 200);
    await page.getByRole("button", { name: /check again/i }).click();
    await page.goto(`${BASE}/company/candidates`);
    await page.getByText(/28 applications/).waitFor();
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
