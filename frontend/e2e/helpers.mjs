// Shared by the end-to-end scripts: reading mailed links from the backend's console e-mail output,
// calling the API, and the small bits of UI every flow repeats.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

export const { chromium } = createRequire(import.meta.url)("playwright");

export const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";
export const LOG = process.env.E2E_BACKEND_LOG;
export const ADMIN = { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD };
export const PASSWORD = "Sunny-Day-4711";

/** Newest mail for `to` that carries a `/<kind>?...` link, read from the backend console output. */
export async function mailedLink(kind, to) {
  for (let i = 0; i < 40; i += 1) {
    const mails = readFileSync(LOG, "utf8").split(/^-{20,}$/m).filter((m) => m.includes(`To: ${to}`));
    const pattern = new RegExp(`https?://[^\\s"<]+/${kind}\\?[^\\s"<]+`);
    for (const mail of mails.reverse()) {
      const match = mail.match(pattern);
      if (match) return match[0].replace(/^https?:\/\/[^/]+/, BASE);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No ${kind} e-mail for ${to}`);
}

export async function api(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json().catch(() => null) };
}

export async function logIn(page, email, password) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
}

export async function logOut(page) {
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByText("Log out").first().click();
  await page.waitForURL((url) => !/^\/(company|admin|candidate)/.test(url.pathname));
}

/** A tiny but valid PNG. */
export const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

/** A tiny but real PDF (the backend reads its text). */
export const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 44>>stream\nBT /F1 12 Tf 20 100 Td (Python Django) Tj ET\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);

const pad = (n) => String(n).padStart(2, "0");
/** A value for <input type="datetime-local"> `days` from now, in the browser's (here: this machine's) time zone. */
export function localInput(days) {
  const d = new Date(Date.now() + days * 86400000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const tokenOf = (link) => new URL(link).searchParams.get("token");

/** Register a company through the API, verify it, have the platform admin approve it; returns { owner, token }. */
export async function createApprovedCompany(tag, run, password = PASSWORD) {
  const owner = `e2e3-${tag}-${run}@example.test`;
  const name = `Jobs ${tag} ${run}`;
  const reg = await api("/auth/register/company/", { method: "POST", body: { company_name: name, industry: "Technology", official_email: owner, admin_full_name: `Owner ${tag}`, admin_phone: "+92 300 5550000", password, confirm_password: password } });
  if (reg.status !== 201) throw new Error(`register ${reg.status}`);
  await api("/auth/verify-email/", { method: "POST", body: { token: tokenOf(await mailedLink("verify-email", owner)) } });
  const platform = (await api("/auth/login/", { method: "POST", body: { email: ADMIN.email, password: ADMIN.password } })).data;
  const found = await api(`/platform-admin/companies/?search=${encodeURIComponent(name)}`, { token: platform.access });
  await api(`/platform-admin/companies/${found.data.results[0].id}/approve/`, { method: "POST", token: platform.access });
  const session = (await api("/auth/login/", { method: "POST", body: { email: owner, password } })).data;
  return { owner, name, token: session.access, companyId: found.data.results[0].id, platform: platform.access };
}

/** Invite a member with `role`, accept the invitation through the API, return their e-mail. */
export async function addMember(adminToken, email, role, password = PASSWORD) {
  const invite = await api("/company/invitations/", { method: "POST", token: adminToken, body: { email, full_name: `Member ${role}`, role } });
  if (invite.status !== 201) throw new Error(`invite ${invite.status}`);
  const accepted = await api(`/public/invitations/${tokenOf(await mailedLink("accept-invite", email))}/accept/`, { method: "POST", body: { full_name: `Member ${role}`, password, confirm_password: password } });
  if (accepted.status !== 201) throw new Error(`accept ${accepted.status}`);
  return email;
}

/** Create and publish a job through the API (deadline `days` ahead), with custom fields; returns { id, slug }. */
export async function createPublishedJob(token, { title, department = "Engineering", fields = [], days = 30 }) {
  const created = await api("/jobs/", {
    method: "POST",
    token,
    body: { title, department, description: "Build things.", required_skills: ["Python"], employment_type: "full_time", work_mode: "remote", deadline: new Date(Date.now() + days * 86400000).toISOString() },
  });
  if (created.status !== 201) throw new Error(`job ${created.status} ${JSON.stringify(created.data)}`);
  for (const field of fields) {
    const r = await api(`/jobs/${created.data.id}/fields/`, { method: "POST", token, body: field });
    if (r.status !== 201) throw new Error(`field ${r.status} ${JSON.stringify(r.data)}`);
  }
  const published = await api(`/jobs/${created.data.id}/publish/`, { method: "POST", token });
  if (published.status !== 200) throw new Error(`publish ${published.status} ${JSON.stringify(published.data)}`);
  return { id: created.data.id, slug: published.data.form_slug };
}

/** Submit an application through the real public API (multipart). `files` maps a field key to { name, type, bytes }. */
export async function applyPublic(slug, fields, files = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) for (const v of value) form.append(key, v);
    else form.append(key, value);
  }
  for (const [key, file] of Object.entries(files)) form.append(key, new Blob([file.bytes], { type: file.type }), file.name);
  const response = await fetch(`${BASE}/api/public/jobs/${slug}/apply/`, { method: "POST", body: form });
  const data = await response.json().catch(() => null);
  if (response.status !== 201) throw new Error(`apply ${response.status} ${JSON.stringify(data)}`);
  return data.reference;
}
