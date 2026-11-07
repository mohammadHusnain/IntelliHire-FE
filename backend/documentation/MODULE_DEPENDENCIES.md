# Module Dependencies

## Build order (Doc, "Build order and testing")

```
Foundation ─► Module 1 ─► Module 2 ─► Module 3 ─► Module 4 ─► Company dashboard ─► Integration ─► (Phase 5, owner approval)
 accounts      accounts     companies    jobs        applications   (companies app)
 + companies   (auth,        (approval,   (jobs,      (public apply,
 models        profile)      invites)     form)       HR review)
```

| Module | Needs | Provides |
|---|---|---|
| Foundation | — | Project skeleton, shared infrastructure, first migration containing all seven starting models |
| 1 Auth & accounts | Foundation; Module 2's models exist (company sign-up creates `Company`, `CompanyMember`) | Users, tokens, role permission classes, candidate profile |
| 2 Company management | Module 1 (company-admin users) | Approved companies, members, invitations, platform-admin review |
| 3 Jobs | Module 2 (jobs belong to an **approved** company) | `JobPosting`, `ApplicationField`, public form schema |
| 4 Applications | Module 3 (applications belong to a job) | `Application`, files, status history |
| Dashboard | Modules 3 and 4 (reads their tables) | `GET /api/company/dashboard/` |

## Rules that keep the dependency graph acyclic

1. **Model imports flow one way:** `common ← Module1_Authentication ← Module2_CompanyManagement ← Module3_JobPosting ← applications`. A lower app never imports models from a higher one at module level.
2. Company sign-up touches `User` and `Company`. Its serializer, service and view live in `companies` (routed at `/api/auth/register/company/`) and use helpers from `accounts`, so `accounts` never imports `companies` (D-027). Shared enums (roles, statuses, member roles) live in `common/choices.py` so `common` permission classes need no app imports (D-028).
3. The dashboard view belongs to the `companies` app but reads `jobs` and `applications`; it imports them inside its own function, and returns zeros until those modules exist.
4. Shared pieces (permission classes, validators, email helper, pagination, storage, exception handler) live once in `apps/common`. Module business rules never live there.
5. Cross-module facts are exposed through service functions, not by reaching into another app's views or serializers.

## Cross-module facts to remember

- `is_accepting_applications` (Module 3) is the single check used by every public application path (Module 4).
- The built-in application form fields are defined once in code (Module 3) and used by both the form-schema endpoint and Module 4's submission validator.
- `CandidateProfile.resume_text`, `JobPosting.required_skills` and application statuses/history are shaped for the later CV-analysis and interview modules; those must plug in without changing these tables.
- User role and company member role stay in sync: member role `admin` ⇔ user role `company_admin`; any other member role ⇔ user role `hr`.

## Integration analysis and plan (Phase 4)

**Analysis, module by module** (facts taken from the code, 68 API operations on 54 paths):

| Module | Operations | Reads from | Provides to the others |
|---|---|---|---|
| Foundation (`common`) | none | nothing | enums, permissions, errors, storage, validators, mail helper |
| 1 Authentication | 25 | `common` | users, tokens, status-aware auth, `authenticate_password` |
| 2 Company management | 9 + 8 platform/auth routes | 1 | approved companies, memberships and roles, invitations, dashboard |
| 3 Job posting | 17 | 1, 2 | jobs, custom fields, form schema, `is_accepting_applications`, built-in field list |
| 4 Applications | 5 + job-scoped and public routes | 1, 3 | applications, history, files, real `applications_count` |

**Integration points** (each is covered by `integration_tests/`):
1. Company status gates Modules 3 and 4: only an *approved* company's active members reach HR endpoints; a suspended company's public forms stop accepting.
2. Account status gates everything: a suspended user's token stops working on the next request; a deactivated member is locked out; a role change applies on the next request.
3. Module 3 ← Module 4: `applications_count`, ordering by it, and the custom-field lock after the first application (through `services/applications_link.py`).
4. Module 2 ← Modules 3 and 4: the dashboard's job, applicant, pipeline, closing-soon and recent blocks (function-level imports, as the Doc prescribes).
5. Public surface: apply and job-form endpoints use Module 3's `is_accepting_applications` and built-in field definition, so HR's preview equals what candidates see.
6. Tenancy: every company-side endpoint answers 404 for another company's ids.

**Plan and what was done**
1. Analyse (above). 2. Implement the one missing link: the dashboard's real blocks (D-071). 3. Add `integration_tests/`: dashboard agreement with the list endpoints, cross-module rules, schema-driven sweeps over all 68 operations (anonymous, wrong role, other company), quality gates (checks, migrations, schema, dependency direction, test-case coverage) and one full end-to-end journey. 4. Regression: full suite, order independence, repeated concurrency runs, clean-room install, live run on PostgreSQL.

**Guards that keep it integrated**: `test_surface_sweep.py` fails if an endpoint is added without being classified (public, any logged-in user, candidate, company, platform admin); `test_quality_gates.py` fails if a module imports a higher module at module level, if a model changes without a migration, if the schema has warnings, or if a Doc test case (TC-01 to TC-22) loses its named test.
