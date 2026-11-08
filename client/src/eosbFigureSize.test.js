/**
 * client/src/eosbFigureSize.test.js — the EOSB card's figure can never be truncated, asserted
 * without a browser.
 *
 * THE DEFECT THIS FILE EXISTS TO STOP (measured on a rendered screen, 2026-11-08, seeded scratch
 * instance, bundle `index-BaA8mex4.js` = a4e9174): at 1280x576 the EOSB card's inner box was 172 px
 * and the figure element was 190 px wide — it ran 42.28 px past the card's inner edge and the card
 * carried 239 px of content in a 220 px box. At 1024x768 it ran 106.28 px past, and the whole
 * content column scrolled sideways (818 px in a 768 px box). The figure is the business's headline
 * liability number, so the fix shrinks the type rather than the number: never a rounded, abbreviated
 * or elided figure, and never a dropped fils.
 *
 * Two halves, and the second is the one a module test alone cannot see:
 *
 *   1. THE ARITHMETIC (`eosbFigureSize.js`): the coefficient it returns must leave the figure inside
 *      the card's inner box at every width the dashboard is used at, for figures from thousands to
 *      hundreds of millions. The glyph width is the MEASURED one (0.633 em per character, from
 *      `173,128.34` rendered at 24.08 px), not a guess, and the module sizes for 0.64 with ~4% to
 *      spare.
 *
 *   2. THE WIRING (a source scan over `App.tsx`): the card is a size container, both market rows
 *      render the figure through `EosbFigure`, and the pre-fix row shape is gone. The scan is
 *      proven by MUTATION — the test puts the pre-fix markup back and asserts the scan reddens,
 *      and asserts the substitution happened, so the control cannot go quiet when an anchor moves.
 */
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eosbFigureFontSize } from './eosbFigureSize.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(path.join(here, 'App.tsx'), 'utf8');

// The measured glyph width of this card's figure (weight 800): `173,128.34` = 152.33 px at 24.08 px
// = 0.633 em/char; `1,234,682.06` = 178.23 px = 0.617 em/char. 0.64 is the module's design bound.
const EM_PER_CHARACTER = 0.633;
const DESIGN_BOUND = 0.64;
// The card's inner box, measured on the rendered dashboard at a4e9174 (2026-11-08).
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

// Figures from a small demo to a large client: the card sums every active employee's accrual.
const FIGURES = [
  '999.00',
  '84,925.16',
  '173,128.34',
  '1,234,567.89',
  '12,345,678.90',
  '123,456,789.01',
];

test('the figure fits the card inner box at every measured width, with room to spare', () => {
  for (const figure of FIGURES) {
    const value = eosbFigureFontSize(figure);
    for (const { viewport, inner } of MEASURED_INNER_WIDTHS) {
      const px = fontSizePx(value, inner);
      // what the browser will actually paint, using the measured glyph width and the design bound
      const painted = EM_PER_CHARACTER * figure.length * px;
      const worstCase = DESIGN_BOUND * figure.length * px;
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

test('the defect that started this: 173,128.34 no longer overflows, and 1,234,567.89 does not either', () => {
  // The two readings the before/after pass used: the demo's own figure, and a figure in the millions.
  for (const figure of ['173,128.34', '1,234,567.89']) {
    const value = eosbFigureFontSize(figure);
    const at1280 = fontSizePx(value, 172);
    const at1024 = fontSizePx(value, 108);
    const at1440 = fontSizePx(value, 212);
    // the pre-fix rendering: 30px type, 190px wide in a 172px box
    assert.ok(EM_PER_CHARACTER * figure.length * 30 > 172, 'the 30px baseline this replaces did overflow');
    for (const px of [at1024, at1280, at1440]) {
      assert.ok(px >= 10, `${figure}: ${px.toFixed(1)}px is below the legibility floor`);
      assert.ok(px <= 30, `${figure}: ${px.toFixed(1)}px exceeds the card's own headline size`);
    }
    assert.ok(EM_PER_CHARACTER * figure.length * at1280 <= 172);
    assert.ok(EM_PER_CHARACTER * figure.length * at1024 <= 108);
    assert.ok(EM_PER_CHARACTER * figure.length * at1440 <= 212);
  }
});

test('a longer figure never gets a bigger coefficient, and short figures are capped at the card size', () => {
  let previous = Infinity;
  for (let characters = 6; characters <= 20; characters += 1) {
    const { cqw } = parseClamp(eosbFigureFontSize('1'.repeat(characters)));
    assert.ok(cqw <= previous, `coefficient rose from ${previous} to ${cqw} at ${characters} characters`);
    assert.ok(cqw <= 15, `${cqw}cqw exceeds the cap`);
    // above the cap the requirement is the cap itself; below it, the coefficient must still fit
    if (150 / characters <= 15) {
      assert.ok(cqw >= 150 / characters - 0.1, `${cqw}cqw is below the fit requirement at ${characters} characters`);
    }
    previous = cqw;
  }
  assert.strictEqual(parseClamp(eosbFigureFontSize('999.00')).cqw, 15);
});

test('the helper only ever sizes the type — it cannot round, abbreviate or elide the figure', () => {
  const value = eosbFigureFontSize('1,234,567.89');
  assert.match(value, /^clamp\(0\.625rem, [\d.]+cqw, 1\.875rem\)$/);
  for (const forbidden of ['K', 'M', '…', '...', 'overflow', 'ellipsis', 'text-overflow']) {
    assert.ok(!value.includes(forbidden), `the size rule carries ${forbidden}`);
  }
});

/** Violations of the card's shape in a given App.tsx source. Empty array = the fix is in place. */
function scanCard(source) {
  const start = source.indexOf('{/* EOSB Liability */}');
  const end = source.indexOf('{/* Transition Funnels */}');
  assert.ok(start > 0 && end > start, 'the EOSB card block could not be located in App.tsx');
  const block = source.slice(start, end);
  const violations = [];
  if (!block.includes('@container')) violations.push('the card is not a size container (@container)');
  for (const market of ['AE', 'SA']) {
    if (!block.includes(`<EosbFigure figure={formatAmount(analytics.eosbByJurisdiction.${market})} />`)) {
      violations.push(`${market} row does not render its figure through EosbFigure`);
    }
  }
  if (!/const EosbFigure = \(\{ figure \}/.test(source)) violations.push('EosbFigure is not defined');
  if (!source.includes("from './eosbFigureSize.js'")) violations.push('App.tsx does not import the sizing rule');
  return violations;
}

test('App.tsx renders the EOSB figure through the sizing rule', () => {
  assert.deepStrictEqual(scanCard(appSource), []);
});

/**
 * Apply a mutation INSIDE the EOSB card block only.
 *
 * Added 2026-11-08, when the cost-per-hire card became the SECOND size container in this file: a
 * whole-source `replace('@container ', '')` then aims at whichever card comes first in the file, so
 * the mutation stops testing the EOSB card and the guard stays green on a reverted one. A mutant aimed
 * at the first of two identical strings proves nothing about the second.
 */
function mutateInCard(source, from, to) {
  const start = source.indexOf('{/* EOSB Liability */}');
  const end = source.indexOf('{/* Transition Funnels */}');
  assert.ok(start > 0 && end > start, 'the EOSB card block could not be located in App.tsx');
  const block = source.slice(start, end);
  assert.ok(block.includes(from), `anchor not found inside the EOSB card block: ${from}`);
  return source.slice(0, start) + block.replace(from, to) + source.slice(end);
}

test('the scan reddens on a reverted card (the guard is load-bearing)', () => {
  const mutations = [
    { name: 'the size container is dropped', from: '@container ', to: '', inCard: true },
    { name: 'the AE figure is rendered bare', from: '<EosbFigure figure={formatAmount(analytics.eosbByJurisdiction.AE)} />', to: '{formatAmount(analytics.eosbByJurisdiction.AE)}' },
    { name: 'the sizing rule stops being imported', from: "import { eosbFigureFontSize } from './eosbFigureSize.js';", to: '' },
  ];
  for (const mutation of mutations) {
    const mutated = mutation.inCard
      ? mutateInCard(appSource, mutation.from, mutation.to)
      : (assert.ok(appSource.includes(mutation.from), `anchor not found for: ${mutation.name}`), appSource.replace(mutation.from, mutation.to));
    assert.notStrictEqual(mutated, appSource, `mutation did not apply: ${mutation.name}`);
    const violations = scanCard(mutated);
    assert.ok(violations.length >= 1, `the scan stayed green on: ${mutation.name}`);
  }
});
