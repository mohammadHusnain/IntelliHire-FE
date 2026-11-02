# Module 2 — Company management and platform-admin approval

Django app label `companies` · Doc §2 · API under `/api/company/`, `/api/platform-admin/companies/`, `/api/public/invitations/` and `/api/auth/register/company/…`.

| Area | Where |
|---|---|
| Models: `Company`, `CompanyMember`, `StaffInvitation` | `models.py`, `migrations/` (0001, 0002 `suspension_reason`) |
| Business rules (no HTTP) | `services/` — `registration`, `review`, `profile`, `members`, `invitations`, `dashboard` |
| Validation and response shapes | `serializers/` (one file per area) |
| Thin views (permission → serializer → service → response) | `views/` |
| URL tables | `urls.py` (company side), `platform_urls.py` (review), `public_urls.py` (invitations), `auth_urls.py` (sign-up, resubmit) |
| Emails (§2.5) | `emails.py` |
| Tests (207) | `tests/` — review, profile, members, invitations, resubmission, dashboard, isolation, concurrency |

Rules worth knowing
- Every `/api/company/` endpoint requires an active member of an **approved** company (`IsCompanyUser`); only the member role `admin` may edit the profile, members and invitations.
- Invitation tokens are random; only their SHA-256 hash is stored.
- The dashboard's jobs/applications blocks are zeros until Modules 3–4.

Contracts: `documentation/API_CONTRACTS.md` (Module 2). Decisions: D-038–D-047.

Run only this module's tests: `python -m pytest apps/Module2_CompanyManagement`
