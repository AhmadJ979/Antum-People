# Antum — Brand Identity System
## Brand Essence
Antum bridges **human insight** with **workforce intelligence**. Our brand is professional yet warm, data-driven yet human-centered. We speak to GCC HR leaders who need compliance confidence AND strategic clarity.
---
## 0. Naming & Wordmark
- **Company / legal brand:** Antum
- **Product name:** Antum People (the platform). Not "Antum HR", not "AntumPeople".
- **Naming rule:** product/platform references → "Antum People"; company/brand references → "Antum".
- **Domains (intended, pending registration):** `antum.ae` (UAE), `antum.me` (global).
- **Contact emails:** `privacy@antum.ae`, `dpo@antum.ae`, `legal@antum.ae` (UAE); `privacy@antum.me` (global).
- **Arabic wordmark:** [TO CONFIRM] — use the Latin "Antum" in Arabic strings until the Arabic wordmark is confirmed. Do not invent a transliteration.
---
## 1. Color Palette
### Primary Palette
| Color | Hex | Usage |
|-------|-----|-------|
| **Deep Teal** | `#0F766E` | Primary brand color. Buttons, headers, key UI elements |
| **Teal** | `#14B8A6` | Interactive states, links, active navigation |
| **Slate 900** | `#0F172A` | Primary text, headings |
| **Slate 600** | `#475569` | Secondary text, metadata |
### Supporting Palette
| Color | Hex | Usage |
|-------|-----|-------|
| **Warm Amber** | `#F59E0B` | Alerts, warnings, retention risk indicators |
| **Coral Red** | `#EF4444` | Offboarding triggers, attrition flags, termination |
| **Success Green** | `#22C55E` | Milestones completed, active employees, healthy KPIs |
| **Sky Blue** | `#3B82F6` | Analytics charts, info callouts, onboarding highlights |
| **Slate 50** | `#F8FAFC` | Page backgrounds, card surfaces |
### Data Visualization Palette
- Primary series: `#0F766E`, `#14B8A6`, `#3B82F6`, `#F59E0B`, `#EF4444`
- Secondary series: `#F97316`, `#8B5CF6`, `#06B6D4`, `#84CC16`, `#EC4899`
---
## 2. Typography
### Primary Font: Inter
Available via Google Fonts. Inter is highly legible at every size, with excellent Arabic/Latin support essential for the GCC market.
### Font Stack
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
font-family: 'Inter Arabic', 'Inter', sans-serif; /* Arabic text variant */
```
### Type Scale
| Level | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| H1 | 32px (2rem) | 700 (Bold) | 1.2 | Page titles, dashboard headings |
| H2 | 24px (1.5rem) | 600 (Semi-Bold) | 1.3 | Section headers |
| H3 | 18px (1.125rem) | 600 (Semi-Bold) | 1.4 | Card headers, modal titles |
| Body | 14px (0.875rem) | 400 (Regular) | 1.5 | Primary reading text, table content |
| Small | 12px (0.75rem) | 400 (Regular) | 1.4 | Labels, captions, metadata |
| Micro | 11px (0.6875rem) | 600 (Semi-Bold) | 1.3 | KPI labels, badge text |
| KPI Value | 36px (2.25rem) | 700 (Bold) | 1.0 | Dashboard metric display |
---
## 3. Logo & Iconography
- **Logomark:** A stylized polyhedron/geometric form representing the "A" of Antum, suggesting data points converging into insight *(logomark initial updated as part of the rename — flagged)*
- **Logotype:** "Antum People" in Inter Bold, deep teal (#0F766E)
- **Iconography:** Lucide icon set — clean, consistent line icons with 1.5px stroke weight
---
## 4. Design Principles
1. **Clarity over density** — Data should be immediately readable, not overwhelming
2. **GCC-first** — Date formats (DD/MM/YYYY), currency (AED, SAR), RTL readiness for Arabic
3. **Progressive disclosure** — Show summary first, drill into details when needed
4. **Actionable insights** — Every chart answers a question; never show data without context
5. **Trust through transparency** — Compliance status indicators, data freshness timestamps
---
## 5. Component Styling Guidelines
| Component | Style |
|-----------|-------|
| Buttons | Rounded-lg (8px), semi-bold, uppercase tracking-wide on small action btns |
| Cards | White bg, subtle shadow (shadow-sm), rounded-xl (12px), 1px slate-100 border |
| Tables | Alternating row bg (slate-50), sticky headers with slate-100 bottom border |
| Inputs | Slate-300 border, rounded-lg, focus ring in teal-500 (0.5px) |
| Modals | Centered, white bg, rounded-2xl, backdrop blur overlay |
| Navigation | Left sidebar in slate-900, active item highlighted with teal accent bar |
| KPIs | Large numeric value, contextual delta indicator (▲ positive / ▼ negative), micro label |
---
## 6. Dashboard Colour Semantics
- **Teal / Green** = Positive trend, on track, healthy
- **Amber** = Warning, attention needed, moderate risk
- **Red** = Critical, off track, high risk
- **Blue** = Neutral information, contextual data
---
*Version 1.1 — Product Designer, Antum*
