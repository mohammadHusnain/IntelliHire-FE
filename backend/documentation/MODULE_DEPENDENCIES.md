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

1. **Model imports flow one way:** `common ← accounts ← companies ← jobs ← applications`. A lower app never imports models from a higher one at module level.
2. Company sign-up touches `User` and `Company`. Its serializer, service and view live in `companies` (routed at `/api/auth/register/company/`) and use helpers from `accounts`, so `accounts` never imports `companies` (D-027). Shared enums (roles, statuses, member roles) live in `common/choices.py` so `common` permission classes need no app imports (D-028).
3. The dashboard view belongs to the `companies` app but reads `jobs` and `applications`; it imports them inside its own function, and returns zeros until those modules exist.
4. Shared pieces (permission classes, validators, email helper, pagination, storage, exception handler) live once in `apps/common`. Module business rules never live there.
5. Cross-module facts are exposed through service functions, not by reaching into another app's views or serializers.

## Cross-module facts to remember

- `is_accepting_applications` (Module 3) is the single check used by every public application path (Module 4).
- The built-in application form fields are defined once in code (Module 3) and used by both the form-schema endpoint and Module 4's submission validator.
- `CandidateProfile.resume_text`, `JobPosting.required_skills` and application statuses/history are shaped for the later CV-analysis and interview modules; those must plug in without changing these tables.
- User role and company member role stay in sync: member role `admin` ⇔ user role `company_admin`; any other member role ⇔ user role `hr`.
