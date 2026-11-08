// Phase 5 / Module 2 end-to-end run: company sign-up, admin approval, company workspace, team invitations,
// suspension, rejection and re-submission — the real React app against the real Django API.
//
//   E2E_BACKEND_LOG=/path/backend.log E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... node e2e/phase5-module2.e2e.mjs
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { ADMIN, BASE, LOG, PASSWORD, PNG, api, chromium, logIn, logOut, mailedLink } from "./helpers.mjs";

const SHOTS = process.env.E2E_SHOTS || "e2e-failures";
const run = Date.now().toString(36);
const email = (tag) => `e2e2-${tag}-${run}@example.test`;
const results = [];
const created = [];
let page;

async function step(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ok   ${name}`);
  } catch (error) {
    results.push({ name, ok: false });
    console.log(`  FAIL ${name}\n       ${error.message.split("\n")[0]}`);
    mkdirSync(SHOTS, { recursive: true });
    await page?.screenshot({ path: `${SHOTS}/${name.replace(/\W+/g, "-")}.png`, fullPage: true }).catch(() => {});
    throw error;
  }
}

async function registerCompany(p, { owner, company, name = "Ali E2E" }) {
  await p.goto(`${BASE}/register`);
  await p.getByRole("radio", { name: /hire talent/i }).click();
  await p.getByLabel("Full name").fill(name);
  await p.getByLabel("Work email").fill(owner);
  await p.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await p.getByLabel("Confirm password").fill(PASSWORD);
  await p.getByRole("button", { name: /continue/i }).click();
  await p.getByLabel("Company name").fill(company);
  await p.getByLabel("Industry").selectOption({ index: 1 });
  await p.getByLabel("Your phone number").fill("+92 300 7654321");
  await p.getByRole("button", { name: /create account|continue/i }).click();
  await p.waitForURL(/\/login/);
}

async function verify(p, to) {
  await p.goto(await mailedLink("verify-email", to));
  await p.getByRole("heading", { name: "Email verified" }).waitFor();
}

/** Fill a reason in the open dialog and confirm. */
async function decide(p, buttonName, confirmName, reason) {
  await p.getByRole("button", { name: buttonName }).first().click();
  const dialog = p.getByRole("dialog");
  if (reason) await dialog.getByRole("textbox").fill(reason);
  await dialog.getByRole("button", { name: confirmName }).click();
  await dialog.waitFor({ state: "detached" });
}

async function adminCompaniesTab(p, tab, company) {
  await p.goto(`${BASE}/admin/companies`);
  await p.getByRole("tab", { name: new RegExp(`^${tab}`, "i") }).click();
  await p.getByPlaceholder(/search company/i).fill(company);
  await p.getByText(company).first().waitFor();
}

async function main() {
  assert(LOG && ADMIN.email && ADMIN.password, "Set E2E_BACKEND_LOG, E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD");
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  page = await ctx.newPage();
  const consoleErrors = [];
  const watch = (p) => {
    p.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && consoleErrors.push(m.text()));
    p.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  };
  watch(page);

  const owner = email("owner");
  const companyName = `Acme ${run}`;
  const hr = email("hr");
  const second = email("admin2");
  created.push(owner, hr, second);

  console.log("Sign-up, approval and workspace");

  await step("company signs up and verifies; log in before approval shows the server's message", async () => {
    await registerCompany(page, { owner, company: companyName });
    await verify(page, owner);
    await page.getByText(/waiting for administrator approval/i).waitFor();
    await logIn(page, owner, PASSWORD);
    await page.getByRole("alert").filter({ hasText: /approval|approved/i }).waitFor();
    assert.equal(await page.getByRole("link", { name: /submit again/i }).count(), 0, "no resubmit link while pending");
  });

  await step("platform admin approves it in the UI (pending tab, search, decision dialog)", async () => {
    await logIn(page, ADMIN.email, ADMIN.password);
    await page.waitForURL(/\/admin\/dashboard/);
    await page.getByText("Not connected yet").first().waitFor();
    await adminCompaniesTab(page, "Pending", companyName);
    await decide(page, /^approve$/i, "Approve company");
    await page.getByText(`${companyName} approved`).first().waitFor();
    await logOut(page);
  });

  await step("company admin logs in to the live dashboard (no demo numbers)", async () => {
    await logIn(page, owner, PASSWORD);
    await page.waitForURL(/\/company\/dashboard/);
    await page.getByText("Nothing closing soon").waitFor();
    assert.equal(await page.getByText(/average cv match/i).count(), 0);
    await page.getByText(/your company profile is \d+% complete/i).waitFor();
  });

  await step("edit the profile and upload a logo; both persist across a reload", async () => {
    await page.goto(`${BASE}/company/settings`);
    await page.getByLabel("Location").fill("Lahore, Pakistan");
    await page.getByLabel("Website").fill("https://acme-e2e.example");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.getByText("Company profile saved").first().waitFor();
    await page.locator('input[type="file"]').setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
    await page.getByText("Logo updated").first().waitFor();
    await page.reload();
    await page.getByLabel("Company name").waitFor();
    assert.equal(await page.getByLabel("Location").inputValue(), "Lahore, Pakistan");
    assert.equal(await page.getByLabel("Website").inputValue(), "https://acme-e2e.example");
    await page.getByAltText("Company logo").waitFor();
  });

  await step("a server field error lands on the field (invalid phone), nothing is stored", async () => {
    await page.getByLabel("Contact phone").fill("not a phone");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.getByText("Enter a valid phone number.").first().waitFor();
    await page.reload();
    await page.getByLabel("Contact phone").waitFor();
    assert.equal(await page.getByLabel("Contact phone").inputValue(), "+92 300 7654321");
  });

  console.log("Team and invitations");

  await step("admin invites an HR manager; invitation list shows it pending", async () => {
    await page.goto(`${BASE}/company/team`);
    await page.getByLabel("Full name").fill("Hana HR");
    await page.getByLabel("Work email").fill(hr);
    await page.getByLabel("Role").selectOption("hr_manager");
    await page.getByRole("button", { name: /send invitation/i }).click();
    await page.getByText("Invitation sent").first().waitFor();
    await page.getByText(hr, { exact: false }).first().waitFor();
  });

  await step("inviting the same email again is refused with the server's message", async () => {
    await page.getByLabel("Full name").fill("Hana Again");
    await page.getByLabel("Work email").fill(hr);
    await page.getByRole("button", { name: /send invitation/i }).click();
    await page.getByLabel("Work email").waitFor();
    await page.locator('[role="alert"]').first().waitFor();
    assert.equal(await page.getByLabel("Work email").inputValue(), hr, "form kept");
  });

  await step("the invitee accepts (token leaves the URL), logs in, and sees the team read-only", async () => {
    const hrPage = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    watch(hrPage);
    await hrPage.goto(await mailedLink("accept-invite", hr));
    await hrPage.getByRole("heading", { name: `Join ${companyName}` }).waitFor();
    assert(!hrPage.url().includes("token="), "token left in the address bar");
    await hrPage.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await hrPage.getByLabel("Confirm password").fill(PASSWORD);
    await hrPage.getByRole("button", { name: /join the team/i }).click();
    await hrPage.waitForURL(/\/login/);
    await hrPage.getByText(/you have joined the team/i).waitFor();
    await logIn(hrPage, hr, PASSWORD);
    await hrPage.waitForURL(/\/company\/dashboard/);
    await hrPage.goto(`${BASE}/company/team`);
    await hrPage.getByText(/only a company admin can invite/i).waitFor();
    assert.equal(await hrPage.getByRole("button", { name: /send invitation/i }).count(), 0);
    await hrPage.goto(`${BASE}/company/settings`);
    await hrPage.getByText(/only a company admin can change/i).waitFor();
    assert.equal(await hrPage.getByLabel("Company name").isDisabled(), true);
    // the API refuses the same actions
    const tokens = JSON.parse(await hrPage.evaluate(() => localStorage.getItem("intellihire_session")));
    assert.equal((await api("/company/invitations/", { token: tokens.access })).status, 403);
    assert.equal((await api("/company/profile/", { method: "PATCH", token: tokens.access, body: { headquarters: "x" } })).status, 403);
    // an used link cannot be used again
    await hrPage.goto(await mailedLink("accept-invite", hr));
    await hrPage.getByRole("alert").waitFor();
    // deactivate (below) needs this page later
    ctx.hr = hrPage;
  });

  await step("admin changes the role, then deactivates the member: their open session is refused", async () => {
    await page.goto(`${BASE}/company/team`);
    await page.getByLabel("Role of Hana HR").waitFor();
    await page.getByLabel("Role of Hana HR").selectOption("viewer");
    await page.getByText("Role updated").first().waitFor();
    await page.getByRole("button", { name: "Deactivate" }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Deactivate" }).click();
    const hana = page.locator("li").filter({ hasText: "Hana HR" });
    await hana.getByText("Deactivated").waitFor();
    await ctx.hr.goto(`${BASE}/company/dashboard`);
    await ctx.hr.getByText("You no longer have access").waitFor();
    await page.getByRole("button", { name: "Reactivate" }).first().click();
    await hana.getByText("Deactivated").waitFor({ state: "detached" });
    await ctx.hr.getByRole("button", { name: /check again/i }).click();
    await ctx.hr.getByText(/closing soon/i).first().waitFor();
  });

  await step("resend and revoke work; a revoked link says so", async () => {
    await page.goto(`${BASE}/company/team`);
    await page.getByLabel("Full name").fill("Rita Recruiter");
    await page.getByLabel("Work email").fill(second);
    await page.getByRole("button", { name: /send invitation/i }).click();
    await page.getByText(second, { exact: false }).first().waitFor();
    const row = page.locator("li").filter({ hasText: second });
    await row.getByRole("button", { name: /resend/i }).click();
    await page.getByText("Invitation sent again").first().waitFor();
    const link = await mailedLink("accept-invite", second);
    await row.getByRole("button", { name: /revoke/i }).click();
    await page.getByText("Invitation revoked").first().waitFor();
    const probe = await (await browser.newContext()).newPage();
    await probe.goto(link);
    await probe.getByRole("alert").filter({ hasText: /revoked|no longer|not valid/i }).waitFor();
    await probe.close();
  });

  await step("a member cannot change their own role over the API (cannot_modify_self)", async () => {
    const tokens = JSON.parse(await page.evaluate(() => localStorage.getItem("intellihire_session")));
    const members = await api("/company/members/", { token: tokens.access });
    const me = members.data.find((m) => m.email === owner);
    const result = await api(`/company/members/${me.id}/`, { method: "PATCH", token: tokens.access, body: { role: "viewer" } });
    assert.equal(result.status, 400);
    assert.equal(result.data.code, "cannot_modify_self");
  });

  console.log("Suspension, rejection and resubmission");

  await step("admin suspends the company (reason required): the company user sees the blocked screen, then reactivation restores it", async () => {
    const adminPage = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    watch(adminPage);
    await logIn(adminPage, ADMIN.email, ADMIN.password);
    await adminPage.waitForURL(/\/admin\/dashboard/);
    await adminCompaniesTab(adminPage, "Active", companyName);
    await adminPage.getByRole("button", { name: /^suspend$/i }).first().click();
    const dialog = adminPage.getByRole("dialog");
    assert.equal(await dialog.getByRole("button", { name: "Suspend company" }).isDisabled(), true, "a short reason is refused locally");
    await dialog.getByRole("textbox").fill("Policy breach during e2e");
    await dialog.getByRole("button", { name: "Suspend company" }).click();
    await adminPage.getByText(`${companyName} suspended`).first().waitFor();

    await page.goto(`${BASE}/company/dashboard`);
    await page.getByText("Your company is suspended").waitFor();
    await adminCompaniesTab(adminPage, "Suspended", companyName);
    await adminPage.getByText(companyName).first().click();
    await adminPage.getByText(/Policy breach during e2e/).first().waitFor();
    await adminPage.keyboard.press("Escape");
    await decide(adminPage, /reactivate/i, "Reactivate");
    await page.getByRole("button", { name: /check again/i }).click();
    await page.waitForURL(/\/company\/dashboard/);
    await page.getByText(/closing soon/i).first().waitFor();
    ctx.adminPage = adminPage;
  });

  const rejected = email("rej");
  const rejectedCompany = `Rejected Co ${run}`;
  created.push(rejected);

  await step("a second company is rejected with a reason; its login shows the message and the resubmit link", async () => {
    const other = await (await browser.newContext()).newPage();
    watch(other);
    await registerCompany(other, { owner: rejected, company: rejectedCompany, name: "Rey Rejected" });
    await verify(other, rejected);
    await adminCompaniesTab(ctx.adminPage, "Pending", rejectedCompany);
    await decide(ctx.adminPage, /^reject$/i, "Reject company", "Documents do not match the name");
    await ctx.adminPage.getByText(`${rejectedCompany} rejected`).first().waitFor();
    await logIn(other, rejected, PASSWORD);
    await other.getByRole("alert").filter({ hasText: /not approved/i }).waitFor();
    await other.getByRole("link", { name: /submit again/i }).click();
    await other.waitForURL(/\/resubmit-company/);
    ctx.other = other;
  });

  await step("the rejected company corrects its name and goes back to review; admin then approves", async () => {
    const other = ctx.other;
    await other.getByLabel("Official email").fill(rejected);
    await other.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await other.getByLabel("Company name").fill(`${rejectedCompany} Ltd`);
    await other.getByLabel("Industry").selectOption({ index: 2 });
    await other.getByLabel("Your full name").fill("Rey Rejected");
    await other.getByLabel("Your phone number").fill("+92 300 1112223");
    await other.getByRole("button", { name: /submit for review/i }).click();
    await other.waitForURL(/\/login/);
    await other.getByText(/sent for review again/i).waitFor();
    await adminCompaniesTab(ctx.adminPage, "Pending", `${rejectedCompany} Ltd`);
    await decide(ctx.adminPage, /^approve$/i, "Approve company");
    await logIn(other, rejected, PASSWORD);
    await other.waitForURL(/\/company\/dashboard/);
  });

  await step("a wrong password on resubmission is refused with the server's message", async () => {
    const probe = await (await browser.newContext()).newPage();
    await probe.goto(`${BASE}/resubmit-company`);
    await probe.getByLabel("Official email").fill(rejected);
    await probe.getByLabel("Password", { exact: true }).fill("Wrong-Pass-123");
    await probe.getByLabel("Company name").fill("Whatever Ltd");
    await probe.getByLabel("Industry").selectOption({ index: 1 });
    await probe.getByLabel("Your full name").fill("X Y");
    await probe.getByLabel("Your phone number").fill("+92 300 1112223");
    await probe.getByRole("button", { name: /submit for review/i }).click();
    await probe.getByRole("alert").filter({ hasText: /invalid email or password/i }).waitFor();
    await probe.close();
  });

  console.log("Admin list: search and pagination");

  await step("search narrows the list on the server; paging works with more than one page of companies", async () => {
    // 21 more companies through the API so the "All" tab has more than one page (page size 20)
    for (let i = 0; i < 21; i += 1) {
      const r = await api("/auth/register/company/", {
        method: "POST",
        body: { company_name: `Bulk ${run} ${i}`, industry: "Retail", official_email: email(`bulk${i}`), admin_full_name: "Bulk Owner", admin_phone: "+92 300 0000000", password: PASSWORD, confirm_password: PASSWORD },
      });
      assert.equal(r.status, 201);
      created.push(email(`bulk${i}`));
    }
    const p = ctx.adminPage;
    await p.goto(`${BASE}/admin/companies`);
    await p.getByRole("tab", { name: /^all/i }).click();
    await p.getByText(/Page 1 of 2/).waitFor();
    await p.getByRole("button", { name: /next/i }).click();
    await p.getByText(/Page 2 of 2/).waitFor();
    await p.getByPlaceholder(/search company/i).fill(`Bulk ${run} 7`);
    await p.getByText(`Bulk ${run} 7`).first().waitFor();
    await p.getByText(/Page \d of \d/).waitFor({ state: "detached" });
  });

  await step("a company user cannot open the admin area", async () => {
    await page.goto(`${BASE}/admin/companies`);
    await page.waitForURL(/\/company\/dashboard/);
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
console.log(`Accounts created: ${created.length} (e-mails end with -${run}@example.test)`);
process.exit(failed ? 1 : 0);
