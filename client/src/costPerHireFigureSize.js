/**
 * HOW BIG THE COST-PER-HIRE CARD'S FIGURE IS ALLOWED TO BE — and why it is a computation, not a class.
 *
 * THE SAME RULING THAT SIZED THE EOSB CARD (#382, 2026-11-08) APPLIES ONE CARD OVER: the number is
 * the product. A figure that reads `1,234,5…`, or `1.2M`, or loses its fils to make the box happy, is
 * a worse defect than the clipping it would fix. So the type gets smaller instead, and it gets smaller
 * against the only width that matters: the CARD'S OWN INNER BOX, which is a quarter of the content
 * column and changes with the viewport (measured on the dashboard at 08b5d41a: 172 px at 1280x576,
 * 108 px at 1024x768, 212 px at 1440x900 — the same inner widths the EOSB card measures, because both
 * cards are cells of one four-column md grid).
 *
 * THE DEFECT, measured on a rendered screen at 08b5d41a (the deployed revision, seeded scratch DB,
 * both markets): at 1024x768 the card carried 198 px of content in a 156 px box and the figure ran
 * 65.53 px (AE) / 65.98 px (SA) past the card's inner right edge — across the neighbouring card's
 * border. At 1280x576 it ran 1.53 px (AE) / 1.98 px (SA) past, with the currency code dropping to a
 * second line. With a 12-character figure written to the same scratch DB the card overflowed at EVERY
 * width: 52 px past at 1280, 116 px at 1024, 12 px at 1440.
 *
 * WHY A VIEWPORT UNIT WOULD BE WRONG: the sidebar is a fixed 256 px, so the card's width does not track
 * the window proportionally. The card carries `@container` (`container-type: inline-size`), so `cqw` is
 * exactly 1% of that inner box and one rule holds at every width.
 *
 * WHY THE LENGTH OF THE FIGURE IS PART OF IT: one fixed coefficient cannot serve both `999.00` and
 * `1,234,567.00`. The type would either be needlessly small for a small figure or overflow for a large
 * one — and this figure is an average over headcount, so it grows with the client.
 *
 * WHAT WAS MEASURED FOR *THIS* FIGURE, rather than copied from the EOSB card. The two cards do not share
 * a glyph width, and assuming they did would have been the lazy half of this fix: the EOSB rule sizes for
 * 0.633 em per character (its figure is a sum, with more digits between its commas). This card's figure
 * was measured in the rendered product at 08b5d41a — offscreen spans in the card's own family and weight
 * (Cairo, weight 800, the extrabold weight), read at two sizes to show the ratio is linear:
 *
 *   `7,813.00`       (8 ch)  148.05 px at 30 px = 0.6169 em/char   78.95 px at 16 px = 0.6168
 *   `1,234,567.00`  (12 ch)  222.06 px at 30 px = 0.6168 em/char  118.44 px at 16 px = 0.6169
 *   `123,456,789.01`(14 ch)  263.81 px at 30 px = 0.6281 em/char  140.70 px at 16 px = 0.6281
 *
 * Digit-heavy figures are wider per character than comma-heavy ones, so the module sizes for a
 * deliberate upper bound of **0.64 em per character** — the same conservative bound #382 chose, which
 * covers the 0.6281 measured above with ~2% to spare.
 *
 * THE ROW IS NOT ONLY THE FIGURE. Unlike the EOSB figure, this one is a row: a market mark (`AE`/`SA`),
 * the figure, and a currency code (`AED`/`SAR`). Each of those is sized in `em` of the figure, so the
 * whole row scales as one unit and the requirement is a constant, independent of the viewport:
 *
 *   market mark  0.4 em   (`AE` 1.317 em at its own size -> 0.527 em; `SA` 1.495 -> 0.598 em)
 *   two gaps     0.27 em each
 *   currency     0.47 em  (`AED` at weight 700 is 2.288 em of its own size -> 1.075 em)
 *   ------------------------------------------------------------------------------------------
 *   fixed overhead  ≈ 2.21 em, sized for 2.23
 *
 *   width ≈ (0.64 * n + 2.23) * F,  F = c/100 * inner      =>      c ≤ 100 / (0.64n + 2.23)
 *
 * `c` is capped at 15 so a short figure never grows past the 1.875rem (30 px) this figure already
 * carried at 1440x900, and clamped at 0.625rem so an absurdly narrow box degrades to small type rather
 * than to nothing. Neither bound truncates: the figure string is never touched here, and no utility
 * class name is written in this file — it is not a scanned source, so a class token here would name a
 * utility nobody emits.
 *
 * THE BOUND, stated rather than implied: at every one of the three measured inner widths this rule keeps
 * a figure of up to **13 characters** inside the box. The demo's own figure is 8 characters and the
 * million-scale one measured on screen is 12. A 14-character figure reaches the 0.625rem floor in the
 * 108 px box and would exceed it by ~0.5 px; that is the floor's limit, not the rule's, and the test
 * asserts the 13-character bound rather than claiming more.
 */
export function costPerHireFigureFontSize(formattedAmount) {
  const characters = String(formattedAmount).length;
  // 100 / (0.64n + 2.23), floored to a tenth of a per cent, capped at the card's own headline size.
  const cqw = Math.min(15, Math.floor((100 / (0.64 * characters + 2.23)) * 10) / 10);
  return `clamp(0.625rem, ${cqw}cqw, 1.875rem)`;
}

/** The three relative sizes the row is laid out with, in `em` of the figure's own font size. */
export const COST_PER_HIRE_ROW_EM = Object.freeze({
  marketMark: 0.4,
  currency: 0.47,
  gap: 0.27,
});
