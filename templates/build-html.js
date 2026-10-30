#!/usr/bin/env node
// Antum People — Markdown → print-ready HTML builder for the pilot compliance pack.
// No external deps. Usage: node build-html.js
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const DATE = '2026-09-17';

// ---------------- Markdown → HTML (small, dependency-free) ----------------
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function inline(s) {
  s = escapeHtml(s);
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
  return s;
}
function renderTable(rows) {
  const parsed = rows
    .filter(r => !/^\|[\s:|-]+\|$/.test(r))               // drop separator rows
    .map(r => r.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim()));
  if (parsed.length === 0) return '';
  const [head, ...body] = parsed;
  let html = '<table><thead><tr>';
  head.forEach(c => { html += `<th>${inline(c)}</th>`; });
  html += '</tr></thead><tbody>';
  body.forEach(row => {
    html += '<tr>';
    row.forEach(c => { html += `<td>${inline(c)}</td>`; });
    html += '</tr>';
  });
  html += '</tbody></table>';
  return html;
}
function mdToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();
    if (t === '') { i++; continue; }
    if (/^-{3,}$/.test(t)) { out.push('<hr/>'); i++; continue; }
    let m = t.match(/^(#{1,6})\s+(.*)$/);
    if (m) { out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); i++; continue; }
    if (t.startsWith('>')) {
      const q = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        q.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      out.push('<blockquote>' + q.map(inline).join('<br/>') + '</blockquote>');
      continue;
    }
    if (t.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(lines[i].trim());
        i++;
      }
      out.push(renderTable(rows));
      continue;
    }
    if (/^[-*]\s+/.test(t)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push('<li>' + inline(lines[i].trim().replace(/^[-*]\s+/, '')) + '</li>');
        i++;
      }
      out.push('<ul>' + items.join('') + '</ul>');
      continue;
    }
    // Paragraph (incl. numbered clauses like "5.1 ..." — preserve numbering)
    out.push('<p>' + inline(t) + '</p>');
    i++;
  }
  return out.join('\n');
}

// ---------------- Fonts ----------------
// The three decided typefaces live in the CLIENT's public directory, so the repository holds ONE copy
// of each file: the client serves it at /fonts/... and this builder points at the same bytes on disk.
// See client/public/fonts/README.md for provenance, the licence finding and the regeneration command.
//
// The builder writes its output into this directory, so the reference is a path RELATIVE to __dirname.
// A font that cannot be found is a build failure, never a quiet fall back to a system face: a PDF
// that silently prints Arabic in some other typeface is exactly what this reference exists to prevent.
const FONT_DIR = path.join(__dirname, '..', 'client', 'public', 'fonts');
const ARABIC_RANGES = 'U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF';
function fontUrl(relativeToFontDir) {
  const absolute = path.join(FONT_DIR, relativeToFontDir);
  if (!fs.existsSync(absolute)) {
    throw new Error(
      'build-html: missing font file ' + absolute + '\n'
      + '  The print pipeline references the shipped subsets under client/public/fonts/'
      + ' (regenerate them as described in client/public/fonts/README.md, or fix the path here).\n'
      + '  Refusing to build: a document built without its Arabic face would print in a system face '
      + 'and nothing in the file would say so.');
  }
  return path.relative(DIR, absolute).split(path.sep).join('/');
}
const NASKH = fontUrl('noto-naskh-arabic/noto-naskh-arabic.woff2');
// ---------------- Shared CSS ----------------
function css(brand, version) {
  return `
  /* Arabic in these documents is Noto Naskh Arabic (owner decision 2026-10-29) - and only Arabic:
     the unicode-range below keeps the face off every Latin character, so the Latin stacks further
     down this stylesheet stay the ones that produced the current PDFs. A silent fall back is the
     failure mode this whole change exists to avoid, so the build fails if the file is absent. */
  @font-face {
    font-family: 'Noto Naskh Arabic';
    src: url('${NASKH}') format('woff2');
    font-weight: 400 700;
    font-display: swap;
    unicode-range: ${ARABIC_RANGES};
  }
  :root {
    --teal:#0F766E; --teal2:#14B8A6; --slate900:#0F172A; --slate600:#475569;
    --slate50:#F8FAFC; --amber:#F59E0B; --red:#EF4444; --border:#E2E8F0;
  }
  * { box-sizing: border-box; }
  @page { size: A4; margin: 16mm 14mm 16mm 14mm; }
  html, body { margin:0; padding:0; }
  body {
    font-family: 'Inter','Segoe UI','DejaVu Sans',sans-serif;
    color: var(--slate900); font-size: 10.5pt; line-height: 1.5;
    background: #fff;
  }
  /* The Arabic face goes FIRST in the rtl stack only. Latin characters - including the Latin inside an
     Arabic document, a number, a party's name, an English parenthetical - are not covered by the face's
     unicode-range, so they land on the same 'DejaVu Sans', 'Segoe UI' tail as before: unchanged. */
  .lang[dir="rtl"] body, .lang[dir="rtl"] { font-family: 'Noto Naskh Arabic', 'DejaVu Sans', 'Segoe UI', sans-serif; }

  .doc-header {
    background: var(--teal); color:#fff; border-radius: 8px;
    padding: 14px 18px; margin-bottom: 14px;
  }
  .doc-header .brand { font-size: 15pt; font-weight:700; letter-spacing:.5px; }
  .doc-header .brand span { color: #99F6E4; }
  .doc-header .sub { font-size: 9.5pt; color:#E6FFFA; margin-top:3px; }
  .doc-header .meta { font-size: 8.5pt; color:#CCFBF1; margin-top:6px; border-top:1px solid rgba(255,255,255,.25); padding-top:6px; }

  h1 { font-size: 17pt; color: var(--teal); margin: 0 0 2px 0; line-height:1.25; }
  h1.ar { direction: rtl; text-align: right; }
  h2 { font-size: 12.5pt; color: var(--slate900); margin: 18px 0 8px; border-bottom: 2px solid var(--teal2); padding-bottom: 4px; }
  h3 { font-size: 11pt; color: var(--teal); margin: 14px 0 6px; }
  h4 { font-size: 10.5pt; color: var(--slate900); margin: 10px 0 4px; }
  p { margin: 5px 0; }
  ul, ol { margin: 5px 0 5px 20px; padding:0; }
  li { margin: 2px 0; }
  blockquote {
    background: var(--slate50); border-left: 4px solid var(--teal);
    margin: 10px 0; padding: 8px 12px; color: var(--slate600); font-size: 9pt;
  }
  hr { border: none; border-top: 1px solid var(--border); margin: 14px 0; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 9pt; }
  th, td { border: 1px solid var(--border); padding: 5px 7px; text-align: left; vertical-align: top; }
  thead th { background: var(--teal); color: #fff; }
  tbody tr:nth-child(even) { background: var(--slate50); }

  .lang-en { direction: ltr; text-align: left; }
  .lang-ar { direction: rtl; text-align: right; }
  .lang-ar table th, .lang-ar table td { text-align: right; }
  .lang-ar ul, .lang-ar ol { margin: 5px 20px 5px 0; }

  .section-divider {
    margin: 20px 0 10px; padding: 8px 12px; border-radius: 6px;
    background: var(--slate900); color:#fff; font-weight:700; font-size: 11pt;
  }
  .section-divider.ar { direction: rtl; }

  .doc-footer {
    margin-top: 20px; padding-top: 8px; border-top: 1px solid var(--border);
    font-size: 8pt; color: var(--slate600);
    display: flex; justify-content: space-between;
  }
  .page-break { page-break-before: always; }
  .avoid-break { page-break-inside: avoid; }
  `;
}

// ---------------- Version extraction (single source of truth) ----------------
// Each Markdown carries its version in a "Version" metadata line; the HTML
// header/footer read that value so they can never drift from the source.
function extractVersion(md) {
  // The version is stated in a single "**Version ...**" metadata line (e.g.
  // "> **Version / الإصدار:** v2.2 (2026-09-17)"). Pull the first "vX.Y"
  // token from that line and normalise it to the bare number.
  const line = md.split('\n').find(l => /\*\*Version\b/i.test(l));
  if (!line) return null;
  const m = line.match(/(v?\d+\.\d+(?:\.\d+)?)/);
  if (!m) return null;
  return m[1].replace(/^v/i, ''); // normalise "v2.2" -> "2.2"
}

// ---------------- Build one document ----------------
function build(cfg) {
  const md = fs.readFileSync(path.join(DIR, cfg.md), 'utf8');
  const lines = md.split('\n');
  const version = extractVersion(md);
  if (!version) { throw new Error('No "Version" metadata line found in ' + cfg.md); }

  const enIdx = lines.findIndex(l => l.trim() === cfg.enMarker);
  const arIdx = lines.findIndex(l => l.trim() === cfg.arMarker);
  if (enIdx < 0 || arIdx < 0) { throw new Error('Markers not found in ' + cfg.md); }

  const headerMd = lines.slice(0, enIdx).join('\n');
  const enBodyMd = lines.slice(enIdx + 1, arIdx).join('\n');
  const arBodyMd = lines.slice(arIdx + 1).join('\n');

  const headerHtml = mdToHtml(headerMd);
  const enHtml = mdToHtml(enBodyMd);
  const arHtml = mdToHtml(arBodyMd);

  // Split the header block: first the h1 title(s), then any blockquote meta.
  // Re-render header manually for a branded look.
  const titleLines = lines.slice(0, enIdx).filter(l => /^#\s/.test(l));
  const metaLines = lines.slice(0, enIdx).filter(l => /^>\s/.test(l));

  const html = `<!doctype html>
<html lang="${cfg.enLang || 'en'}">
<head>
<meta charset="utf-8"/>
<title>${cfg.title}</title>
<style>${css(cfg.brand, version)}</style>
</head>
<body>

<div class="doc-header">
  <div class="brand">Antum People &middot; ${cfg.brand}</div>
  <div class="sub">${cfg.subtitle}</div>
  <div class="meta">Version ${version} &middot; ${DATE} &middot; ${cfg.metaNote}</div>
</div>

${titleLines.map(l => {
  const t = l.replace(/^#\s+/, '');
  const isAr = /[\u0600-\u06FF]/.test(t);
  return `<h1 class="${isAr ? 'ar' : ''}">${inline(t)}</h1>`;
}).join('\n')}

${metaLines.length ? '<blockquote>' + metaLines.map(l => inline(l.replace(/^>\s?/, ''))).join('<br/>') + '</blockquote>' : ''}

<div class="lang-en" dir="ltr" lang="${cfg.enLang || 'en'}">
  <div class="section-divider">${inline(cfg.enMarker.replace(/^##\s*/, ''))}</div>
  ${enHtml}
</div>

<div class="lang-ar page-break" dir="rtl" lang="ar">
  <div class="section-divider ar">${inline(cfg.arMarker.replace(/^##\s*/, ''))}</div>
  ${arHtml}
</div>

<div class="doc-footer">
  <span>Antum People &middot; ${cfg.brand} &middot; v${version}</span>
  <span>${DATE} &middot; UAE PDPL &amp; KSA PDPL</span>
</div>

</body>
</html>`;

  fs.writeFileSync(path.join(DIR, cfg.html), html);
  return { html: cfg.html, bytes: Buffer.byteLength(html) };
}

// ---------------- Document configs ----------------
const docs = [
  {
    md: 'privacy-notice.md',
    html: 'privacy-notice.html',
    title: 'Employee Privacy Notice',
    brand: 'Compliance Pack',
    subtitle: 'Employee Privacy Notice (UAE & KSA)',
    metaNote: 'Pilot-ready &middot; EN / AR',
    enMarker: '## ENGLISH VERSION',
    arMarker: '## النسخة العربية',
  },
  {
    md: 'data-processing-agreement.md',
    html: 'data-processing-agreement.html',
    title: 'Data Processing Agreement',
    brand: 'Compliance Pack',
    subtitle: 'Data Processing Agreement (UAE & KSA)',
    metaNote: 'Pilot-ready &middot; EN / AR',
    enMarker: '## PART 1 — Data Processing Agreement (English)',
    arMarker: '## PART 2 — اتفاقية معالجة البيانات (العربية)',
  },
  {
    md: 'dpia-questionnaire.md',
    html: 'dpia-questionnaire.html',
    title: 'DPIA Questionnaire',
    brand: 'Compliance Pack',
    subtitle: 'Data Protection Impact Assessment Questionnaire (UAE & KSA)',
    metaNote: 'Pilot-ready &middot; EN / AR',
    enMarker: '## ENGLISH VERSION',
    arMarker: '## النسخة العربية',
  },
];

const results = [];
for (const d of docs) {
  const r = build(d);
  results.push(r);
  console.log('Wrote', r.html, '(' + r.bytes + ' bytes)');
}
console.log('Done. HTML files generated.');
