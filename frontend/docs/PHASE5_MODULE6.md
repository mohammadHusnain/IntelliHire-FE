# Phase 5 · Module 6 — CV analysis and shortlisting

Scope: the per-role screening settings (threshold, flags, the four scoring weights), "Begin CV screening"
with a live progress bar, the ranked CV-match list with its filters, the parsed-CV drawer, the threshold
preview and apply, asking for one CV again after a failure, the out-of-date-score banner, and the CV match
column, best-match ordering and minimum-match filter on the candidates screens.

All seven Module 6 endpoints are consumed. Nothing on these screens is invented: where the backend has no
number, the screen says so.

## Run it

Same as Modules 1–4 (`docs/PHASE5_MODULE1.md`). Extra commands:

```bash
npm run test:run        # the whole suite (MSW, no backend)
npx vitest run src/lib/cvMap.test.js src/api/cvAnalysisApi.test.js src/pages/company/CompanyCVAnalysis.test.jsx src/pages/company/CompanyApplicantsLive.test.jsx src/pages/company/CompanyApplicantLive.test.jsx
```

There is **no `e2e:module6`** script (owner's decision), as for Modules 5, 8, 9 and 10.

## How it is wired

- `src/api/cvAnalysisApi.js` — `config`, `updateConfig` (one partial PUT for flags and weights alike),
  `progress`, `ranking`, `analysis`, `previewThreshold`, `applyThreshold`, plus `run(jobId, mode)` and
  `rerun(applicationId)`.
- `src/lib/cvMap.js` — the one place for Module 6 mapping: the six `cv_label` values with their tones, the
  analysis states, the three run modes with the sentence each one means, the weight rule, the score bands,
  the two role predicates and `AI_NOTICE`.
- `src/components/company/cvAnalysisParts.jsx` — the renderers shared by the ranking drawer and the profile
  panel (score summary, breakdown, skill chips, the AI explanation, the stale warning, parsed CV, flags), so
  the two cannot drift apart.
- `src/components/company/CvAnalysisPanel.jsx` — the CV analysis on a candidate's profile.
- `CompanyCVAnalysis.jsx` (`/company/jobs/:id/cv-analysis`) — the workspace. `ScreeningSettings` inside it
  owns the editable settings.
- `CompanyApplicantsLive.jsx` and `applicationMap.js` — the CV match column, the board-card badge,
  `-cv_score` ordering and the `min_cv_score` filter.

## Decisions (agreed with the owner)

- **The backend contract wins** where it differs from the guide. The run endpoint takes `mode`
  (`missing` | `full` | `rescore`), not the guide's `force`.
- **`invite_on_shortlist` stays read-only.** Module 7 exists, so switching it on would send real screening
  invitations whose questions still come from the placeholder AI hooks. It is displayed with its state and
  gets its toggle when the interview LLM code lands. (The old "Module 7 pending" label is gone.)
- **Two progress numbers, not one.** The bar shows the server's `percent_done`, which is "done out of the
  CVs this role has started analysing" — it ignores CVs never queued, so it can read 100% with work
  outstanding. `not_analysed` is therefore shown separately, with Run as the way to clear it.
- **Nothing is re-scored silently.** `stale_scores > 0` raises a banner whose only action is Re-score
  (`mode: "rescore"`), which is what the guide's §6.6 asks for.
- Saving a weight warns that every analysed CV of the role is re-scored in the background. The Save button
  stays disabled until the four weights total exactly 100, so an impossible request is never sent; the
  server's own `weights` error is shown on the group if it still refuses.
- The CV match column links to that role's CV analysis (the row itself still opens the candidate).
- An out-of-range minimum-match filter is dropped rather than sent.

## Behaviour worth knowing

- **Roles mirror `permissions.py` exactly.** Admin and HR manager change settings and apply thresholds;
  admin, HR manager and recruiter may run a screening or ask for one CV again; a viewer sees neither
  control. A recruiter sees the Run control but no settings.
- While `in_progress` is true the page asks `/cv-screening/` again every 4 seconds, offers no second run,
  and re-reads the ranking once the run finishes. The timer stops when the run clears and on unmount.
- `409 no_applications` and `409 analysis_in_progress` are shown with the server's own words.
- Retry appears only on a `failed` or `manual_review` analysis.
- The explanation never appears without "AI-generated, for review by a person" beside it, and the server's
  `notice` is printed under the analysis.
- An unscored application shows an em dash, never a 0. The list's `-1` "not scored" sentinel never reaches
  the screen.
- Applications without a score sort last, which is the server's ordering, not the client's.

## Known limits

- `cv_extract` and `cv_explain` run on the **fake AI provider** unless the backend sets `AI_PROVIDER=openai`
  with a key, so scores and explanations are placeholders. The guide also asks for `CV_SEMANTIC_LOW/HIGH` to
  be calibrated on five or six real anonymised CVs before the semantic part is trusted.
- Automatic analysis on arrival runs inside the submitting request when Celery is eager (local development),
  so that request takes as long as the model does.
- No `e2e:module6`; the MSW suite is the check.
- The guide's §6.6 "HR edited the job's required skills" banner is driven by the server's `stale_scores` and
  per-row `stale` flags, so it appears after the next progress read rather than instantly on save.

## Manual checklist (real backend)

1. Publish a role with required skills; apply to it twice from a private window with PDFs.
2. Open Roles → the role → CV analysis. Run screening (`Not yet analysed`) → confirm → the toast names how
   many were queued and the bar moves without touching Refresh.
3. Change a weight so the four total 100 → Save → the out-of-date banner appears → Re-score clears it.
4. Set the weights to 60/25/15/10 → Save is disabled and the total reads 110 / 100.
5. Turn "Shortlist at or above the threshold" on and off; check "Invite to a screening interview" has no
   switch.
6. Preview a threshold, then apply it: only those at or above move, nobody is rejected.
7. Open a ranked row's Details: the chips, the explanation with its notice, and what was read from the CV.
8. Open a candidate's profile: the CV analysis panel shows the same numbers and links to the full ranking.
9. Candidates screen → List: the CV match column, "Best CV match first", and Min CV match 70.
10. Sign in as a recruiter (Run yes, settings no) and as a viewer (neither).
