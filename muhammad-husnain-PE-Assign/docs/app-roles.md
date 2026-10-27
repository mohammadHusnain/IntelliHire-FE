# App Roles

The app has four roles. All four use the same app without signing in, but each one comes to it with a different question and different stakes. Their needs differ like this:

| Role | What is at stake | What matters most to them |
|---|---|---|
| Everyday Calculator User | A wrong total on a receipt or budget | Speed, and a result they can trust without re-checking |
| Student | A wrong answer in homework or an exam | Functions, brackets and angle units, plus an explanation when an input is mathematically invalid |
| Prospective Borrower | A borrowing decision that runs for years | The true monthly and total cost, and clear limits on what the figures mean |
| Group Bill Payer | Money between friends, and fairness | Shares that are fair to the cent and add up to the bill |

---

**R-1 Everyday Calculator User.**
An Everyday Calculator User is an adult doing quick arithmetic in daily life, such as checking a receipt, adding up a budget or working out a discount. They are often on a phone and have no time to double-check the answer.
They can enter numbers and the operators + − × ÷, use brackets and percent, see the result, carry on from it, and correct mistakes from the keyboard or the on-screen keys.
They must never be shown a wrong result. That includes floating-point artefacts such as 0.30000000000000004, "Infinity" or "NaN", and a number rounded so that it looks exact when it isn't. If no correct result exists, they see a message that explains why.

**R-2 Student.**
A Student is a secondary-school or university student working through maths, physics or engineering problems that use powers, roots, logarithms, factorials and trigonometry. They are often checking their own working step by step.
They can do everything an Everyday Calculator User can. They can also use scientific functions and the constants π and e, switch between degrees and radians, and reuse the previous answer.
They must never get a trigonometric result without being able to see which angle unit was used. They must never get a silent wrong answer for an input outside a function's domain, such as √(−4), ln(0) or tan(90°). Those inputs show a message instead.

**R-3 Prospective Borrower.**
A Prospective Borrower is someone weighing a fixed-rate loan, such as a mortgage, car loan or personal loan, before committing to it. They usually compare a few combinations of amount, rate and term.
They can enter a loan amount, an annual interest rate and a term in years, and see the monthly payment, the number of payments, the total interest and the total amount paid.
They must never be shown figures for an input the calculator cannot handle correctly, such as a negative amount, a rate above 100% or a fractional term. They must never be left unsure how rounding affects the totals.

**R-4 Group Bill Payer.**
A Group Bill Payer is the person at a restaurant or shared outing who receives one bill for several people and has to work out the tip and what each person owes.
They can enter the bill amount, choose or type a tip percentage and the number of people, and see the tip, the total and each person's share.
They must never be shown shares that fail to add up to the total, because the shortfall or extra would fall on someone at the table. Shares must never differ between people by more than one cent.
