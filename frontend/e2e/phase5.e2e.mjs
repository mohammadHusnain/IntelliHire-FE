// Phase 5 / Module 1 end-to-end run: the real React app (Vite dev server) against the real Django API.
//
//   E2E_BACKEND_LOG=/path/to/backend-console.log node e2e/phase5.e2e.mjs
//
// Needs: backend on :8000 with the console e-mail backend (its output file is E2E_BACKEND_LOG), a platform admin
// (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD), and `npm run dev` on E2E_BASE_URL with VITE_USE_MOCK_API=false.
// Every account it creates uses a unique e-mail; clean-up is done by the caller (the run prints the e-mails).
import { createRequire } from "node:module";
import { readFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";

const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";
const LOG = process.env.E2E_BACKEND_LOG;
const ADMIN = { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD };
const SHOTS = process.env.E2E_SHOTS || "e2e-failures";
const run = Date.now().toString(36);
const email = (tag) => `e2e-${tag}-${run}@example.test`;
const PASSWORD = "Sunny-Day-4711";
const NEW_PASSWORD = "Fresh-Start-9082";
const RESET_PASSWORD = "Reset-Me-Again-5530";
// A tiny but real PDF (the backend reads its text).
const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 44>>stream\nBT /F1 12 Tf 20 100 Td (Python Django) Tj ET\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);

const results = [];
const created = [];
let page;

async function step(name, fn) {
  const started = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - started });
    console.log(`  ok   ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error: error.message.split("\n")[0] });
    console.log(`  FAIL ${name}\n       ${error.message.split("\n")[0]}`);
    mkdirSync(SHOTS, { recursive: true });
    await page?.screenshot({ path: `${SHOTS}/${name.replace(/\W+/g, "-")}.png`, fullPage: true }).catch(() => {});
    throw error;
  }
}

/** Newest link of `kind` mailed to `to`, read from the backend's console e-mail output. */
async function mailedLink(kind, to) {
  for (let i = 0; i < 40; i += 1) {
    const text = readFileSync(LOG, "utf8");
    const at = text.lastIndexOf(`To: ${to}`);
    if (at >= 0) {
      const match = text.slice(at).match(new RegExp(`https?://[^\\s"<]+/${kind}\\?[^\\s"<]+`));
      if (match) return match[0];
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No ${kind} e-mail for ${to}`);
}

async function api(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json().catch(() => null) };
}

const expectNoPrivateData = async () => {
  const keys = await page.evaluate(() => Object.keys(localStorage));
  assert.deepEqual(keys.filter((k) => k !== "intellihire_session" && /user|token|password/i.test(k)), [], "unexpected keys in storage");
};

async function logIn(address, password) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(address);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
}

async function main() {
  assert(LOG, "Set E2E_BACKEND_LOG to the backend console output file");
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

  const candidate = email("cand");
  created.push(candidate);

  console.log("Candidate");

  await step("sign-up wizard: 4 steps, CV attached", async () => {
    await page.goto(`${BASE}/register`);
    await page.getByRole("radio", { name: /practise interviews/i }).click();
    await page.getByLabel("Full name").fill("Sara E2E");
    await page.getByLabel("Email").fill(candidate);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Confirm password").fill(PASSWORD);
    await page.getByRole("button", { name: /continue/i }).click();
    await page.getByRole("button", { name: /search or select a role/i }).click();
    await page.getByRole("option").first().click();
    await page.getByRole("button", { name: /^\+ / }).first().click();
    await page.getByRole("button", { name: /continue/i }).click();
    await page.getByLabel("LinkedIn profile").fill("https://linkedin.com/in/sara-e2e");
    await page.getByLabel("GitHub profile").fill("https://github.com/sara-e2e");
    await page.locator('input[type="file"]').setInputFiles({ name: "sara-cv.pdf", mimeType: "application/pdf", buffer: PDF });
    await page.getByRole("button", { name: /continue/i }).click();
    await page.getByRole("button", { name: /create account/i }).click();
    await page.waitForURL(/\/login/);
  });

  await step("duplicate e-mail is reported on the e-mail field", async () => {
    await page.goto(`${BASE}/register`);
    await page.getByRole("radio", { name: /practise interviews/i }).click();
    await page.getByLabel("Full name").fill("Sara Again");
    await page.getByLabel("Email").fill(candidate);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Confirm password").fill(PASSWORD);
    await page.getByRole("button", { name: /continue/i }).click();
    await page.getByRole("button", { name: /search or select a role/i }).click();
    await page.getByRole("option").first().click();
    await page.getByRole("button", { name: /^\+ / }).first().click();
    await page.getByRole("button", { name: /continue/i }).click();
    await page.getByLabel("LinkedIn profile").fill("https://linkedin.com/in/x");
    await page.getByLabel("GitHub profile").fill("https://github.com/x");
    await page.locator('input[type="file"]').setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: PDF });
    await page.getByRole("button", { name: /continue/i }).click();
    await page.getByRole("button", { name: /create account/i }).click();
    await page.getByText(/already exists|already registered|already in use/i).first().waitFor();
    assert.equal(await page.getByLabel("Email").inputValue(), candidate, "wizard returns to step 1 with the value kept");
  });

  await step("log in before verifying shows the verify message and a resend button", async () => {
    await logIn(candidate, PASSWORD);
    await page.getByRole("alert").filter({ hasText: /verify/i }).waitFor();
    await page.getByRole("button", { name: /resend/i }).click();
    await page.getByText(/sent|check your inbox|on its way/i).first().waitFor();
  });

  await step("verification link verifies once and removes the token from the URL", async () => {
    const link = await mailedLink("verify-email", candidate);
    await page.goto(link.replace(/^https?:\/\/[^/]+/, BASE));
    await page.getByRole("heading", { name: "Email verified" }).waitFor();
    assert(!page.url().includes("token="), "token left in the address bar");
  });

  await step("log in lands on the candidate dashboard; storage holds tokens only", async () => {
    await logIn(candidate, PASSWORD);
    await page.waitForURL(/\/candidate\/dashboard/);
    await expectNoPrivateData();
  });

  await step("profile loads the answers given at sign-up", async () => {
    await page.goto(`${BASE}/candidate/profile`);
    await page.getByLabel("Full name").waitFor();
    assert.equal(await page.getByLabel("LinkedIn").inputValue(), "https://linkedin.com/in/sara-e2e");
    assert.equal(await page.getByLabel("GitHub").inputValue(), "https://github.com/sara-e2e");
    await page.getByText("sara-cv.pdf").first().waitFor();
  });

  await step("editing and saving persists across a reload", async () => {
    await page.getByLabel("Headline").fill("Backend engineer");
    await page.getByLabel("Phone").fill("+92 300 1234567");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.getByText("Profile saved").first().waitFor();
    await page.reload();
    await page.getByLabel("Full name").waitFor();
    assert.equal(await page.getByLabel("Headline").inputValue(), "Backend engineer");
    assert.equal(await page.getByLabel("Phone").inputValue(), "+92 300 1234567");
  });

  await step("a bad phone number is rejected by the server and shown on the field", async () => {
    await page.getByLabel("Phone").fill("not a phone");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.getByText("Profile not saved").first().waitFor();
    assert.equal(await page.getByLabel("Phone").inputValue(), "not a phone");
    await page.reload();
    await page.getByLabel("Full name").waitFor();
    assert.equal(await page.getByLabel("Phone").inputValue(), "+92 300 1234567", "nothing wrong was stored");
  });

  await step("education and experience can be added", async () => {
    // The skills box has its own (hidden while empty) "Add" button, so scope to the card by its heading.
    const card = (title) => page.locator("div").filter({ has: page.getByRole("heading", { name: title, exact: true }) }).filter({ has: page.getByRole("button", { name: "Add", exact: true }) }).last();
    await card("Education").getByRole("button", { name: "Add", exact: true }).click();
    await page.getByLabel("Institution").fill("NUST");
    await page.getByLabel("Degree").fill("BSc Computer Science");
    await page.getByLabel("Field of study").fill("Computer Science");
    await page.getByLabel("Start year").fill("2019");
    await page.getByLabel("End year (leave empty if ongoing)").fill("2023");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByText("NUST").first().waitFor();
    await card("Experience").getByRole("button", { name: "Add", exact: true }).click();
    await page.getByLabel("Company").fill("Acme");
    await page.getByLabel("Position").fill("Engineer");
    await page.getByLabel("Start date").fill("2023-06-01");
    await page.getByLabel("End date").fill("2024-06-01");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByText("Acme").first().waitFor();
    await page.reload();
    await page.getByText("NUST").first().waitFor();
    await page.getByText("Acme").first().waitFor();
  });

  await step("a replaced CV downloads byte-for-byte", async () => {
    const replacement = Buffer.concat([PDF, Buffer.from("\n% replacement marker\n")]);
    await page.locator('input[type="file"][accept*="pdf"]').setInputFiles({ name: "new-cv.pdf", mimeType: "application/pdf", buffer: replacement });
    await page.getByText("CV uploaded").first().waitFor();
    await page.getByText("new-cv.pdf").first().waitFor();
    const bytes = await page.evaluate(async () => {
      const { access } = JSON.parse(localStorage.getItem("intellihire_session"));
      const response = await fetch("/api/auth/profile/resume/", { headers: { authorization: `Bearer ${access}` } });
      return { status: response.status, data: Array.from(new Uint8Array(await response.arrayBuffer())) };
    });
    assert.equal(bytes.status, 200);
    assert.deepEqual(Buffer.from(bytes.data), replacement);
  });

  await step("a CV that is not a PDF/DOCX is refused before upload", async () => {
    const before = await page.evaluate(() => performance.getEntriesByType("resource").length);
    await page.locator('input[type="file"][accept*="pdf"]').setInputFiles({ name: "cv.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
    await page.getByText("Unsupported file").first().waitFor();
    void before;
  });

  await step("the resume cannot be downloaded without signing in", async () => {
    const response = await fetch(`${BASE}/api/auth/profile/resume/`);
    assert.equal(response.status, 401);
  });

  await step("change password signs everyone out; the old password stops working, the new one works", async () => {
    await page.goto(`${BASE}/candidate/settings`);
    await page.getByRole("button", { name: /security/i }).first().click();
    await page.getByLabel("Current password").fill("wrong-password-1");
    await page.getByLabel("New password", { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel("Confirm new password").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: /update password/i }).click();
    await page.getByText(/incorrect|wrong|invalid/i).first().waitFor();
    assert.match(page.url(), /settings/, "a wrong current password keeps the session");
    await page.getByLabel("Current password").fill(PASSWORD);
    await page.getByRole("button", { name: /update password/i }).click();
    await page.waitForURL(/\/login/);
    await logIn(candidate, PASSWORD);
    await page.getByRole("alert").waitFor();
    await logIn(candidate, NEW_PASSWORD);
    await page.waitForURL(/\/candidate\/dashboard/);
  });

  await step("logout, then Back, shows no private page", async () => {
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: /log out/i }).or(page.getByText("Log out")).first().click();
    await page.waitForURL((url) => !url.pathname.startsWith("/candidate"));
    await page.goBack();
    await page.waitForURL(/\/login|\/$/, { timeout: 10000 }).catch(() => {});
    assert(!/\/candidate\//.test(new URL(page.url()).pathname), `Back reopened ${page.url()}`);
    assert.equal(await page.evaluate(() => localStorage.getItem("intellihire_session")), null);
  });

  await step("forgot password: reset link works once, then every old session is dead", async () => {
    await page.goto(`${BASE}/login`);
    await page.getByRole("button", { name: /forgot password/i }).click();
    await page.getByRole("dialog").getByLabel("Email").fill(candidate);
    await page.getByRole("dialog").getByRole("button", { name: /send/i }).click();
    const link = (await mailedLink("reset-password", candidate)).replace(/^https?:\/\/[^/]+/, BASE);
    await page.goto(link);
    await page.getByLabel("New password", { exact: true }).fill(RESET_PASSWORD);
    await page.getByLabel("Confirm new password").fill(RESET_PASSWORD);
    await page.getByRole("button", { name: /update password/i }).click();
    await page.waitForURL(/\/login/);
    await page.goto(link);
    await page.getByLabel("New password", { exact: true }).fill("Another-Pass-7741");
    await page.getByLabel("Confirm new password").fill("Another-Pass-7741");
    await page.getByRole("button", { name: /update password/i }).click();
    await page.getByRole("alert").waitFor();
    await logIn(candidate, RESET_PASSWORD);
    await page.waitForURL(/\/candidate\/dashboard/);
  });

  await step("a platform admin suspends the account: the open session is refused and signed out", async () => {
    const admin = await api("/auth/login/", { method: "POST", body: ADMIN });
    assert.equal(admin.status, 200);
    const list = await api(`/platform-admin/users/?search=${encodeURIComponent(candidate)}`, { token: admin.data.access });
    const id = list.data.results.find((u) => u.email === candidate).id;
    const suspend = await api(`/platform-admin/users/${id}/suspend/`, { method: "POST", token: admin.data.access });
    assert.equal(suspend.status, 200);
    await page.goto(`${BASE}/candidate/profile`);
    await page.waitForURL(/\/login/);
    await page.getByText(/suspended/i).first().waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem("intellihire_session")), null);
    await logIn(candidate, RESET_PASSWORD);
    await page.getByRole("alert").filter({ hasText: /suspended/i }).waitFor();
    await api(`/platform-admin/users/${id}/reactivate/`, { method: "POST", token: admin.data.access });
    await logIn(candidate, RESET_PASSWORD);
    await page.waitForURL(/\/candidate\/dashboard/);
  });

  await step("a candidate cannot open the admin area", async () => {
    await page.goto(`${BASE}/admin/users`);
    await page.waitForURL(/\/candidate\/dashboard/);
  });

  console.log("Company");
  const company = email("co");
  created.push(company);

  await step("company sign-up (with the admin phone) and the verify-then-approval path", async () => {
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${BASE}/register`);
    await page.getByRole("radio", { name: /hire talent/i }).click();
    await page.getByLabel("Full name").fill("Ali E2E");
    await page.getByLabel("Work email").fill(company);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Confirm password").fill(PASSWORD);
    await page.getByRole("button", { name: /continue/i }).click();
    await page.getByLabel("Company name").fill(`Acme ${run}`);
    await page.getByLabel("Industry").selectOption({ index: 1 });
    await page.getByLabel("Your phone number").fill("+92 300 7654321");
    await page.getByRole("button", { name: /create account|continue/i }).click();
    await page.waitForURL(/\/login/);
    const link = (await mailedLink("verify-email", company)).replace(/^https?:\/\/[^/]+/, BASE);
    await page.goto(link);
    await page.getByRole("heading", { name: "Email verified" }).waitFor();
    await page.getByText(/waiting for administrator approval/i).waitFor();
    await logIn(company, PASSWORD);
    await page.getByRole("alert").filter({ hasText: /approval|approved/i }).waitFor();
  });

  await step("an invalid verification link offers a resend", async () => {
    await page.goto(`${BASE}/verify-email?token=garbage`);
    await page.getByRole("heading", { name: /isn't valid|expired/i }).waitFor();
    await page.getByRole("button", { name: /resend/i }).waitFor();
  });

  await step("no console errors during the whole run", async () => {
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
console.log(`Accounts created: ${created.join(", ")}`);
process.exit(failed ? 1 : 0);
