# Module 1 — Authentication and account management

Django app label `accounts` · Doc §1 · API under `/api/auth/` and `/api/platform-admin/users/`.

| Area | Where |
|---|---|
| Models: `User`, `CandidateProfile`, `Education`, `Experience` | `models.py`, `managers.py`, `migrations/` |
| Registration, verification, login, password flows, profile | `services.py`, `serializers.py`, `views.py`, `urls.py` |
| Token issue / rotation / revocation | `auth_tokens.py`, `tokens.py`, `authentication.py` (status-aware JWT) |
| CV upload, text extraction | `resume.py`, `validators.py` |
| Platform-admin user suspend / reactivate | `platform_urls.py` |
| Emails | `emails.py` |
| Tests (196) | `tests/` |

Contracts: `documentation/API_CONTRACTS.md` (Module 1). Decisions: D-003, D-021–D-037.

Run only this module's tests: `python -m pytest apps/Module1_Authentication`
