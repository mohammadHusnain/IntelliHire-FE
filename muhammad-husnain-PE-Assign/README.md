# Everyday Calculator

A browser calculator with four modes in one page, built with React and Motion (Framer Motion):

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

Each calculator presents its answer in a way suited to the question it answers:

| Module | How it presents the calculation |
|---|---|
| Basic / Scientific | A live preview (`= 19`) while you type, using the same engine as `=`. The result rises into place and the expression moves up into the history line. An error shakes the display and names the problem. Keys highlight when you type them on a keyboard. In Scientific, a `DEG \| RAD` switch sits in the display, next to the answer it affects. |
| Loan | The monthly payment as the headline figure, then a bar splitting what you repay into amount borrowed and interest, a plain-language ratio ("You repay $2.28 for every $1 borrowed") and an expandable "How this is calculated" with your numbers in the formula. |
| Split bill | What most people pay as the headline figure, then a receipt (bill, tip, total) with a bill-against-tip bar, one token per person marking who pays a cent more or less, and a check that the shares add up to the total. |

Results update as you type: there is no Calculate button. Before the inputs are complete, the result panel lists which inputs are still needed, ticking each one as it becomes valid. Errors appear when you leave a field, or for every field when you press Enter. All calculations are instant, so the app has no loading or progress states.

The roles, jobs and user stories are in [`docs/`](docs/):
- [`docs/app-roles.md`](docs/app-roles.md)
- [`docs/jobs-to-be-done.md`](docs/jobs-to-be-done.md)
- [`docs/user-stories.md`](docs/user-stories.md): 11 stories Implemented, 3 Not implemented.

## Prerequisites

- **Node.js 20.19+ or 22.12+** (tested with Node 22.22). This is the minimum for Vite 8.
- npm (comes with Node).
- A current Chrome, Edge, Firefox or Safari.

## Install and start

```bash
cd muhammad-husnain-PE-Assign
npm install
npm start
```

Then open **http://localhost:5173** in your browser. `npm run dev` does the same thing.

- If port 5173 is busy, Vite picks the next free port and prints it.
- Production build: `npm run build` writes to `dist/`, and `npm run preview` serves it on http://localhost:4173.
- Runtime dependencies: `react`, `react-dom`, and `motion` (Framer Motion) for animation. Build-time: `vite` and `@vitejs/plugin-react`. Versions are pinned exactly in `package.json`.

## Run the tests

```bash
npm test
```

This runs Node's built-in test runner (`node --test`) over `tests/`. There are 56 tests covering all calculation and validation logic, named after the user story they verify (for example `S-2 division by zero shows a message and no result`). They need no browser.

### Optional: browser check of the on-screen behaviour

`e2e/ui-check.cjs` drives the running app in Chromium and checks 58 on-screen acceptance criteria: live results, errors, focus, keyboard, presets, stepper, the angle switch and tab navigation. It runs twice, once with normal motion and once with `prefers-reduced-motion: reduce`, and fails on any console error. Playwright is not a project dependency, so install it only if you want to run this:

```bash
npm install --no-save playwright && npx playwright install chromium
npm start                # in one terminal
npm run test:ui          # in another
```

### Verification done during development

- **Unit tests:** all 56 pass.
- **Browser check:** all 58 checks pass in both motion modes, against the dev server and the production build (`npm run preview`, `URL=http://localhost:4173/ npm run test:ui`). No console errors.
- **Responsive layout:** checked at 320, 360, 390, 768, 1024 and 1440 px wide on every tab, including extreme values such as a $100,000,000 loan and a 100-person split. There is no horizontal scrolling at any width.
- **Not tested:** Firefox and Safari were not available in the build environment. The app uses standard React, CSS container queries and `color-mix()`, which all current browsers support.

## Project structure

```
muhammad-husnain-PE-Assign/
  README.md
  package.json            npm start / test / build; pinned dependencies
  index.html              Vite entry page
  vite.config.js
  src/
    main.jsx              mounts the app, imports the styles
    App.jsx               shell: navigation, module transitions, shared state
    motion.js             shared animation timings, easings, springs, variants
    lib/                  calculation and validation (no UI code, unit-tested)
      expression.js       tokenizer + recursive-descent parser/evaluator
      calculatorState.js  keypad state machine (pure reducer)
      format.js           result and money formatting
      parseInput.js       strict form-field parsing into integer cents/units
      loan.js             annuity formula, loan field validators
      billSplit.js        integer-cent tip and fair split, field validators
    modules/              one file per calculator experience
      Calculator.jsx      Basic + Scientific: display, keypads, preview
      Loan.jsx            loan form, breakdown, formula steps
      SplitBill.jsx       bill form, receipt, people tokens
      formHelpers.js      amount tidying, Enter-to-check
    components/           reusable UI: Field, Segmented, AnimatedNumber,
                          ProportionBar, Disclosure, InputChecklist, Icon
    hooks/                useValidatedForm, useCalculatorKeyboard
    styles/               tokens.css (design tokens), base, shell, controls,
                          calculator, results
  tests/                  node:test unit tests, one block per user story
  e2e/ui-check.cjs        optional browser check (Playwright)
  docs/                   app roles, jobs to be done, user stories
  transcripts/            AI session transcript(s)
```

All calculation and validation logic is in `src/lib/`, which has no React code. The UI calls the same functions the tests call, so what you see on screen is exactly what is tested.

### UI design notes

- **Design tokens** (`styles/tokens.css`): one neutral palette, plus an accent colour per module (blue Basic, violet Scientific, green Loan, orange Split bill). Each module sets `--accent` on the page, so every shared component takes the module's colour without duplicate styles. Light and dark themes follow the system setting.
- **Motion** (`motion.js`): every animation uses the shared durations (160 ms to 500 ms), easings and springs. Only transforms and opacity are animated, apart from the height of inline messages. Animated numbers write straight to the DOM instead of re-rendering React each frame, and screen readers only ever get the final value. `MotionConfig reducedMotion="user"` turns off movement for users who ask for reduced motion, and the counters, shake and bars respect it.
- **Responsive**: wider than 900 px there is a sidebar. Below that, a sticky top bar holds a 4-up tab bar. The form and result sit side by side when the workspace is at least 820 px wide (a container query). The scientific keys sit beside the number pad from 760 px, one group per row, and above it, 5 across, on phones.
- **Accessibility**: the tabs and segmented controls work with the arrow keys and Home/End, focus rings are visible, every field has a label and its errors are linked with `aria-describedby`, results are announced with `aria-live`, and keys, fields, buttons and tabs are at least 44 px tall. The compact segmented options (tip and term shortcuts, DEG/RAD) are 30 to 36 px tall.

## AI tool and model

- **Tool:** Claude Code, in a cloud session started from claude.ai/code.
- **Model:** _[fill in the model name shown for the session]_
- **How it was used:** I gave Claude Code the full assignment text and asked it to analyse requirements, plan, implement, verify and explain, in that order. I made the product decisions (all four calculator types, the package name). The tool wrote all the code and the first drafts of the documents. I reviewed them and am responsible for their content. The full session is in `transcripts/`.

Issues caught and fixed during the session (all visible in the transcript):
1. **Loan totals.** The first version simulated a cent-rounded payment schedule. Checking extreme inputs showed that at $100M, 100% and 50 years the rounding error compounded into a final payment of over $100M. It was replaced by computing totals from the exact (unrounded) payment.
2. **Fake precision.** A unit test showed `123456789012345` displayed as `123456789012000`. Fixed notation is now limited to values below 1e12. Larger values use scientific notation.
3. **Uneven bill shares** were shown on one wrapped line that was hard to read. They are now one line per group.

UI overhaul (second part of the session: React + Motion):

4. **Mobile overflow.** At 390 px the Loan and Split forms were about 470 px wide. Text inputs have a default intrinsic width, which stretched the grid column. Fixed with a `minmax(0, 1fr)` column and full-width inputs, then checked at 6 widths.
5. **Lost keystrokes.** Keys typed straight after switching to the calculator were dropped while the previous tab animated out, because the listener lived inside the calculator. It now lives in the app shell.
6. **Misleading headline.** With 99 of 100 people paying 1¢ more, the headline showed the amount only one person pays. It now shows what most people pay and names the group that differs.
7. **Scientific layout.** A 3-row scientific keypad beside a 6-row number pad left dead space. The keys are now regrouped into one function family per row on wide screens.

Two small logic changes were made to support the new UI, with rules and messages unchanged: the loan and bill validators are exported per field (so a field can be validated as soon as it is edited), and the old `server.js` was replaced by Vite.

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
- **Live results:** results recalculate on every keystroke once all inputs are valid. The rules are exactly those in `src/lib`.
- **When errors show:** a field's error shows once you leave the field with something typed in it, or for every field when you press Enter. This avoids flagging fields the user simply hasn't reached yet.
- **Scope:** no saved history, no accounts and no network calls. Everything runs in the browser.
