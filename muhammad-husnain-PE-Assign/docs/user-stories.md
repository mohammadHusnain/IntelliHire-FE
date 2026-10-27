# User Stories with Acceptance Criteria

Each story names the job it serves (see `jobs-to-be-done.md`), and each job names its role (see `app-roles.md`).

Conventions used below:
- "Press" means clicking the on-screen key or typing the key on a keyboard (see S-4).
- In the calculator, the large line is the **display** and the small line above it is the **history**.
- Messages are quoted exactly as the app shows them.
- The automated test for each criterion lives in `tests/` under the story ID. Run them with `npm test`.

| ID | Story | Job | Status |
|---|---|---|---|
| S-1 | Basic arithmetic with correct order of operations | J-1 | Implemented |
| S-2 | Clear errors for invalid calculations, and recovery from them | J-1 | Implemented |
| S-3 | Continue calculating from a result | J-1 | Implemented |
| S-4 | Keyboard entry | J-1 | Implemented |
| S-5 | Scientific functions and constants | J-2 | Implemented |
| S-6 | Degrees and radians | J-2 | Implemented |
| S-7 | Explanations for mathematically invalid input | J-2 | Implemented |
| S-8 | Monthly payment and total cost of a loan | J-3 | Implemented |
| S-9 | Loan input validation | J-3 | Implemented |
| S-10 | Tip, total and fair shares | J-4 | Implemented |
| S-11 | Bill split input validation | J-4 | Implemented |
| S-12 | Month-by-month repayment schedule | J-3 | Not implemented |
| S-13 | Calculation history | J-2 | Not implemented |
| S-14 | Splitting by what each person ordered | J-4 | Not implemented |

---

## S-1 Basic arithmetic (serves J-1, Implemented)

"As an Everyday Calculator User, I want to type a sum the way I would write it and get the correct result, so that I can trust the figure without re-doing it by hand."

1. Given an empty display, when I press `1 2 + 7 =`, then the display shows `19` and the history shows `12+7 =`.
2. Given an empty display, when I press `2 + 3 × 4 =`, then the display shows `14`, because × and ÷ are done before + and −.
3. Given an empty display, when I press `( 2 + 3 ) × 4 =`, then the display shows `20`.
4. Given an empty display, when I press `7 ÷ 2 =`, then the display shows `3.5`.
5. Given an empty display, when I press `0 . 1 + 0 . 2 =`, then the display shows `0.3`, not `0.30000000000000004`.
6. Given an empty display, when I press `1 ÷ 3 =`, then the display shows `0.333333333333` (12 significant digits).
7. Given an empty display, when I press `− 5 × 2 =`, then the display shows `−10`.
8. Given an empty display, when I press `5 0 % =`, then the display shows `0.5`. Given `200 × 15 % =`, the display shows `30`. The rule is that % divides the number just before it by 100.
9. Given an empty display, when I enter `9999999999 × 9999999999 =`, then the display shows `9.999999998e+19`.
10. Given an empty display, when I enter `123456789012345 =`, then the display shows `1.23456789012e+14`. Results of 1e12 or more are shown in scientific notation so that rounded digits never look exact. When I enter `123456789012 =`, the display shows `123456789012`.
11. Given an empty display, when I enter `1 ÷ 10000000 =`, then the display shows `1e-7`.

## S-2 Clear errors and recovery (serves J-1, Implemented)

"As an Everyday Calculator User, I want a plain explanation when a calculation cannot be done, and to be able to fix it, so that I am never left with a wrong number or a broken screen."

1. Given an empty display, when I press `8 ÷ 0 =`, then the message `Cannot divide by zero` appears in red, the display still shows `8÷0`, and no result is shown.
2. Given an empty display, when I press `8 ÷ ( 2 − 2 ) =` or `0 ÷ 0 =`, then the message `Cannot divide by zero` appears.
3. Given I entered `2 +`, when I press `=`, then the message `The expression is incomplete` appears.
4. Given I entered `× 3`, when I press `=`, then the message `Unexpected "×"` appears.
5. Given I entered `( 2 + 3`, when I press `=`, then the message `Missing closing bracket ")"` appears.
6. Given I entered `2 + 3 )`, when I press `=`, then the message `There is a ")" without a matching "("` appears.
7. Given I entered `1 . 2 . 3`, when I press `=`, then the message `"1.2.3" is not a valid number` appears.
8. Given I entered `( )`, when I press `=`, then the message `Empty brackets "()"` appears.
9. Given I entered `10 ^ 400`, when I press `=`, then the message `The result is too large to calculate` appears, never `Infinity`.
10. Given the error from criterion 1 is showing, when I press `⌫`, `4` and `=`, then the message disappears and the display shows `2`.
11. Given an error is showing, when I press any digit or operator, then the message disappears and the key is added to the end of the expression.
12. Given an error is showing, when I press `AC`, then the display shows `0` and the message disappears.
13. Given an empty display, when I press `=`, then nothing changes and no message appears.
14. Given the expression is 200 characters long, when I press another key, then the key is not added and the message `The expression is too long (maximum 200 characters)` appears.
15. Given the previous result was `5`, when a later calculation fails, then `Ans` is still `5`.

## S-3 Continue from a result (serves J-1, Implemented)

"As an Everyday Calculator User, I want to carry on from the result I just got, so that I can do multi-step sums without retyping numbers."

1. Given the display shows the result `42`, when I press `+ 8 =`, then the history shows `Ans+8 =` and the display shows `50`.
2. Given the display shows a result, when I press a digit such as `3`, then a new calculation starts with `3`. The previous result is not changed.
3. Given the display shows a result, when I press `=` again, then nothing changes.
4. Given the display shows a result, when I press `⌫`, then the display is cleared to `0`, and the result is kept as `Ans`.
5. Given I calculated `1 ÷ 3 =`, when I press `× 3 =`, then the display shows `1`. `Ans` keeps full precision, not the rounded display value.

## S-4 Keyboard entry (serves J-1, Implemented)

"As an Everyday Calculator User on a computer, I want to type calculations on my keyboard, so that I can work as fast as I type."

1. Given the Basic or Scientific tab is open, when I type `8/0` and press Enter, then the expression shows `8÷0` and the message `Cannot divide by zero` appears.
2. Given the Basic or Scientific tab is open, the keys `0–9 . + - ^ % ! ( )` insert themselves, `*` and `x` insert ×, `/` inserts ÷, Enter and `=` calculate, Backspace deletes, and Escape or Delete clears.
3. Given the Loan or Split bill tab is open, or the cursor is in a text field, when I type, then the calculator does not react.

Note: S-4 is checked in a real browser (Chromium via Playwright, see README › Verification), not by the unit tests.

## S-5 Scientific functions and constants (serves J-2, Implemented)

"As a Student, I want powers, roots, logarithms, factorials and constants that follow standard mathematical precedence, so that I can enter an expression exactly as it is written in my problem."

1. Given the Scientific tab, when I enter `2 ^ 10 =`, then the display shows `1024`. When I enter `3 x² =`, then the display shows `9`.
2. Given the Scientific tab, when I enter `√( 144 ) =`, then the display shows `12`.
3. Given the Scientific tab, when I enter `5 n! =`, then the display shows `120`. When I enter `0 n! =`, it shows `1`.
4. Given the Scientific tab, when I enter `log( 1000 ) =`, then the display shows `3`. When I enter `ln( e ) =`, it shows `1`.
5. Given the Scientific tab, when I press `π =`, then the display shows `3.14159265359`. When I press `e =`, it shows `2.71828182846`.
6. Given the Scientific tab, when I enter `2 ^ 3 ^ 2 =`, then the display shows `512`, because powers group from the right.
7. Given the Scientific tab, when I enter `− 2 ^ 2 =`, then the display shows `−4`. When I enter `2 ^ − 1 =`, it shows `0.5`.
8. Given the Scientific tab, when I enter `2 π =`, `2 ( 3 + 4 ) =` or `2 sin( 30 ) =`, then multiplication is implied and the display shows `6.28318530718`, `14` and `1` respectively.
9. Given the display shows the result `12`, when I press `x²` and `=`, then the display shows `144`.
10. Given I entered `2 + sin(`, when I press `⌫`, then the whole `sin(` is removed, leaving `2+`.
11. Given the Scientific tab, when I enter `170 n! =`, then the display shows `7.25741561531e+306`.

## S-6 Degrees and radians (serves J-2, Implemented)

"As a Student, I want to choose whether angles are in degrees or radians and always see which one is active, so that a trigonometry answer is never wrong because of the wrong unit."

1. Given the app has just opened, when I open the Scientific tab, then the display shows the badge `DEG`, and `sin( 30 ) =` shows `0.5`, `cos( 60 ) =` shows `0.5`, `tan( 45 ) =` shows `1`, and `sin( 180 ) =` shows `0`, not `1.22e-16`.
2. Given degrees mode, when I press `DEG → RAD`, then the badge shows `RAD`, the key reads `RAD → DEG`, and `sin( π ÷ 2 ) =` shows `1`.
3. Given degrees mode, when I enter `sin⁻¹( 0.5 ) =`, then the display shows `30`. When I enter `tan⁻¹( 1 ) =`, it shows `45`. Given radians mode, `sin⁻¹( 1 ) =` shows `1.57079632679`.
4. Given a result is showing, when I switch the angle unit, then the result and history stay on screen. The new unit applies to the next calculation.
5. Given the Basic tab, the angle badge is shown when the expression on screen contains sin, cos or tan. When a result is showing, the check uses the expression that produced it. Otherwise the badge is hidden.

## S-7 Explanations for mathematically invalid input (serves J-2, Implemented)

"As a Student, I want to be told why an input has no real answer, so that I can find the mistake in my working instead of trusting a wrong number."

1. Given the Scientific tab, when I enter `√( −4 ) =`, then the message `Square root of a negative number is not a real number` appears.
2. When I enter `ln( 0 ) =` or `log( −1 ) =`, then the message `Logarithm is only defined for numbers greater than 0` appears.
3. When I enter `sin⁻¹( 2 ) =`, then the message `asin needs a value between -1 and 1` appears.
4. Given degrees mode, when I enter `tan( 90 ) =` or `tan( 270 ) =`, then the message `tan is undefined at 90° + k·180°` appears. Given radians mode, `tan( π ÷ 2 ) =` shows `tan is undefined at π/2 + kπ`.
5. When I enter `3.5 n! =` or `( −3 ) n! =`, then the message `Factorial is only defined for whole numbers 0 or greater` appears.
6. When I enter `171 n! =`, then the message `The result is too large to calculate` appears.
7. When I enter `( −8 ) ^ 0.5 =`, then the message `The result is not a real number` appears.
8. When I enter `0 ^ −1 =`, then the message `Cannot divide by zero` appears.
9. When I type `sin30` without brackets and press `=`, then the message `sin needs brackets, for example sin(30)` appears.
10. After any of these messages, the recovery behaviour of S-2 (criteria 10 to 12) applies.

## S-8 Monthly payment and total cost of a loan (serves J-3, Implemented)

"As a Prospective Borrower, I want to see my monthly payment, total interest and total amount repaid, so that I can judge whether a loan is affordable and compare offers."

Assumptions shown in the app: fixed rate, one payment a month, interest compounded monthly, amounts in US dollars.

1. Given the Loan tab, when I enter amount `250,000`, rate `6.5` and term `30` and press `Calculate repayment` or Enter, then I see a monthly payment of `$1,580.17`, `360` payments, total interest of `$318,861.22` and a total paid of `$568,861.22`.
2. Given amount `20000`, rate `7` and term `5`, when I calculate, then I see a monthly payment of `$396.02`, `60` payments, total interest of `$3,761.44` and a total paid of `$23,761.44`.
3. Given amount `12000`, rate `0` and term `1`, when I calculate, then I see a monthly payment of `$1,000.00`, total interest of `$0.00` and a total paid of `$12,000.00`.
4. Given any valid input, when I calculate, then the total paid equals the loan amount plus the total interest exactly. It differs from the monthly payment × the number of payments by at most half a cent per payment, as the note under the form says.
5. Boundary values: given amount `100`, rate `0` and term `1`, the monthly payment is `$8.33`. Given amount `100,000,000`, rate `100` and term `50`, I see a monthly payment of `$8,333,333.33`, `600` payments, total interest of `$4,900,000,000.00` and a total paid of `$5,000,000,000.00`.
6. Given a result is showing, when I change a field and calculate again, then the result updates.

## S-9 Loan input validation (serves J-3, Implemented)

"As a Prospective Borrower, I want to be told exactly which input is wrong and why, so that I never act on figures calculated from a typo."

In every case below, the message appears under the field, the field is outlined in red and gets the cursor, and any previous result is hidden. Only the first invalid field (in the order amount, rate, term) is reported.

1. Given the amount is empty, when I calculate, then I see `Enter a loan amount.` An empty rate gives `Enter an interest rate.` and an empty term gives `Enter a loan term.`
2. Given the amount is `abc` or `1,23`, then I see `Loan amount must be a number, for example 1250 or 1,250.50.` Given the rate is `5%`, I see `Interest rate must be a number, for example 15 or 12.5.`
3. Given the amount is `-5000`, then I see `Loan amount cannot be negative.` Given the rate is `-1`, I see `Interest rate cannot be negative.`
4. Given the amount is `99.99`, then I see `Loan amount must be at least $100.00.` Given `100000000.01`, I see `Loan amount cannot be more than $100,000,000.00.` Given a number with more than 12 digits before the decimal point, I see `Loan amount is too large.`
5. Given the rate is `100.001`, then I see `Interest rate cannot be more than 100%.`
6. Given the term is `0` or `51`, then I see `Loan term must be between 1 and 50 years.` Given `2.5`, I see `Loan term must be a whole number.`
7. Given the amount is `1000.001`, then I see `Loan amount can have at most 2 decimal places.` Given the rate is `5.1234`, I see `Interest rate can have at most 3 decimal places.`
8. Given an error is showing, when I correct the field and calculate again, then the message and red outline disappear and the result is shown.

## S-10 Tip, total and fair shares (serves J-4, Implemented)

"As a Group Bill Payer, I want the tip, the total and each person's share worked out to the cent, so that I collect exactly the right amount and nobody pays more than their fair share."

The tip field starts at `15` and the number of people at `2`. The preset buttons `0%`, `10%`, `15%`, `18%` and `20%` fill in the tip field.

1. Given bill `80`, tip `20` and people `4`, when I press `Split the bill` or Enter, then I see a tip of `$16.00`, a total of `$96.00`, and each person pays `$24.00`.
2. Given bill `100`, tip `15` and people `3`, when I split, then I see a tip of `$15.00`, a total of `$115.00`, and "Each person pays" shows two lines: `1 person pays $38.34` and `2 people pay $38.33`.
3. Given bill `10.05` and tip `15`, the tip is `$1.51` (1.5075 rounded half-up). Given bill `84.60` and tip `18`, the tip is `$15.23`. Given bill `0.10` and tip `5`, the tip is `$0.01`.
4. Given bill `42.50`, tip `0` and people `1`, when I split, then I see a tip of `$0.00`, a total of `$42.50` and each person pays `$42.50`.
5. Given any valid input, the shares always add up to the total exactly, and no two people's shares differ by more than one cent.
6. Boundary values: given bill `0.01`, tip `0` and people `3`, I see `1 person pays $0.01` and `2 people pay $0.00`. Given bill `1,000,000`, tip `100` and people `100`, I see a tip of `$1,000,000.00`, a total of `$2,000,000.00` and each person pays `$20,000.00`.
7. Given I click the `20%` preset, the tip field shows `20`. The result updates when I next press `Split the bill`.

## S-11 Bill split input validation (serves J-4, Implemented)

"As a Group Bill Payer, I want mistakes in what I type to be pointed out, so that I don't tell my friends a wrong amount."

The message appears under the field, the field is outlined in red and gets the cursor, and any previous result is hidden.

1. Given the bill is empty, when I split, then I see `Enter a bill amount.` An empty tip gives `Enter a tip percentage.` and an empty people field gives `Enter a number of people.`
2. Given the bill is `twenty`, then I see `Bill amount must be a number, for example 1250 or 1,250.50.`
3. Given the bill is `0`, then I see `Bill amount must be more than $0.00.` Given `-20`, I see `Bill amount cannot be negative.` Given `1000000.01`, I see `Bill amount cannot be more than $1,000,000.00.`
4. Given the tip is `-5`, then I see `Tip percentage cannot be negative.` Given `101`, I see `Tip cannot be more than 100%.` Given `12.345`, I see `Tip percentage can have at most 2 decimal places.`
5. Given people is `0` or `101`, then I see `Number of people must be between 1 and 100.` Given `2.5`, I see `Number of people must be a whole number.`
6. Given the bill is `20.999`, then I see `Bill amount can have at most 2 decimal places.`
7. Given an error is showing, when I correct the field and split again, then the message disappears and the result is shown.

---

## Not implemented (candidates for the next iteration)

### S-12 Month-by-month repayment schedule (serves J-3, Not implemented)

"As a Prospective Borrower, I want to see how much of each payment goes to interest and how much to the balance, so that I understand how quickly I build equity."

- Given a valid loan, when I open the schedule, then I see one row per month with the payment, the interest, the principal and the remaining balance, and the last row's balance is `$0.00`.

### S-13 Calculation history (serves J-2, Not implemented)

"As a Student, I want to see my previous calculations in this session, so that I can retrace the steps of a multi-part problem."

- Given I have done three calculations, when I open the history, then I see all three expressions and results, newest first. Selecting one puts its expression back on the display.

### S-14 Splitting by what each person ordered (serves J-4, Not implemented)

"As a Group Bill Payer, I want to split the bill by what each person ordered, so that people who ordered less pay less."

- Given items assigned to people, when I split, then each person's share is their items plus the same percentage tip, and the shares add up to the total.
