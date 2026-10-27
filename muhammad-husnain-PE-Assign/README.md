# Everyday Calculator

A browser calculator with four modes in one page:

| Tab | What it does | Built for |
|---|---|---|
| **Basic** | + − × ÷, brackets, percent, continuing from the last result | Everyday Calculator User: receipts, budgets, discounts |
| **Scientific** | Powers, roots, ln/log, trigonometry (degrees or radians), factorial, π, e, Ans | Student: checking multi-step working |
| **Loan** | Monthly payment, number of payments, total interest and total paid for a fixed-rate loan | Prospective Borrower: comparing loan offers |
| **Split bill** | Tip, total and each person's share, correct to the cent | Group Bill Payer: settling a shared bill |

## Why this app, and who it is for

Most people already have a calculator. What actually goes wrong in daily use is the *kind* of answer: a floating-point artefact (`0.1 + 0.2 = 0.30000000000000004`), a trig answer in the wrong angle unit, a loan total whose rounding nobody explains, or bill shares that don't add up to the bill. I chose a single app covering the four calculations people most often reach for. It treats **"never show a wrong number"** as the main requirement:

- Invalid input always produces a specific message: division by zero, √ of a negative, tan(90°), a malformed expression, a negative bill, a fractional loan term, and so on. It never produces `NaN`, `Infinity` or a crash.
- Money is calculated in integer cents, so bill shares always add up to the total exactly.
- Results are rounded to 12 significant digits for display. Results of 1e12 or more switch to scientific notation so that rounded digits never pass for exact ones.

Basic and Scientific share one expression engine and one state. A calculation started in one tab carries over to the other.

The roles, jobs and user stories are in [`docs/`](docs/):
- [`docs/app-roles.md`](docs/app-roles.md)
- [`docs/jobs-to-be-done.md`](docs/jobs-to-be-done.md)
- [`docs/user-stories.md`](docs/user-stories.md): 11 stories Implemented, 3 Not implemented.

## Prerequisites

- **Node.js 18 or newer** (tested with Node 22). Nothing else: the app has **no dependencies**, so there is nothing to install from npm.
- A current Chrome, Edge, Firefox or Safari.

## Install and start

```bash
cd muhammad-husnain-PE-Assign
npm start
```

Then open **http://localhost:5173** in your browser.

- No `npm install` is needed, because there are no dependencies. Running it anyway is harmless.
- If port 5173 is busy: `PORT=8080 npm start` (on Windows PowerShell: `$env:PORT=8080; npm start`).
- Why a server is needed: the app uses JavaScript modules, which browsers refuse to load from a `file://` URL. `server.js` is a ~60-line static file server built on Node's standard library.

## Run the tests

```bash
npm test
```

This runs Node's built-in test runner (`node --test`) over `tests/`. There are 54 tests, named after the user story they verify (for example `S-2 division by zero shows a message and no result`).

### Verification done during development

- **Unit tests:** all 54 pass.
- **Browser check:** the app was driven in headless Chromium with Playwright. That covered every tab, keyboard entry (S-4), the angle badge (S-6), form errors and focus (S-9, S-11), the tip presets, and a check for console errors (none). These scripts are not included in the package, because they need Playwright installed, which would add a dependency for reviewers.
- **Not tested:** Firefox and Safari were not available in the build environment. The app uses only standard ES2020 and DOM APIs (no vendor-specific features).

## Project structure

```
muhammad-husnain-PE-Assign/
  README.md
  package.json          npm start / npm test (no dependencies)
  server.js             zero-dependency static server for src/
  src/
    index.html          markup for all four tabs
    styles.css          layout, light/dark theme
    app.js              DOM wiring only: events in, rendering out
    lib/
      expression.js     tokenizer + recursive-descent parser/evaluator
      calculatorState.js keypad state machine (pure reducer)
      format.js         result and money formatting
      parseInput.js     strict form-field parsing into integer cents/units
      loan.js           annuity formula, loan validation
      billSplit.js      integer-cent tip and fair split, validation
  tests/                node:test unit tests, one block per user story
  docs/                 app roles, jobs to be done, user stories
  transcripts/          AI session transcript(s)
```

All calculation and validation logic is in `src/lib/`, which has no DOM code, so it can be tested directly. `app.js` contains no maths.

## AI tool and model

- **Tool:** Claude Code, in a cloud session started from claude.ai/code.
- **Model:** _[fill in the model name shown for the session]_
- **How it was used:** I gave Claude Code the full assignment text and asked it to analyse requirements, plan, implement, verify and explain, in that order. I made the product decisions (all four calculator types, the package name). The tool wrote all the code and the first drafts of the documents. I reviewed them and am responsible for their content. The full session is in `transcripts/`.

Issues caught and fixed during the session (all visible in the transcript):
1. **Loan totals.** The first version simulated a cent-rounded payment schedule. Checking extreme inputs showed that at $100M, 100% and 50 years the rounding error compounded into a final payment of over $100M. It was replaced by computing totals from the exact (unrounded) payment.
2. **Fake precision.** A unit test showed `123456789012345` displayed as `123456789012000`. Fixed notation is now limited to values below 1e12. Larger values use scientific notation.
3. **Uneven bill shares** were shown on one wrapped line that was hard to read. They are now one line per group.

## Code changed by hand

None. All code was written by the AI tool.

## Assumptions

- **Currency:** amounts are in US dollars (`$`), with 2 decimal places. Commas are accepted as thousands separators (`250,000`), but only in valid positions (`1,23` is rejected).
- **Percent key (Basic/Scientific):** `%` divides the number before it by 100. So `50% = 0.5`, `200×15% = 30` and `50+10% = 50.1`. It is not the "add 10% to 50" shortcut some pocket calculators use.
- **Precedence:** standard mathematical rules apply. `-2^2 = -4`, `2^3^2 = 512`, and implicit multiplication works for `2π`, `2(3+4)` and `2sin(30)`.
- **Angle unit:** degrees by default, because that is what most school problems use. The active unit is always visible in the Scientific tab.
- **Display precision:** 12 significant digits. The previous answer (`Ans`) keeps full double precision.
- **Expression length:** at most 200 characters.
- **Loan:** fixed rate, monthly payments, monthly compounding. Limits are $100 to $100,000,000, 0% to 100% (up to 3 decimals) and 1 to 50 whole years. Total paid is the exact payment × number of months, rounded to the cent. It can differ from the rounded monthly payment × months by at most half a cent per payment, and the app says so.
- **Bill split:** bill $0.01 to $1,000,000.00, tip 0% to 100% (up to 2 decimals), 1 to 100 people. The tip is rounded half-up to the cent. Leftover cents go one each to some people, so the shares differ by at most 1 cent.
- **Scope:** no saved history, no accounts and no network calls. Everything runs in the browser.
