# Unresolved Questions

Statuses: **Resolved** (decision recorded), **Open**, **Deferred**. "Needed before" is the step that cannot be finished correctly without the answer. Recommendation = what engineering will do if the owner approves defaults.

## Resolved / deferred

| ID | Question | Status |
|---|---|---|
| Q1 | Database | **Resolved:** PostgreSQL (D-002) |
| Q2 | Refresh-token delivery | **Resolved:** JSON body (D-003) |
| T-1 | Tally/ERP integration | **Deferred** by the owner (D-001) |

## Open

| ID | Needed before | Question | Recommendation |
|---|---|---|---|
| Q3 | Module 3 / deployment | Deployment target for Django and for the 5-minute `close_expired_jobs` schedule (cron, Azure, other); production email provider (SMTP/Gmail or SendGrid); how admin static files and Swagger assets are served. | Decide with the hosting choice. |
| Q4 | Module 1 | Block free-email domains (gmail, yahoo, outlook) for company sign-up? Doc calls it optional; the frontend demo data likely uses Gmail. | Off by default, list in settings. |
| Q5 | Module 3 | Salary currency (Doc silent; frontend hard-codes "£"). | Free-text currency code, no default. |
| Q6 | Module 1 | Is the API behind a proxy that needs trusted-proxy handling for per-IP throttles? | `USE_X_FORWARDED_PROTO` exists; client-IP handling decided at deployment. |
| Q7 | Module 2 | Doc §1.6 permission matrix lost its merged cells and says the platform admin sees all companies' dashboards, jobs and applications read-only, but no such endpoints exist. Add them? | Not in Phase 1 unless approved. |
| Q8 | Module 1 | Doc §1.6 lets the platform admin "suspend users" (FR-75) but defines no user suspend/reactivate endpoint (only company-level). The admin Users page needs one. | Add a minimal pair in Module 1. |
| Q9 | Module 1 | Profile `resume` returns "resume URL" but only application CVs are specified as private. | Serve the profile CV through an authenticated download as well. |
| Q10 | Module 1 | User deletion (frontend has a delete button; Doc has none). | Not offered in Phase 1. |
| Q11 | Phase 5 | Frontend roles `candidate/company/admin` vs backend `candidate/company_admin/hr/platform_admin`. | Backend names; frontend maps. |
| Q12 | Phase 5 | Frontend lacks `pending_verification` / `pending_approval` and any verification flow. | Frontend adopts the Doc statuses. |
| Q13 | Module 1 / Phase 5 | Frontend candidate sign-up collects desired role, skills, links and a CV; Doc sign-up takes only name, email, passwords and does not log in. | Follow the Doc; the extra data becomes profile fields after verification. |
| Q14 | Module 1 | Frontend profile has `bio`, `targetRole`, `experience` level, `portfolio` link that the Doc's `CandidateProfile` lacks; frontend has no education/experience rows or phone. | Extend `CandidateProfile` if the owner approves. |
| Q15 | Module 1–2 | Company fields: `location` vs `headquarters`; fixed industry list vs free text; size options differ (`201–500`/`500+` vs `201-1000`/`1000+`); no official email, phone, logo. | Doc enums and fields; frontend adapts. |
| Q16 | Module 3 | Job fields: experience level vs `min_experience_years`; "Temporary" job type; extra `requirements`, `hiringStages`; no deadline, education level, custom fields; share link uses `/apply/<id>`. | Doc schema; add `requirements` only if the owner wants it. |
| Q17 | Module 4 | Frontend stages (Applied, Screened, Shortlisted, Interviewed, Offer, Rejected) vs Doc statuses (`submitted`, `under_review`, `shortlisted`, `interview`, `selected`, `rejected`, `on_hold`): mapping not inferable (e.g. Offer vs selected). | Owner defines the mapping. |
| Q18 | Module 1 | Frontend accepts `.doc` CVs and 8 MB any-image photos; Doc allows PDF/DOCX ≤ 5 MB and JPG/PNG ≤ 2 MB. | Doc rules. |
| Q19 | Module 2 | Frontend admin settings `autoApproveCompanies` and signup toggles contradict manual approval. | Not supported in Phase 1. |
| Q20 | Phase 5 | Confirm frontend admin settings, audit log, analytics, communities, notifications and interview pages stay mock-only. | Yes. |
| Q21 | Module 2 | Suspending a company takes a `reason` (Doc §2.4) but `Company` only stores `rejection_reason`. Where is the suspension reason kept? | Add `suspension_reason` by migration in Module 2. |
| Q22 | Before local setup | Python version on the owner's machine (code is run on 3.13). | Use 3.12 or newer. |
