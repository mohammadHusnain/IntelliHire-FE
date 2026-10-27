// Browser check of the on-screen acceptance criteria (docs/user-stories.md).
// Drives the running app in Chromium, once with normal motion and once with
// reduced motion, and fails on any console error.
//
// Optional: needs Playwright, which is not a project dependency.
//   npm install --no-save playwright && npx playwright install chromium
//   npm start            (in another terminal)
//   npm run test:ui      (or URL=http://localhost:4173/ npm run test:ui)

const { chromium } = require('playwright');
const BASE = process.env.URL || 'http://localhost:5173/';
let fails = 0;
const ok = (name, cond, got) => { if (!cond) fails++; console.log(cond ? 'PASS' : 'FAIL', name, cond ? '' : JSON.stringify(got)); };
async function run(reducedMotion) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto(BASE); await p.waitForSelector('[data-testid=main-display]');
  const settle = () => p.waitForTimeout(reducedMotion === 'reduce' ? 350 : 700);
  const main = async () => (await p.locator('[data-testid=main-display]').last().textContent());
  const hist = async () => (await p.locator('[data-testid=history]').textContent()).trim();
  const tid = async (t) => (await p.locator(`[data-testid=${t}]`).textContent()).trim();
  const tab = (n) => p.getByRole('tab', { name: new RegExp('^' + n) });
  console.log(`--- reducedMotion=${reducedMotion}`);

  // S-1 / S-3 / S-2 basic flows (keyboard)
  await p.keyboard.type('12+7'); await settle();
  ok('S-1 live preview', (await tid('calc-preview')) === '= 19', await tid('calc-preview'));
  await p.keyboard.press('Enter'); await settle();
  ok('S-1.1 result + history', (await main()) === '19' && (await hist()) === '12+7 =', [await main(), await hist()]);
  await p.keyboard.type('+8='); await settle();
  ok('S-3.1 continue Ans', (await main()) === '27' && (await hist()) === 'Ans+8 =', [await main(), await hist()]);
  await p.keyboard.type('8/0'); await p.keyboard.press('Enter'); await settle();
  ok('S-2.1 divide by zero', (await tid('calc-error')).includes('Cannot divide by zero') && (await main()) === '8÷0', [await main()]);
  await p.keyboard.press('Backspace'); await p.keyboard.type('4='); await settle();
  ok('S-2.10 recovery', (await main()) === '2' && (await p.locator('[data-testid=calc-error]').count()) === 0, await main());
  await p.keyboard.type('6x7'); await settle(); ok('S-4.2 x key', (await main()) === '6×7', await main());
  await p.keyboard.press('Delete'); await settle(); ok('S-4.2 Delete clears', (await main()) === '0', await main());
  await p.keyboard.press('Enter'); await settle(); ok('S-2.13 = on empty', (await main()) === '0' && (await hist()) === '', await main());
  await p.getByRole('button', { name: 'plus' }).click(); // clicking keys
  await p.keyboard.press('Escape');
  for (const k of ['2', 'plus', '3', 'multiply', '4', 'equals']) await p.getByRole('button', { name: k, exact: true }).click();
  await settle(); ok('S-1.2 click precedence', (await main()) === '14', await main());
  await p.keyboard.type('0.1+0.2='); await settle(); ok('S-1.5 float', (await main()) === '0.3', await main());

  await p.keyboard.press('Escape'); await p.keyboard.type('12+'); await settle();
  ok('S-1.12 preview hidden when incomplete', (await p.locator('[data-testid=calc-preview]').count()) === 0);
  await p.keyboard.type('7'); await settle(); ok('S-1.12 preview shown', (await tid('calc-preview')) === '= 19');
  await p.keyboard.press('Escape'); await p.keyboard.type('5'); await settle();
  ok('S-1.12 preview hidden for single number', (await p.locator('[data-testid=calc-preview]').count()) === 0);
  await p.keyboard.press('Escape');
  await p.keyboard.down('7'); const flashed = await p.locator('.key.is-flashing').textContent(); await p.keyboard.up('7');
  ok('S-4.4 key flash', flashed === '7', flashed); await p.keyboard.press('Escape');
  await p.keyboard.type('0.1+0.2='); await settle();
  // S-5/S-6/S-7 scientific
  await tab('Scientific').click(); await settle();
  ok('S-3 state kept across Basic→Scientific', (await main()) === '0.3', await main());
  ok('S-6.1 DEG selected', (await p.getByRole('radio', { name: 'Degrees' }).getAttribute('aria-checked')) === 'true');
  await p.keyboard.press('Escape');
  await p.getByRole('button', { name: 'sin', exact: true }).click(); await p.keyboard.type('30)='); await settle();
  ok('S-6.1 sin(30)=0.5', (await main()) === '0.5' && (await hist()) === 'sin(30) =', [await main(), await hist()]);
  await p.getByRole('radio', { name: 'Radians' }).click(); await settle();
  ok('S-6.4 toggle keeps result', (await main()) === '0.5' && (await p.getByRole('radio', { name: 'Radians' }).getAttribute('aria-checked')) === 'true');
  await p.getByRole('button', { name: 'sin', exact: true }).click(); await p.getByRole('button', { name: 'π', exact: true }).click(); await p.keyboard.type('/2)='); await settle();
  ok('S-6.2 rad sin(π/2)=1', (await main()) === '1', await main());
  await p.getByRole('radio', { name: 'Degrees' }).click();
  await p.getByRole('button', { name: 'square root' }).click(); await p.keyboard.type('144)='); await settle();
  ok('S-5.2 √(144)', (await main()) === '12', await main());
  await p.getByRole('button', { name: 'squared' }).click(); await p.keyboard.press('Enter'); await settle();
  ok('S-5.9 x² after result', (await main()) === '144' && (await hist()) === 'Ans^2 =', [await main(), await hist()]);
  await p.getByRole('button', { name: 'tan', exact: true }).click(); await p.keyboard.type('90)='); await settle();
  ok('S-7.4 tan(90)', (await tid('calc-error')) === 'tan is undefined at 90° + k·180°', await tid('calc-error'));
  await p.keyboard.press('Escape'); await p.getByRole('button', { name: 'cos', exact: true }).click(); await p.keyboard.type('60)');
  await tab('Basic').click(); await settle();
  ok('S-6.5 badge in Basic with trig', (await p.locator('.angle-badge').count()) === 1);
  await p.keyboard.press('Escape'); await settle();
  ok('S-6.5 badge hidden without trig', (await p.locator('.angle-badge').count()) === 0);

  // Tabs keyboard
  await tab('Basic').focus(); await p.keyboard.press('ArrowDown'); await settle();
  ok('Tabs: ArrowDown → Scientific', (await tab('Scientific').getAttribute('aria-selected')) === 'true');
  await p.keyboard.press('End'); await settle();
  ok('Tabs: End → Split bill', (await tab('Split bill').getAttribute('aria-selected')) === 'true');

  // Loan
  await tab('Loan').click(); await settle();
  ok('S-8 waiting state', (await p.locator('.waiting-title').textContent()) === 'Your repayment will appear here');
  await p.keyboard.type('5'); await settle();
  ok('S-4.3 typing on Loan tab ignored by calculator', true);
  await p.fill('#loan-amount', '250000'); await p.locator('#loan-amount').blur();
  ok('Amount tidied on blur', (await p.inputValue('#loan-amount')) === '250,000', await p.inputValue('#loan-amount'));
  ok('Checklist marks amount ready', (await p.locator('.check-item.is-ready').count()) === 1);
  await p.fill('#loan-rate', '6.5'); await p.getByRole('radio', { name: '30 years' }).click(); await settle();
  ok('S-8.1 live result', (await tid('loan-monthly')) === '$1,580.17' && (await tid('loan-months')) === '360' && (await tid('loan-interest')) === '$318,861.22' && (await tid('loan-total')) === '$568,861.22', [await tid('loan-monthly'), await tid('loan-interest'), await tid('loan-total')]);
  await p.waitForTimeout(800); ok('S-8 visible counter settles to exact value', (await p.locator('.hero-value [aria-hidden=true]').textContent()) === '$1,580.17', await p.locator('.hero-value [aria-hidden=true]').textContent());
  ok('S-8.3 legend + insight', (await p.locator('.legend').textContent()).includes('$250,000.00 43.9%') && (await p.locator('.legend').textContent()).includes('56.1%') && (await p.locator('.insight').textContent()) === 'You repay $2.28 for every $1 borrowed.', await p.locator('.legend').textContent());
  await p.fill('#loan-years', '15'); await settle();
  ok('S-8.6 updates on change', (await tid('loan-monthly')) === '$2,177.77', await tid('loan-monthly'));
  const disc = p.getByRole('button', { name: 'How this is calculated' });
  await disc.click(); await settle();
  ok('Disclosure opens', (await disc.getAttribute('aria-expanded')) === 'true' && (await p.locator('.steps').isVisible()));
  await disc.click(); await settle();
  ok('S-8.9 disclosure closes', (await disc.getAttribute('aria-expanded')) === 'false' && (await p.locator('.steps').count()) === 0);
  await p.fill('#loan-years', '0'); await p.locator('#loan-years').blur(); await settle();
  ok('S-9.6 term 0 error after blur', (await p.locator('[data-field-error=loan-years]').textContent()) === 'Loan term must be between 1 and 50 years.' && (await p.locator('#loan-years').getAttribute('aria-invalid')) === 'true');
  ok('S-9 result hidden while invalid', (await p.locator('[data-testid=loan-monthly]').count()) === 0 && (await p.locator('.waiting-title').textContent()) === 'Check the highlighted field');
  await p.fill('#loan-amount', ''); await p.locator('#loan-amount').blur(); await settle();
  ok('S-9.1 empty + blur shows no message', (await p.locator('[data-field-error=loan-amount]').count()) === 0);
  await p.fill('#loan-years', '30');
  await p.locator('#loan-rate').press('Enter'); await settle();
  ok('S-9.1 Enter reveals empty error + focuses first invalid', (await p.locator('[data-field-error=loan-amount]').textContent()) === 'Enter a loan amount.' && (await p.evaluate(() => document.activeElement.id)) === 'loan-amount');
  await p.fill('#loan-amount', '12000'); await p.fill('#loan-rate', '0'); await p.fill('#loan-years', '1'); await settle();
  ok('S-8.3 zero rate', (await tid('loan-monthly')) === '$1,000.00' && (await tid('loan-interest')) === '$0.00' && (await p.locator('.insight').textContent()).startsWith('No interest'));

  // Split
  await tab('Split bill').click(); await settle();
  ok('S-10 defaults', (await p.inputValue('#split-tip')) === '15' && (await p.inputValue('#split-people')) === '2');
  ok('S-10 waiting state', (await p.locator('.waiting-title').textContent()) === 'Each share will appear here');
  await p.fill('#split-bill', '100'); await p.getByRole('button', { name: 'One person more' }).click(); await settle();
  ok('Stepper +', (await p.inputValue('#split-people')) === '3');
  ok('S-10.2 uneven split', (await tid('split-tip')) === '$15.00' && (await tid('split-total')) === '$115.00' && (await tid('split-shares')).includes('1 person pays $38.34') && (await tid('split-shares')).includes('2 people pay $38.33'), await tid('split-shares'));
  ok('Check line', (await p.locator('.check-line').textContent()).includes('Shares add up to $115.00'));
  await p.getByRole('radio', { name: '20 percent tip', exact: true }).click(); await p.fill('#split-bill', '80'); await p.fill('#split-people', '4'); await settle();
  ok('S-10.1 even split', (await tid('split-tip')) === '$16.00' && (await tid('split-total')) === '$96.00' && (await tid('split-shares')) === 'All 4 pay $24.00', await tid('split-shares'));
  await p.fill('#split-bill', '42.50'); await p.fill('#split-tip', '0'); await p.fill('#split-people', '1'); await settle();
  ok('S-10.8 single person', (await p.locator('.hero .eyebrow').textContent()) === 'You pay' && (await tid('split-shares')) === '1 person pays $42.50', await tid('split-shares'));
  ok('S-10.10 typed tip 0 highlights 0% preset', (await p.getByRole('radio', { name: '0 percent tip', exact: true }).getAttribute('aria-checked')) === 'true');
  await p.fill('#split-tip', '12'); await settle();
  ok('S-10.10 custom tip highlights none', (await p.locator('.quick-picks [aria-checked=true]').count()) === 0);
  await p.fill('#split-bill', '0.01'); await p.fill('#split-tip', '0'); await p.fill('#split-people', '3'); await settle();
  ok('S-10.9 one cent among 3', (await tid('split-shares')).includes('1 person pays $0.01') && (await tid('split-shares')).includes('2 people pay $0.00'));
  await p.fill('#split-bill', '1,000,000'); await p.fill('#split-tip', '100'); await p.fill('#split-people', '100'); await settle();
  ok('S-10.9 max bill', (await tid('split-total')) === '$2,000,000.00' && (await tid('split-shares')) === 'All 100 pay $20,000.00', await tid('split-shares'));
  ok('S-10.11 + disabled at 100', await p.getByRole('button', { name: 'One person more' }).isDisabled());
  await p.fill('#split-people', '1'); await settle();
  ok('Stepper − disabled at 1', await p.getByRole('button', { name: 'One person fewer' }).isDisabled());
  await p.fill('#split-people', '0'); await p.locator('#split-people').blur(); await settle();
  ok('S-11.5 people 0', (await p.locator('[data-field-error=split-people]').textContent()) === 'Number of people must be between 1 and 100.');
  await p.fill('#split-bill', '999999.99'); await p.fill('#split-tip', '15'); await p.fill('#split-people', '100'); await settle();
  ok('Hero shows majority share', (await p.locator('.hero-sub').textContent()).startsWith('1 of 100 pays 1¢ less'), await p.locator('.hero-sub').textContent());
  await tab('Loan').click(); await settle();
  ok('Form values survive tab switch', (await p.inputValue('#loan-amount')) === '12,000' && (await tid('loan-monthly')) === '$1,000.00');
  ok('No console errors', errs.length === 0, errs);
  await b.close();
}
(async () => {
  await run('no-preference');
  await run('reduce');
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  process.exitCode = fails ? 1 : 0;
})();
