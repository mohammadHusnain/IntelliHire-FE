// Demo credentials. Imported ONLY by the mock login (VITE_USE_MOCK_API=true); a real build never includes this file.
export const SEED_PASSWORDS = {
  "candidate@test.com": "password123",
  "company@test.com": "password123",
  "pending@test.com": "password123",
};

export const ADMIN_CREDENTIALS = { email: "admin@gmail.com", password: "12345678" };

export const ADMIN_USER = {
  id: "usr_admin",
  email: ADMIN_CREDENTIALS.email,
  name: "Super Admin",
  role: "admin",
  status: "active",
};

export const DEMO_ACCOUNTS = [
  { email: "candidate@test.com", password: SEED_PASSWORDS["candidate@test.com"], role: "candidate", name: "Ahmed Hassan" },
  { email: "company@test.com", password: SEED_PASSWORDS["company@test.com"], role: "company", name: "John Smith" },
  { email: ADMIN_CREDENTIALS.email, password: ADMIN_CREDENTIALS.password, role: "admin", name: "Super Admin" },
];
