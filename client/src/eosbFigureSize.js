/**
 * HOW BIG THE EOSB CARD'S FIGURE IS ALLOWED TO BE — and why it is a computation rather than a class.
 *
 * THE OWNER'S RULING (2026-11-08): the number is the product. A figure that reads `AED 173,1…`, or
 * `AED 173K`, or loses its fils to make the box happy, is a worse defect than the clipping it would
 * fix. So the type gets smaller instead, and it gets smaller against the only width that matters:
 * the CARD'S OWN INNER BOX, which is a quarter of the content column and changes with the viewport
 * (measured on the dashboard at a4e9174: 172 px at 1280x576, 108 px at 1024x768, 212 px at 1440x900).
 *
 * A viewport unit (`vw`) would be wrong here — the sidebar is a fixed 256 px, so the card's width
 * does not track the window proportionally. The card carries `@container` (`container-type:
 * inline-size`), so `cqw` is exactly 1% of that inner box and the same rule holds at every width.
 *
 * WHY THE LENGTH OF THE FIGURE IS PART OF IT: one fixed coefficient cannot serve both `999.00` and
 * `123,456,789.01`. The type would either be needlessly small for a small figure or overflow for a
 * large one — and this figure is clock-derived and grows with headcount, so "large" is not
 * hypothetical. Measured in the rendered product (Inter/system stack, weight 800, at 24.08 px):
 * `173,128.34` is 152.33 px wide, i.e. **0.633 em per character**; `1,234,682.06` is 178.23 px,
 * 0.617 em. This module sizes for a deliberate upper bound of 0.64 em per character and leaves ~4%
 * of the inner box unused, so a figure cannot run past the card's padding edge.
 *
 *   width ≈ 0.64 * n * F,  F = c/100 * inner      =>      c ≤ 150 / n   (per cent of the container)
 *
 * `c` is capped at 15 so a short figure never grows past the 1.875rem (30 px) the figure already
 * carried before this fix (measured 30 px at weight 800 on a4e9174), and the result is clamped at
 * 0.625rem so an absurdly narrow box degrades to small type rather than to nothing. Neither bound
 * truncates: the figure string is never touched here, and no utility class name is written in this
 * file — it is not a scanned source, so a class token here would name a utility nobody emits.
 */
export function eosbFigureFontSize(formattedAmount) {
  const characters = String(formattedAmount).length;
  // 150 / n, floored to a tenth of a per cent, capped at the card's own headline size.
  const cqw = Math.min(15, Math.floor((150 / characters) * 10) / 10);
  return `clamp(0.625rem, ${cqw}cqw, 1.875rem)`;
}
