// Every screen of every role, opened in the real (non-demo) build: no crash, no blank page, no console error.
// Needs the backend (console e-mail), a platform admin and `npm run dev` with VITE_USE_MOCK_API=false.
import { BASE, LOG, PASSWORD, api, chromium, logIn, mailedLink } from "./helpers.mjs";
const run = Date.now().toString(36);
const tok = (l) => new URL(l).searchParams.get("token");
const cand = `smoke-c-${run}@example.test`, comp = `smoke-o-${run}@example.test`;
await api("/auth/register/candidate/", { method: "POST", body: { full_name: "Smoke C", email: cand, password: PASSWORD, confirm_password: PASSWORD } });
await api("/auth/verify-email/", { method: "POST", body: { token: tok(await mailedLink("verify-email", cand)) } });
await api("/auth/register/company/", { method: "POST", body: { company_name: `Smoke ${run}`, industry: "Retail", official_email: comp, admin_full_name: "Smoke O", admin_phone: "+92 300 5551111", password: PASSWORD, confirm_password: PASSWORD } });
await api("/auth/verify-email/", { method: "POST", body: { token: tok(await mailedLink("verify-email", comp)) } });
const admin = (await api("/auth/login/", { method: "POST", body: { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD } })).data;
const found = await api(`/platform-admin/companies/?search=Smoke%20${run}`, { token: admin.access });
await api(`/platform-admin/companies/${found.data.results[0].id}/approve/`, { method: "POST", token: admin.access });

const routes = {
  [cand]: ["/candidate/dashboard", "/candidate/profile", "/candidate/reports", "/candidate/interview/setup", "/candidate/communities", "/candidate/settings"],
  [comp]: ["/company/dashboard", "/company/onboarding", "/company/team", "/company/jobs", "/company/jobs/create", "/company/candidates", "/company/analytics", "/company/community", "/company/settings"],
  [process.env.E2E_ADMIN_EMAIL]: ["/admin/dashboard", "/admin/users", "/admin/companies", "/admin/communities", "/admin/reports", "/admin/settings", "/admin/management"],
};
const b = await chromium.launch();
let bad = 0;
for (const [email, paths] of Object.entries(routes)) {
  const p = await (await b.newContext()).newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errs.push(m.text()));
  await logIn(p, email, email === process.env.E2E_ADMIN_EMAIL ? process.env.E2E_ADMIN_PASSWORD : PASSWORD);
  await p.waitForURL(/dashboard/);
  for (const path of paths) {
    errs.length = 0;
    await p.goto(`${BASE}${path}`);
    await p.waitForLoadState("networkidle");
    await p.waitForTimeout(400);
    const crashed = (await p.locator("text=/something went wrong|unexpected application error/i").count()) > 0;
    const blank = (await p.locator("body").innerText()).trim().length < 20;
    const ok = !errs.length && !crashed && !blank;
    if (!ok) bad += 1;
    console.log(ok ? "  ok  " : "  FAIL", email.split("@")[0].slice(0, 12), path, errs.slice(0, 1).join(" | "), crashed ? "[crash]" : "", blank ? "[blank]" : "");
  }
}
await b.close();
process.exit(bad ? 1 : 0);
