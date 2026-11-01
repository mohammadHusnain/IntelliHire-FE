# Project Context

IntelliHire is a final-year-project recruitment platform with three portals (candidate, company, platform admin). This folder is the persistent project memory for backend development. In a new session, read the files in this order: `PROJECT_CONTEXT.md` → `DEVELOPMENT_PROGRESS.md` → `DECISIONS.md` → `UNRESOLVED_QUESTIONS.md` → the module-relevant parts of `REQUIREMENTS.md`, `DATABASE_SCHEMA.md`, `API_CONTRACTS.md`. Then verify the repository state with `git status` and `git log`; do not assume work exists that the repository does not show.

## Sources and authority

| Rank | Source | Governs |
|---|---|---|
| 1 | `source/IntelliHire_Django_Backend_Implementation_Guide_Phase_1.docx` (the "Doc") | Backend functional requirements and business rules for Phase 1 |
| 2 | `frontend/` (React 19 + Vite + Zustand) | Existing UI workflows, fields and integration needs |
| 3 | Explicit instructions from the project owner | Approved changes and clarifications (recorded in `DECISIONS.md`) |
| 4 | Engineering judgement | Implementation detail that conflicts with none of the above |

Conflicts between sources are never resolved silently: they are listed in `UNRESOLVED_QUESTIONS.md` with impact, and decided by the owner.

## Scope

**Phase 1 (this backend):** four modules built in order — (1) authentication and accounts, (2) company management with platform-admin approval, (3) job posting and application form, (4) candidate application management — plus the company dashboard aggregate endpoint, built last.

**Out of Phase 1** (Doc, "Out of scope"): mock interview, CV parsing and shortlisting, AI screening and technical interviews, evaluation reports, candidate tracking, communities, and the admin panel beyond company approval. Frontend pages for these remain mock-only.

**Deferred by the owner:** Tally / ERP integration. The Doc contains no Tally content. No Tally code, schema or placeholder exists, and none is to be added until the owner reopens it (see D-001).

## Stack (approved)

Django 5.2 LTS + Django REST Framework, SimpleJWT (with token blacklist), PostgreSQL 16 via psycopg 3, django-cors-headers, django-environ, django-filter, drf-spectacular, Pillow, pytest + pytest-django. File storage: local disk in development; Azure Blob Storage (private container) in production, added with `django-storages` when storage work reaches production. Python 3.13 is what the code has been run on.

## Repository and branches

```
frontend/   React app (not modified during backend work)
backend/    Django project: config/, apps/, documentation/, requirements/, scripts/
```

| Branch | Purpose |
|---|---|
| `main` | Whole-project integration. Never changed without explicit owner approval. |
| `IntelliHire-frontend` | Frontend line |
| `IntelliHire-backend` | **Backend integration branch** |
| `backend/foundation`, `backend/module-01` … `module-04` | Work branches cut from `IntelliHire-backend`; merged back only after tests pass and the owner approves |

## Working rules (from the project instruction)

- One approved step at a time; each module ends with a completion report and waits for approval.
- A module is complete only when implementation, tests (actually run), documentation and API contracts are verified.
- Never modify `frontend/` during backend work. Frontend integration (Phase 5) starts only on explicit authorisation.
- Never invent requirements, scoring weights or Tally behaviour. Never commit secrets or `.env`.
- Every protected endpoint enforces authorisation on the server; client-supplied roles, user IDs and company IDs are never trusted.
