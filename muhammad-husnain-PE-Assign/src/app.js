// DOM wiring. All calculation and validation lives in ./lib and is unit tested;
// this file only turns events into calls and results into markup.

import { reduce, initialState } from './lib/calculatorState.js';
import { calculateLoanFromForm } from './lib/loan.js';
import { splitBillFromForm } from './lib/billSplit.js';
import { formatCents } from './lib/format.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/* ---------- Tabs ---------- */

let activeTab = 'basic';

function selectTab(name) {
  activeTab = name;
  for (const tab of $$('[role="tab"]')) {
    const selected = tab.dataset.tab === name;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  const isCalculator = name === 'basic' || name === 'scientific';
  $('#panel-calculator').hidden = !isCalculator;
  $('#panel-calculator').setAttribute('aria-labelledby', `tab-${isCalculator ? name : 'basic'}`);
  $('#panel-loan').hidden = name !== 'loan';
  $('#panel-split').hidden = name !== 'split';
  $('#scientific-keys').hidden = name !== 'scientific';
  renderCalculator();
}

function setUpTabs() {
  const tabs = $$('[role="tab"]');
  for (const tab of tabs) {
    tab.addEventListener('click', () => selectTab(tab.dataset.tab));
    tab.addEventListener('keydown', (event) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (!step) return;
      const index = (tabs.indexOf(tab) + step + tabs.length) % tabs.length;
      tabs[index].focus();
      selectTab(tabs[index].dataset.tab);
    });
  }
}

/* ---------- Basic / Scientific calculator ---------- */

let calcState = initialState;

function dispatch(action) {
  calcState = reduce(calcState, action);
  renderCalculator();
}

const prettify = (text) => text.replace(/-/g, '−');

function renderCalculator() {
  const { status, expression, resultText, lastExpression, message, angleMode } = calcState;
  const scientific = activeTab === 'scientific';
  const usesAngles = /sin|cos|tan/.test(status === 'result' ? lastExpression : expression);

  $('#main-display').textContent = status === 'result' ? resultText : prettify(expression) || '0';
  $('#history').textContent = status === 'result' ? `${prettify(lastExpression)} =` : '';
  $('#calc-error').textContent = status === 'error' ? message : '';
  $('#main-display').classList.toggle('has-error', status === 'error');

  const angleLabel = angleMode.toUpperCase();
  const indicator = $('#angle-indicator');
  indicator.textContent = angleLabel;
  indicator.hidden = !scientific && !usesAngles;
  $('#angle-toggle').textContent = angleMode === 'deg' ? 'DEG → RAD' : 'RAD → DEG';
}

function setUpCalculator() {
  $('#panel-calculator').addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.insert !== undefined) dispatch({ type: 'input', text: button.dataset.insert });
    else if (button.dataset.action) dispatch({ type: button.dataset.action });
  });

  const keyToText = { '*': '×', x: '×', X: '×', '/': '÷' };
  document.addEventListener('keydown', (event) => {
    if (activeTab !== 'basic' && activeTab !== 'scientific') return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target instanceof HTMLInputElement) return;

    const { key } = event;
    let action = null;
    if (/^[0-9.+\-^%!()]$/.test(key)) action = { type: 'input', text: key };
    else if (key in keyToText) action = { type: 'input', text: keyToText[key] };
    else if (key === 'Enter' || key === '=') action = { type: 'evaluate' };
    else if (key === 'Backspace') action = { type: 'backspace' };
    else if (key === 'Escape' || key === 'Delete') action = { type: 'clear' };
    if (!action) return;

    event.preventDefault(); // stops "/" opening Firefox quick find and Enter re-clicking a focused key
    dispatch(action);
  });
}

/* ---------- Forms (loan and bill split) ---------- */

function showFieldErrors(form, failure) {
  for (const errorEl of $$('[data-field-error]', form)) {
    const field = errorEl.dataset.fieldError;
    const input = form.elements[field];
    const message = failure && failure.field === field ? failure.message : '';
    errorEl.textContent = message;
    input.setAttribute('aria-invalid', String(Boolean(message)));
    if (message) input.focus();
  }
}

function setUpLoan() {
  const form = $('#loan-form');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const outcome = calculateLoanFromForm({
      amount: form.elements.amount.value,
      rate: form.elements.rate.value,
      years: form.elements.years.value,
    });
    const resultEl = $('#loan-result');
    if (!outcome.ok) {
      showFieldErrors(form, outcome);
      resultEl.hidden = true;
      return;
    }
    showFieldErrors(form, null);
    const loan = outcome.value;
    $('#loan-monthly').textContent = formatCents(loan.monthlyPaymentCents);
    $('#loan-months').textContent = String(loan.months);
    $('#loan-interest').textContent = formatCents(loan.totalInterestCents);
    $('#loan-total').textContent = formatCents(loan.totalPaidCents);
    resultEl.hidden = false;
  });
}

/** One line per group: "$24.00", or "1 person pays $38.34" / "2 people pay $38.33". */
function renderShares(container, shares) {
  const lines = shares.length === 1
    ? [formatCents(shares[0].amountCents)]
    : shares.map(({ people, amountCents }) => `${people} ${people === 1 ? 'person pays' : 'people pay'} ${formatCents(amountCents)}`);
  container.replaceChildren(
    ...lines.map((line) => {
      const span = document.createElement('span');
      span.className = 'share-line';
      span.textContent = line;
      return span;
    }),
  );
}

function setUpSplit() {
  const form = $('#split-form');
  for (const preset of $$('[data-tip]', form)) {
    preset.addEventListener('click', () => {
      form.elements.tip.value = preset.dataset.tip;
    });
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const outcome = splitBillFromForm({
      bill: form.elements.bill.value,
      tip: form.elements.tip.value,
      people: form.elements.people.value,
    });
    const resultEl = $('#split-result');
    if (!outcome.ok) {
      showFieldErrors(form, outcome);
      resultEl.hidden = true;
      return;
    }
    showFieldErrors(form, null);
    const split = outcome.value;
    $('#split-tip-amount').textContent = formatCents(split.tipCents);
    $('#split-total').textContent = formatCents(split.totalCents);
    renderShares($('#split-shares'), split.shares);
    resultEl.hidden = false;
  });
}

setUpTabs();
setUpCalculator();
setUpLoan();
setUpSplit();
selectTab('basic');
