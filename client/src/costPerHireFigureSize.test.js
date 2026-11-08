/**
 * client/src/costPerHireFigureSize.test.js — the COST-PER-HIRE card's figure can never be truncated,
 * asserted without a browser.
 *
 * THE DEFECT THIS FILE EXISTS TO STOP (measured on a rendered screen at `08b5d41a`, the deployed
 * revision, seeded scratch DB, bundle `index-DRe-a8p3.js`): at 1024x768 the card's inner box was 108 px
 * and it carried 198 px of content in a 156 px box — the figure ran 65.53 px (AE) / 65.98 px (SA) past
 * the card's inner right edge and painted across the neighbouring card. At 1280x576 it ran 1.53 px /
 * 1.98 px past and the currency code dropped to a second line. With a 12-character figure in the same
 * scratch DB it overflowed at every width (52 / 116 / 12 px past at 1280 / 1024 / 1440). The figure is
 * a headline cost metric, so the fix shrinks the type rather than the number: never a rounded,
 * abbreviated or elided figure, and never a dropped fils.
 *
 * Two halves, and the second is the one a module test alone cannot see:
 *
 *   1. THE ARITHMETIC (`costPerHireFigureSize.js`): the coefficient it returns must leave the WHOLE ROW
 *      — market mark, figure and currency code — inside the card's inner box at every width the
 *      dashboard is used at. The glyph width is the MEASURED one for this card's own family and weight
 *      (0.6169 em per character for the demo's figure, 0.6281 for a digit-heavy one), and the module
 *      sizes for 0.64 with the row's 2.23 em of fixed overhead included.
 *
 *   2. THE WIRING (a source scan over `App.tsx`): the card is a size container, both market rows render
 *      through `CostPerHireFigure`, the pre-fix row shape is gone, and the row's relative sizes are the
 *      module's own constants. The scan is proven by MUTATION — each pre-fix shape is put back and the
 *      scan must redden — and the substitution is asserted to have applied, so the control cannot go
 *      quiet when an anchor moves.
 */
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { costPerHireFigureFontSize, COST_PER_HIRE_ROW_EM } from './costPerHireFigureSize.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(path.join(here, 'App.tsx'), 'utf8');

// The measured glyph width of THIS card's figure (Cairo, weight 800), read off the rendered product at
// 08b5d41a: `7,813.00` = 148.05 px at 30 px = 0.6169 em/char, `1,234,567.00` = 222.06 px = 0.6168,
// `123,456,789.01` = 263.81 px = 0.6281. The EOSB card's 0.633 is a DIFFERENT string's ratio.
const EM_PER_CHARACTER = 0.6169;
const DESIGN_BOUND = 0.64;
// The row's fixed overhead, in em of the figure, from the same measurements:
//   market mark 0.4em x 1.495 (`SA` at weight 400) = 0.598
//   two gaps    2 x 0.27                            = 0.540
//   currency    0.47em x 2.288 (`AED` at weight 700) = 1.075
const OVERHEAD_MEASURED = 2.213;
const OVERHEAD_DESIGN = 2.23;
// The card's inner box, measured on the rendered dashboard at 08b5d41a (2026-11-08).
const MEASURED_INNER_WIDTHS = [
  { viewport: '1024x768', inner: 108 },
  { viewport: '1280x576', inner: 172 },
  { viewport: '1440x900', inner: 212 },
];

/** Parse `clamp(<min>, <cqw>cqw, <max>)` into numbers; throws if the shape is not what we emit. */
function parseClamp(value) {
  const m = /^clamp\(([\d.]+)rem, ([\d.]+)cqw, ([\d.]+)rem\)$/.exec(value);
  assert.ok(m, `not a clamp of the documented shape: ${value}`);
  return { minRem: Number(m[1]), cqw: Number(m[2]), maxRem: Number(m[3]) };
}

/** The rendered font-size this helper produces inside a card of `inner` px, in px. */
function fontSizePx(value, inner) {
  const { minRem, cqw, maxRem } = parseClamp(value);
  const px = (cqw / 100) * inner;
  return Math.min(Math.max(px, minRem * 16), maxRem * 16);
}

// Figures from a small demo to a large client. 13 characters is the module's documented bound.
const FIGURES = ['999.00', '7,813.00', '4,750.00', '1,234,567.00', '12,345,678.90'];

test('the whole row fits the card inner box at every measured width, with room to spare', () => {
  for (const figure of FIGURES) {
    const value = costPerHireFigureFontSize(figure);
    for (const { viewport, inner } of MEASURED_INNER_WIDTHS) {
      const px = fontSizePx(value, inner);
      // what the browser will actually paint, using the measured glyph width and the measured overhead
      const painted = (EM_PER_CHARACTER * figure.length + OVERHEAD_MEASURED) * px;
      const worstCase = (DESIGN_BOUND * figure.length + OVERHEAD_DESIGN) * px;
      assert.ok(
        painted <= inner,
        `${figure} at ${viewport}: painted ${painted.toFixed(1)}px in a ${inner}px box (font ${px.toFixed(1)}px)`,
      );
      assert.ok(
        worstCase <= inner,
        `${figure} at ${viewport}: design bound ${worstCase.toFixed(1)}px in a ${inner}px box`,
      );
    }
  }
});

test('the row overhead the module exports is the overhead this arithmetic assumes', () => {
  const measured = COST_PER_HIRE_ROW_EM.marketMark * 1.495 // `SA` at weight 400, per em of its own size
    + 2 * COST_PER_HIRE_ROW_EM.gap
    + COST_PER_HIRE_ROW_EM.currency * 2.288; // `AED` at weight 700
  assert.ok(
    Math.abs(measured - OVERHEAD_MEASURED) < 0.02,
    `the row's em overhead is now ${measured.toFixed(3)}, the arithmetic assumes ${OVERHEAD_MEASURED}`,
  );
  assert.ok(OVERHEAD_DESIGN >= measured, 'the design overhead must not be below the measured one');
});

test('the defect that started this: the 30px row no longer overflows, at 1024 or at 1280', () => {
  // Pre-fix, measured: 30px type, the figure alone 148.05 px wide in a 108 px row at 1024x768, and the
  // card carried 174 px of row content in a 108 px box.
  const preFixFigureAt30 = EM_PER_CHARACTER * '7,813.00'.length * 30;
  assert.ok(preFixFigureAt30 > 108, 'the 30px baseline this replaces did overflow the 1024 box');
  // ...and at 1280x576 the row was 17.94 (the market mark at 12px) + 8 (gap) + 148.05 = 173.99 px in a
  // 172 px box: 1.99 px past, which is what dropped the currency code to a second line.
  assert.ok(17.94 + 8 + preFixFigureAt30 > 172, 'and it overflowed 1280 too');

  for (const figure of ['7,813.00', '1,234,567.00']) {
    const value = costPerHireFigureFontSize(figure);
    const at1024 = fontSizePx(value, 108);
    const at1280 = fontSizePx(value, 172);
    const at1440 = fontSizePx(value, 212);
    for (const px of [at1024, at1280, at1440]) {
      assert.ok(px >= 10, `${figure}: ${px.toFixed(1)}px is below the legibility floor`);
      assert.ok(px <= 30, `${figure}: ${px.toFixed(1)}px exceeds the card's own headline size`);
    }
    assert.ok((EM_PER_CHARACTER * figure.length + OVERHEAD_MEASURED) * at1024 <= 108);
    assert.ok((EM_PER_CHARACTER * figure.length + OVERHEAD_MEASURED) * at1280 <= 172);
    assert.ok((EM_PER_CHARACTER * figure.length + OVERHEAD_MEASURED) * at1440 <= 212);
  }
});

test('the documented 13-character bound holds at every measured width', () => {
  for (let characters = 6; characters <= 13; characters += 1) {
    const figure = '1'.repeat(characters);
    const px = fontSizePx(costPerHireFigureFontSize(figure), 108);
    const painted = (EM_PER_CHARACTER * characters + OVERHEAD_MEASURED) * px;
    assert.ok(painted <= 108, `${characters} characters paint ${painted.toFixed(1)}px in the 108px box`);
  }
});

test('a longer figure never gets a bigger coefficient, and short figures are capped at the card size', () => {
  let previous = Infinity;
  for (let characters = 6; characters <= 20; characters += 1) {
    const { cqw } = parseClamp(costPerHireFigureFontSize('1'.repeat(characters)));
    assert.ok(cqw <= previous, `coefficient rose from ${previous} to ${cqw} at ${characters} characters`);
    assert.ok(cqw <= 15, `${cqw}cqw exceeds the cap`);
    if (100 / (0.64 * characters + OVERHEAD_DESIGN) <= 15) {
      const required = 100 / (DESIGN_BOUND * characters + OVERHEAD_DESIGN);
      assert.ok(cqw >= required - 0.1, `${cqw}cqw is below the fit requirement at ${characters} characters`);
    }
    previous = cqw;
  }
  assert.strictEqual(parseClamp(costPerHireFigureFontSize('999.00')).cqw, 15);
});

test('the helper only ever sizes the type — it cannot round, abbreviate or elide the figure', () => {
  const value = costPerHireFigureFontSize('1,234,567.00');
  assert.match(value, /^clamp\(0\.625rem, [\d.]+cqw, 1\.875rem\)$/);
  for (const forbidden of ['K', 'M', '…', '...', 'overflow', 'ellipsis', 'text-overflow']) {
    assert.ok(!value.includes(forbidden), `the size rule carries ${forbidden}`);
  }
});

/** Violations of the card's shape in a given App.tsx source. Empty array = the fix is in place. */
function scanCard(source) {
  const start = source.indexOf('{/* Cost-per-Hire */}');
  const end = source.indexOf('{/* EOSB Liability */}');
  assert.ok(start > 0 && end > start, 'the Cost-per-Hire card block could not be located in App.tsx');
  const block = source.slice(start, end);
  const violations = [];
  if (!block.includes('@container')) violations.push('the card is not a size container (@container)');
  for (const [market, currency] of [['AE', 'AED'], ['SA', 'SAR']]) {
    const wanted = `<CostPerHireFigure market="${market}" currency="${currency}" figure={formatAmount(analytics.avgCostPerHire${market})} />`;
    if (!block.includes(wanted)) violations.push(`${market} row does not render through CostPerHireFigure`);
  }
  if (block.includes('flex items-baseline space-x-2')) violations.push('the pre-fix row shape is back');
  if (!/const CostPerHireFigure = \(\{ market, currency, figure \}/.test(source)) {
    violations.push('CostPerHireFigure is not defined');
  }
  if (!source.includes("from './costPerHireFigureSize.js'")) violations.push('App.tsx does not import the sizing rule');
  if (!source.includes('COST_PER_HIRE_ROW_EM.marketMark') || !source.includes('COST_PER_HIRE_ROW_EM.currency')) {
    violations.push('the row is not laid out with the module\'s own em constants');
  }
  return violations;
}

// The pre-fix row's class attribute, assembled from parts on purpose: this file carries no `@source`
// declaration, and tailwindSources.test.js reddens on any file outside the scanned set that contains a
// literal class attribute - so the control writes the shape without writing the attribute.
const PRE_FIX_ROW_ATTRIBUTE = 'class' + 'Name=' + '"flex items-baseline space-x-2"';

/** Apply a mutation INSIDE this card's block only — two cards are size containers, and a whole-source
 *  replace of `@container ` would aim at whichever comes first in the file rather than at this one. */
function mutateInCard(source, from, to) {
  const start = source.indexOf('{/* Cost-per-Hire */}');
  const end = source.indexOf('{/* EOSB Liability */}');
  assert.ok(start > 0 && end > start, 'the Cost-per-Hire card block could not be located in App.tsx');
  const block = source.slice(start, end);
  assert.ok(block.includes(from), `anchor not found inside the Cost-per-Hire card block: ${from}`);
  return source.slice(0, start) + block.replace(from, to) + source.slice(end);
}

test('App.tsx renders the cost-per-hire figure through the sizing rule', () => {
  assert.deepStrictEqual(scanCard(appSource), []);
});

test('the scan reddens on a reverted card (the guard is load-bearing)', () => {
  const mutations = [
    { name: 'the size container is dropped', from: '@container ', to: '', inCard: true },
    {
      name: 'the AE row is rendered bare',
      from: '<CostPerHireFigure market="AE" currency="AED" figure={formatAmount(analytics.avgCostPerHireAE)} />',
      to: '{formatAmount(analytics.avgCostPerHireAE)}',
    },
    { name: 'the sizing rule stops being imported', from: "import { costPerHireFigureFontSize, COST_PER_HIRE_ROW_EM } from './costPerHireFigureSize.js';", to: '' },
    {
      name: 'the row is laid out with hard-coded sizes again',
      from: 'style={{ fontSize: `${COST_PER_HIRE_ROW_EM.currency}em`',
      to: 'style={{ fontSize: `0.47em`',
    },
    {
      name: 'the pre-fix row shape comes back',
      from: '<CostPerHireFigure market="SA" currency="SAR"',
      to: '<div ' + PRE_FIX_ROW_ATTRIBUTE + '><CostPerHireFigure market="SA" currency="SAR"',
    },
  ];
  for (const mutation of mutations) {
    let mutated;
    if (mutation.inCard) {
      mutated = mutateInCard(appSource, mutation.from, mutation.to);
    } else {
      assert.ok(appSource.includes(mutation.from), `anchor not found for: ${mutation.name}`);
      mutated = appSource.replace(mutation.from, mutation.to);
    }
    assert.notStrictEqual(mutated, appSource, `mutation did not apply: ${mutation.name}`);
    const violations = scanCard(mutated);
    assert.ok(violations.length >= 1, `the scan stayed green on: ${mutation.name}`);
  }
});
