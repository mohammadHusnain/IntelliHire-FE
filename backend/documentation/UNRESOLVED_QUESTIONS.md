# Unresolved Questions

Statuses: **Resolved** (decision recorded), **Open**, **Deferred**. "Needed before" is the step that cannot be finished correctly without the answer. Recommendation = what engineering will do if the owner approves defaults.

## Resolved / deferred

| ID | Question | Status |
|---|---|---|
| Q1 | Database | **Resolved:** PostgreSQL (D-002) |
| Q2 | Refresh-token delivery | **Resolved:** JSON body (D-003) |
| Q4 | Free-email domains for company sign-up | **Resolved:** off by default, configurable (D-021) |
| Q6 | Client-IP handling for throttles | **Resolved** in code: `NUM_PROXIES` (D-031); the value to use is set at deployment (Q3) |
| Q8 | User suspend/reactivate | **Resolved:** added (D-022) |
| Q9 | Profile CV privacy | **Resolved:** authenticated download (D-023) |
| Q10 | User deletion | **Resolved:** not in Phase 1 (D-024) |
| Q13 | Candidate sign-up payload | **Resolved:** Doc contract (D-025), then **extended by the owner** with optional profile answers and a CV (D-073) |
| Q14 | Extra profile fields | **Resolved:** added (D-025) |
| Q18 | CV and photo rules | **Resolved:** Doc rules (D-026) |
| Q7 | Platform-admin read access to jobs and applications | **Resolved:** not in Phase 1 (D-043) |
| Q15 | Company field differences vs frontend | **Resolved:** Doc enums and fields win; frontend adapts in Phase 5 (D-043) |
| Q19 | Auto-approve companies | **Resolved:** manual approval only (D-043) |
| Q21 | Where a suspension reason is stored | **Resolved:** `suspension_reason` column (D-039) |
| Q5 | Salary currency | **Resolved:** free-text currency code, whole-number amounts (D-055) |
| Q16 | Job fields vs frontend | **Resolved:** Doc schema wins; frontend adapts in Phase 5 (D-055) |
| Q17 | Frontend stages vs Doc statuses | **Resolved:** the Doc's seven statuses; frontend maps in Phase 5 (D-067) |
| T-1 | Tally/ERP integration | **Deferred** by the owner (D-001) |

## Open

| ID | Needed before | Question | Recommendation |
|---|---|---|---|
| Q3 | Module 3 / deployment | Deployment target for Django and for the 5-minute `close_expired_jobs` schedule (cron, Azure, other); production email provider (SMTP/Gmail or SendGrid); how admin static files and Swagger assets are served. | Decide with the hosting choice. |
| Q11 | Phase 5 | Frontend roles `candidate/company/admin` vs backend `candidate/company_admin/hr/platform_admin`. | Backend names; frontend maps. |
| Q12 | Phase 5 | Frontend lacks `pending_verification` / `pending_approval` and any verification flow. | Frontend adopts the Doc statuses. |
| Q20 | Phase 5 | Confirm frontend admin settings, audit log, analytics, communities, notifications and interview pages stay mock-only. | Yes. |
| Q22 | Before local setup | Python version on the owner's machine (code is run on 3.13). | Use 3.12 or newer. |
| Q23 | Deployment | Scheduling: `python manage.py flushexpiredtokens` (token tables) alongside `close_expired_jobs` (Module 3); set `NUM_PROXIES` for the hosting proxy chain. | Decide with Q3. |
| Q24 | Phase 5 | The frontend profile page shows CV size and upload time and has no phone, education or experience editors; the API exposes only `resume_name`. Add `resume_size`/`resume_uploaded_at`, or drop them from the UI? | Drop from the UI unless wanted. |
