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
