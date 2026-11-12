#!/usr/bin/env node
// template-derivatives - every pilot-pack derivative must carry the version of the Markdown it is built from.
//
// WHY. `templates/*.md` is the single source; `templates/build-html.js` writes the HTML from it, and the
// PDFs are printed from the HTML. Nothing enforced that the derivatives kept up: the notice was served as
// v2.4 while `privacy-notice.html` still said "Version 2.2" and `privacy-notice.pdf` was dated 2026-09-18,
// so the pilot pack could hand a client a notice two versions behind the product. A derivative that names
// an older version is worse than a missing one: it looks current.
//
// WHAT IT JUDGES, per document trio (md, html, pdf):
//   md   - the "**Version ...**" metadata line: the version and the date on that same line.
//   html - the builder's own two places: `<div class="meta">Version <v> &middot; <date> ...` and the
//          footer's `<span>Antum People &middot; ... &middot; v<v></span>`.
//   pdf  - the printed header. PDF text is not parseable as prose (the header is letter-spaced, "fi" is a
//          ligature), so the PDF half compares COMPACTED text: all non-alphanumerics removed, ligatures
//          expanded, then `version<v><date>` must appear. That is the header the builder writes, read back
//          out of the printed bytes.
//   pdf  - and THE FACE ITS ARABIC IS PRINTED IN. The builder declares one Arabic @font-face; a document
//          whose HTML carries Arabic must have that face EMBEDDED in its PDF. Measured 2026-11-11 at
//          ac8a956: all three PDFs embedded DejaVuSans and DejaVuSans-Bold and nothing else, because the
//          font rule selected `.lang[dir="rtl"]` while the markup says `class="lang-ar"` - the face was
//          never requested, so the Arabic column was drawn from a Latin-first fallback and the file looked
//          perfectly current. A version check cannot see that, so it is judged here, from the bytes.
//
// THE DECLARED FACE IS READ OUT OF build-html.js, never typed here: the family name and the file its
// @font-face points at. Renaming the family, swapping the file or dropping the @font-face cannot leave
// this half of the check comparing against a face the builder no longer declares - the last of those is a
// FAILURE, because a check that cannot see its own subject has not passed.
//
// EXIT: 0 all agree · 1 a derivative disagrees (or is missing, or is not in the builder's shape) ·
//       2 CANNOT-JUDGE: a PDF is present but its text cannot be read at all - a file this instrument
//         cannot read must never come back green.
//
// --selftest plants the disagreements in a scratch copy and requires each to be reported on its own file,
// so the instrument is shown to redden where the defect is known (and to stay green on the clean copy).
//
// HOW A PDF IS REGENERATED (there is no script for it; this is the command that produced the bytes in
// templates/, run from the repository root so the builder's ../client/public/fonts reference resolves):
//   python3 -m http.server 8099 --bind 127.0.0.1 --directory . &
//   chromium --headless --no-sandbox --disable-gpu --no-pdf-header-footer \
//     --print-to-pdf=templates/privacy-notice.pdf --virtual-time-budget=10000 \
//     http://127.0.0.1:8099/templates/privacy-notice.html
//   kill %1
// Printing the file:// path instead of the http URL produces the same bytes today, but a font served over
// http is a same-origin fetch while file:// is not - so the http form is the one that survives a font the
// page actually asks for.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TEMPLATES = path.join(ROOT, 'templates');

// The trio list is derived from the builder's own document table, not typed here: a document added to
// build-html.js is judged the moment it exists, and a renamed one cannot leave this check vacuously green.
function trios(dir) {
  const src = fs.readFileSync(path.join(dir, 'build-html.js'), 'utf8');
  const re = /md:\s*'([^']+\.md)',\s*\n\s*html:\s*'([^']+\.html)'/g;
  const out = [];
  let m;
  while ((m = re.exec(src))) out.push({ md: m[1], html: m[2], pdf: m[2].replace(/\.html$/, '.pdf') });
  return out;
}

// ---------------------------------------------------------------- PDF text (dependency-free)
function loadObjects(buf) {
  const s = buf.toString('latin1');
  const objs = new Map();
  const re = /(\d+)\s+(\d+)\s+obj\b/g;
  let m;
  while ((m = re.exec(s))) {
    const num = Number(m[1]);
    const start = m.index + m[0].length;
    const end = s.indexOf('endobj', start);
    if (end < 0) continue;
    const body = s.slice(start, end);
    const si = body.indexOf('stream');
    let dict = body, stream = null;
    if (si >= 0) {
      dict = body.slice(0, si);
      let ds = start + si + 'stream'.length;
      if (s[ds] === '\r') ds++;
      if (s[ds] === '\n') ds++;
      const es = s.indexOf('endstream', ds);
      stream = buf.subarray(ds, es);
    }
    objs.set(num, { dict, stream });
  }
  return objs;
}

function streamBytes(obj) {
  if (!obj || !obj.stream) return null;
  let b = obj.stream;
  if (/\/FlateDecode/.test(obj.dict)) {
    try { b = zlib.inflateSync(b); } catch (e) {
      try { b = zlib.inflateRawSync(b); } catch (e2) { return null; }
    }
  }
  return b;
}

function parseCMap(text) {
  const map = new Map();
  const hexToStr = h => {
    let out = '';
    for (let i = 0; i + 4 <= h.length; i += 4) {
      const code = parseInt(h.substr(i, 4), 16);
      if (!isNaN(code)) out += String.fromCharCode(code);
    }
    return out;
  };
  let m;
  const bfchar = /beginbfchar([\s\S]*?)endbfchar/g;
  while ((m = bfchar.exec(text))) {
    const pair = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let p;
    while ((p = pair.exec(m[1]))) map.set(parseInt(p[1], 16), hexToStr(p[2]));
  }
  const bfrange = /beginbfrange([\s\S]*?)endbfrange/g;
  while ((m = bfrange.exec(text))) {
    const trip = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let t;
    while ((t = trip.exec(m[1]))) {
      const lo = parseInt(t[1], 16), hi = parseInt(t[2], 16);
      const base = parseInt(t[3].substr(-4), 16);
      for (let c = lo; c <= hi; c++) map.set(c, String.fromCharCode(base + (c - lo)));
    }
  }
  return map;
}

function fontMaps(objs) {
  const maps = new Map();
  for (const [num, obj] of objs) {
    const m = obj.dict.match(/\/ToUnicode\s+(\d+)\s+0\s+R/);
    if (!m) continue;
    const cm = streamBytes(objs.get(Number(m[1])));
    if (!cm) continue;
    maps.set(num, parseCMap(cm.toString('latin1')));
  }
  return maps;
}

function resourceFonts(objs, pageObj) {
  let dict = pageObj.dict;
  const rm = dict.match(/\/Resources\s+(\d+)\s+0\s+R/);
  if (rm) {
    const ro = objs.get(Number(rm[1]));
    if (ro) dict = ro.dict;
  }
  const fonts = new Map();
  const fm = dict.match(/\/Font\s*<<([\s\S]*?)>>/);
  if (fm) {
    const r = /\/(\w+)\s+(\d+)\s+0\s+R/g;
    let x;
    while ((x = r.exec(fm[1]))) fonts.set(x[1], Number(x[2]));
  } else {
    const fr = dict.match(/\/Font\s+(\d+)\s+0\s+R/);
    if (fr) {
      const fo = objs.get(Number(fr[1]));
      if (fo) {
        const r = /\/(\w+)\s+(\d+)\s+0\s+R/g;
        let x;
        while ((x = r.exec(fo.dict))) fonts.set(x[1], Number(x[2]));
      }
    }
  }
  return fonts;
}

function contentOf(objs, pageObj) {
  const m = pageObj.dict.match(/\/Contents\s+(\d+)\s+0\s+R/);
  if (m) return streamBytes(objs.get(Number(m[1])));
  const a = pageObj.dict.match(/\/Contents\s*\[([^\]]*)\]/);
  if (a) {
    const parts = [];
    const r = /(\d+)\s+0\s+R/g;
    let x;
    while ((x = r.exec(a[1]))) {
      const b = streamBytes(objs.get(Number(x[1])));
      if (b) parts.push(b);
    }
    return Buffer.concat(parts);
  }
  return null;
}

function decodeContent(bytes, fonts, cmaps) {
  const s = bytes.toString('latin1');
  let out = '';
  let cur = null;
  const ops = /(\/([A-Za-z0-9]+)\s+[\d.]+\s+Tf)|(\[((?:[^\]\\]|\\.)*)\]\s*TJ)|(\((?:[^()\\]|\\.)*\)\s*Tj)|(<[0-9A-Fa-f\s]*>\s*Tj)|(T\*)|(Td|TD)|(ET)/g;
  let m;
  const decodeStr = (raw, isHex) => {
    if (!cur) {
      // A simple (Type1/TrueType) font with no ToUnicode: the bytes ARE the characters.
      const t = raw.replace(/^\s*\(/, '').replace(/\)\s*$/, '').replace(/[<>]/g, '');
      return t.replace(/\\([nrt])/g, (mm, c) => (c === 'n' ? '\n' : c === 'r' ? '\r' : '\t'));
    }
    const codes = [];
    if (isHex) {
      const h = raw.replace(/[<>\s]/g, '');
      for (let k = 0; k + 4 <= h.length; k += 4) codes.push(parseInt(h.substr(k, 4), 16));
    } else {
      const un = raw.replace(/^\s*\(/, '').replace(/\)\s*$/, '');
      const bytes2 = [];
      for (let k = 0; k < un.length; k++) {
        const ch = un[k];
        if (ch === '\\') {
          k++;
          const n = un[k];
          if (n === 'n') bytes2.push(10);
          else if (n === 'r') bytes2.push(13);
          else if (n === 't') bytes2.push(9);
          else if (/[0-7]/.test(n)) {
            let oct = n;
            while (oct.length < 3 && /[0-7]/.test(un[k + 1])) oct += un[++k];
            bytes2.push(parseInt(oct, 8));
          } else bytes2.push(n.charCodeAt(0));
        } else bytes2.push(ch.charCodeAt(0));
      }
      for (let k = 0; k + 1 < bytes2.length; k += 2) codes.push((bytes2[k] << 8) | bytes2[k + 1]);
    }
    let t = '';
    for (const c of codes) t += cur.get(c) !== undefined ? cur.get(c) : '';
    return t;
  };
  while ((m = ops.exec(s))) {
    if (m[1]) {
      const num = fonts.get(m[2]);
      cur = num !== undefined ? cmaps.get(num) : null;
    } else if (m[3]) {
      const arr = m[4];
      const strRe = /<([0-9A-Fa-f\s]*)>|\(((?:[^()\\]|\\.)*)\)/g;
      let sm;
      while ((sm = strRe.exec(arr))) {
        out += sm[1] !== undefined ? decodeStr('<' + sm[1] + '>', true) : decodeStr('(' + sm[2] + ')', false);
      }
    } else if (m[5]) {
      out += decodeStr(m[5], false);
    } else if (m[6]) {
      out += decodeStr(m[6], true);
    } else if (m[7] || m[8] || m[9]) {
      out += '\n';
    }
  }
  return out;
}

function pdfText(file) {
  const buf = fs.readFileSync(file);
  const objs = loadObjects(buf);
  const cmaps = fontMaps(objs);
  const pages = [...objs.entries()]
    .filter(([, o]) => /\/Type\s*\/Page[^s]/.test(o.dict))
    .sort((a, b) => a[0] - b[0]);
  const texts = [];
  for (const [, p] of pages) {
    const c = contentOf(objs, p);
    if (!c) { texts.push(''); continue; }
    texts.push(decodeContent(c, resourceFonts(objs, p), cmaps));
  }
  return { pages: pages.length, text: texts.join('\n') };
}

// ---------------------------------------------------------------- the face the builder declares
// Read OUT of build-html.js's own @font-face block: the family and the file it points at. Nothing about
// the face is typed here, so the check cannot go on requiring a name the builder stopped using.
function declaredFace(dir) {
  const src = fs.readFileSync(path.join(dir, 'build-html.js'), 'utf8');
  const block = src.match(/@font-face\s*\{([\s\S]*?)\}/);
  if (!block) return null;
  const fam = block[1].match(/font-family:\s*'([^']+)'/);
  if (!fam) return null;
  // The src is written `url('${NASKH}')`, so an interpolated url is resolved through the builder's own
  // `const NAME = fontUrl('<path>')` line - the file the face is cut from, named rather than guessed.
  const url = block[1].match(/url\('([^']+)'\)/);
  let file = '(no src url)';
  if (url) {
    let u = url[1];
    const tpl = u.match(/^\$\{(\w+)\}$/);
    if (tpl) {
      const decl = src.match(new RegExp('const\\s+' + tpl[1] + "\\s*=\\s*fontUrl\\('([^']+)'\\)"));
      if (decl) u = decl[1];
    }
    file = path.basename(u);
  }
  return { family: fam[1], file };
}

// ---------------------------------------------------------------- the fonts a PDF embeds
// A PDF names a font twice - /FontName on the Type0 font, /BaseFont on the descendant CIDFont - and
// Chromium writes the descendant dicts inside a COMPRESSED object stream, so scanning the raw bytes finds
// half the answer. Every stream is inflated and scanned, and the six-letter subset prefix is stripped:
// `/CAAAAA+NotoNaskhArabic-Regular` is the declared face, embedded.
function embeddedFonts(file) {
  const buf = fs.readFileSync(file);
  const parts = [buf.toString('latin1')];
  for (const [, o] of loadObjects(buf)) {
    const b = streamBytes(o);
    if (b) parts.push(b.toString('latin1'));
  }
  const names = new Set();
  const re = /\/(?:BaseFont|FontName)\s*\/([A-Za-z0-9+,\-]+)/g;
  let m;
  for (const p of parts) {
    re.lastIndex = 0;
    while ((m = re.exec(p))) names.add(m[1].replace(/^[A-Z]{6}\+/, ''));
  }
  return [...names].sort();
}

// "Noto Naskh Arabic" (the CSS family) and "NotoNaskhArabic-Regular" (the PostScript name Chromium writes
// into the PDF) are the same face spelled the way each format spells it.
function faceKey(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ---------------------------------------------------------------- comparison
const LIGATURES = {
  '\uFB00': 'ff', '\uFB01': 'fi', '\uFB02': 'fl', '\uFB03': 'ffi',
  '\uFB04': 'ffl', '\uFB05': 'st', '\uFB06': 'st',
};
// Compacted text: ligatures expanded, case folded, everything that is not a latin letter or digit removed.
// The printed header is letter-spaced ("V e r s i o n 2 . 4 · 2 0 2 6 - 1 1 - 1 0"), so spacing and the
// middle dot have to go before anything can be compared.
function compact(s) {
  return s.replace(/[\uFB00-\uFB06]/g, c => LIGATURES[c]).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function mdVersion(mdText) {
  const line = mdText.split('\n').find(l => /\*\*Version\b/i.test(l));
  if (!line) return null;
  const v = line.match(/(v?\d+\.\d+(?:\.\d+)?)/);
  const d = line.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (!v || !d) return null;
  return { version: v[1].replace(/^v/i, ''), date: d[1] };
}

function expectedToken(v) {
  return 'version' + v.version.replace(/\./g, '') + v.date.replace(/-/g, '');
}

// Judge one directory of derivatives. Returns rows + failures + unjudgeable; the caller decides the exit.
function judge(dir) {
  const rows = [];
  const failures = [];
  const unjudgeable = [];
  // The face the builder declares, once for the whole directory. No @font-face means there is nothing to
  // require of the PDFs - which is not a pass: this instrument would be judging nothing.
  const face = declaredFace(dir);
  if (!face) {
    failures.push('build-html.js declares no Arabic @font-face (no font-family in a @font-face block), so ' +
      'no face can be required of the printed derivatives - this check cannot see its own subject');
  }
  for (const t of trios(dir)) {
    const row = { md: t.md, version: null, html: 'ok', pdf: 'ok', font: 'ok' };
    const mdPath = path.join(dir, t.md);
    if (!fs.existsSync(mdPath)) {
      failures.push(`${t.md}: the Markdown source is missing`);
      row.md = 'MISSING';
      rows.push(row);
      continue;
    }
    const v = mdVersion(fs.readFileSync(mdPath, 'utf8'));
    if (!v) {
      failures.push(`${t.md}: no "**Version ...**" metadata line carrying a version and a date`);
      row.md = 'NO VERSION LINE';
      rows.push(row);
      continue;
    }
    row.version = 'v' + v.version + ' (' + v.date + ')';
    const token = expectedToken(v);

    // ---- HTML: the two places the builder writes the version.
    const htmlPath = path.join(dir, t.html);
    let htmlHasArabic = false;
    if (!fs.existsSync(htmlPath)) {
      failures.push(`${t.html}: missing (the builder writes it from ${t.md})`);
      row.html = 'MISSING';
    } else {
      const html = fs.readFileSync(htmlPath, 'utf8');
      htmlHasArabic = /[\u0600-\u06FF]/.test(html);
      const meta = html.match(/<div class="meta">Version ([0-9.]+) &middot; (\d{4}-\d{2}-\d{2})/);
      const foot = html.match(/<span>Antum People &middot; [^<]*&middot; v([0-9.]+)<\/span>/);
      if (!meta || !foot) {
        failures.push(`${t.html}: not in the builder's shape (no "<div class=\\"meta\\">Version <v> &middot; <date>" ` +
          `and footer "v<v>" pair) - it was not written by templates/build-html.js, so it cannot be judged`);
        row.html = 'NOT BUILDER OUTPUT';
      } else if (meta[1] !== v.version || meta[2] !== v.date || foot[1] !== v.version) {
        failures.push(`${t.html}: says Version ${meta[1]} &middot; ${meta[2]} (footer v${foot[1]}), ` +
          `${t.md} says v${v.version} (${v.date})`);
        row.html = 'STALE v' + meta[1];
      }
    }

    // ---- PDF: the printed header, read back out of the bytes.
    const pdfPath = path.join(dir, t.pdf);
    if (!fs.existsSync(pdfPath)) {
      failures.push(`${t.pdf}: missing (the pack prints it from ${t.html})`);
      row.pdf = 'MISSING';
    } else {
      let extracted;
      try {
        extracted = pdfText(pdfPath);
      } catch (e) {
        extracted = { pages: 0, text: '' };
      }
      const c = compact(extracted.text);
      if (c.length < 200) {
        unjudgeable.push(`${t.pdf}: no text could be read out of it (${extracted.pages} page(s), ` +
          `${c.length} compacted char(s)) - this instrument cannot judge the file, which is not a pass`);
        row.pdf = 'UNREADABLE';
      } else if (!c.includes(token)) {
        const at = c.indexOf('version');
        const found = at >= 0 ? c.slice(at, at + Math.max(token.length, 16)) : '(no "version" in the text at all)';
        failures.push(`${t.pdf}: its header reads "${found}", expected "${token}" ` +
          `(v${v.version} of ${v.date}, as ${t.md} states)`);
        row.pdf = 'STALE';
      }

      // ---- PDF: the face its Arabic is printed in.
      if (row.pdf === 'UNREADABLE') {
        // already CANNOT-JUDGE (exit 2): nothing about this file is a pass, and its font list would be empty
        // for the same reason its text is.
        row.font = 'NOT JUDGED';
      } else if (face && htmlHasArabic) {
        let fonts = [];
        try { fonts = embeddedFonts(pdfPath); } catch (e) { fonts = []; }
        const want = faceKey(face.family);
        if (!fonts.length) {
          row.font = 'NO FONTS READ';
          failures.push(`${t.pdf}: no embedded font could be read out of it, so the declared Arabic face ` +
            `"${face.family}" cannot be shown to be embedded`);
        } else if (!fonts.some(f => faceKey(f).startsWith(want))) {
          row.font = 'NO ARABIC FACE';
          failures.push(`${t.pdf}: its embedded fonts are [${fonts.join(' ')}] - the Arabic face ` +
            `"${face.family}" (${face.file}, declared by build-html.js) is NOT among them, so the Arabic ` +
            `in this document printed in a fallback face. Reprint it: the print command is in this file's header`);
        }
      } else if (face && !htmlHasArabic) {
        row.font = 'n/a';
      } else {
        row.font = 'NOT JUDGED';
      }
    }
    rows.push(row);
  }
  return { rows, failures, unjudgeable, face };
}

function report(res, label) {
  console.log(`template-derivatives - ${label}`);
  for (const r of res.rows) {
    console.log(`  ${r.md.padEnd(28)} md ${String(r.version).padEnd(18)} html ${r.html.padEnd(18)} ` +
      `pdf ${r.pdf.padEnd(18)} face ${r.font}`);
  }
  if (res.face) console.log(`  declared Arabic face: "${res.face.family}" (${res.face.file})`);
  for (const u of res.unjudgeable) console.log('  CANNOT-JUDGE  ' + u);
  for (const f of res.failures) console.log('  FAIL  ' + f);
  console.log(`  ${res.rows.length} document(s) judged, ${res.failures.length} disagreement(s), ` +
    `${res.unjudgeable.length} unreadable`);
}

// ---------------------------------------------------------------- plants
function copyTrio(dir, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const f of fs.readdirSync(dir)) {
    if (/^(build-html\.js|.*\.(md|html|pdf))$/.test(f)) fs.copyFileSync(path.join(dir, f), path.join(dest, f));
  }
}

function plantHtmlStale(dest, t) {
  const p = path.join(dest, t.html);
  let s = fs.readFileSync(p, 'utf8');
  s = s.replace(/<div class="meta">Version [0-9.]+ &middot; \d{4}-\d{2}-\d{2}/,
    '<div class="meta">Version 0.9 &middot; 2000-01-01');
  s = s.replace(/<span>Antum People &middot; [^<]*&middot; v[0-9.]+<\/span>/,
    '<span>Antum People &middot; Compliance Pack &middot; v0.9</span>');
  fs.writeFileSync(p, s);
}

function plantMdMoved(dest, t) {
  const p = path.join(dest, t.md);
  let s = fs.readFileSync(p, 'utf8');
  s = s.replace(/\*\*Version \/ [^*]*\*\* v?\d+\.\d+(?:\.\d+)?/, m => m.replace(/\d+\.\d+(?:\.\d+)?$/, '9.9'));
  fs.writeFileSync(p, s);
}

function stalePdfFromHistory(t, wantToken) {
  // The PDF as it was BEFORE the version the .md states now: walk this file's own history and take the
  // first revision whose printed header disagrees. Derived every run - no pinned hash to go stale.
  let revs;
  try {
    revs = execFileSync('git', ['-C', ROOT, 'log', '--format=%H', '--', 'templates/' + t.pdf], { encoding: 'utf8' })
      .trim().split('\n').filter(Boolean);
  } catch (e) {
    return null;
  }
  for (const rev of revs) {
    let bytes;
    try {
      bytes = execFileSync('git', ['-C', ROOT, 'show', rev + ':templates/' + t.pdf], { maxBuffer: 64 * 1024 * 1024 });
    } catch (e) { continue; }
    const tmp = path.join(os.tmpdir(), 'tpl-pdf-' + process.pid + '-' + rev.slice(0, 8) + '.pdf');
    fs.writeFileSync(tmp, bytes);
    let c = '';
    try { c = compact(pdfText(tmp).text); } catch (e) { c = ''; }
    fs.unlinkSync(tmp);
    if (c.length >= 200 && !c.includes(wantToken)) return bytes;
  }
  return null;
}

function pdfWithoutFaceFromHistory(t, face) {
  // The real pre-fix bytes for the FONT half: this repository's own history, the first revision of this PDF
  // whose embedded font list does not carry the declared face. Derived every run, never a pinned hash - the
  // defect this plant reproduces is the one measured on 2026-11-11, not a drawing of it.
  let revs;
  try {
    revs = execFileSync('git', ['-C', ROOT, 'log', '--format=%H', '--', 'templates/' + t.pdf], { encoding: 'utf8' })
      .trim().split('\n').filter(Boolean);
  } catch (e) {
    return null;
  }
  const want = faceKey(face.family);
  for (const rev of revs) {
    let bytes;
    try {
      bytes = execFileSync('git', ['-C', ROOT, 'show', rev + ':templates/' + t.pdf], { maxBuffer: 64 * 1024 * 1024 });
    } catch (e) { continue; }
    const tmp = path.join(os.tmpdir(), 'tpl-font-' + process.pid + '-' + rev.slice(0, 8) + '.pdf');
    fs.writeFileSync(tmp, bytes);
    let fonts = [];
    try { fonts = embeddedFonts(tmp); } catch (e) { fonts = []; }
    fs.unlinkSync(tmp);
    if (fonts.length && !fonts.some(f => faceKey(f).startsWith(want))) return bytes;
  }
  return null;
}

function plantNoFontFace(dest) {
  // The builder stops declaring the face at all: the instrument must say it cannot see its subject rather
  // than go on comparing a PDF against a name nobody declares any more.
  const p = path.join(dest, 'build-html.js');
  let s = fs.readFileSync(p, 'utf8');
  s = s.replace(/@font-face\s*\{[\s\S]*?\}\s*/, '');
  fs.writeFileSync(p, s);
}

function selftest() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'tpl-deriv-'));
  let bad = 0;
  let controls = 0;
  const expect = (label, got, want) => {
    controls++;
    const ok = got === want;
    if (!ok) bad++;
    console.log(`  ${ok ? 'ok ' : 'BAD'}  ${label.padEnd(52)} ${got} (must be ${want})`);
  };
  try {
    // P0 control: the tree as committed must be green, or every plant below proves nothing.
    const clean = path.join(base, 'clean');
    copyTrio(TEMPLATES, clean);
    const r0 = judge(clean);
    expect('P0 clean copy: disagreements', r0.failures.length, 0);
    expect('P0 clean copy: unreadable', r0.unjudgeable.length, 0);
    expect('P0 clean copy: documents judged', r0.rows.length, trios(TEMPLATES).length);
    expect('P0 clean copy: a face was declared to judge', r0.face !== null, true);

    const t0 = trios(TEMPLATES)[0];

    // P1 the HTML alone goes stale: exactly that one file is named.
    const p1 = path.join(base, 'p1');
    copyTrio(TEMPLATES, p1);
    plantHtmlStale(p1, t0);
    const r1 = judge(p1);
    expect('P1 stale HTML: disagreements', r1.failures.length, 1);
    expect('P1 stale HTML: names the html', r1.failures[0].startsWith(t0.html + ':'), true);

    // P2 the Markdown moves and its derivatives do not: BOTH derivatives are named.
    const p2 = path.join(base, 'p2');
    copyTrio(TEMPLATES, p2);
    plantMdMoved(p2, t0);
    const r2 = judge(p2);
    expect('P2 md moved: disagreements', r2.failures.length, 2);
    const named2 = r2.failures.map(f => f.split(':')[0]).sort().join(',');
    expect('P2 md moved: names html and pdf', named2, [t0.html, t0.pdf].sort().join(','));

    // P3 the PDF alone goes stale (the real defect, its real bytes from history): only the pdf is named.
    const v = mdVersion(fs.readFileSync(path.join(TEMPLATES, t0.md), 'utf8'));
    const stale = stalePdfFromHistory(t0, expectedToken(v));
    if (!stale) {
      bad++;
      console.log('  BAD  P3 stale PDF: no disagreeing PDF found in history - the plant could not be built');
    } else {
      const p3 = path.join(base, 'p3');
      copyTrio(TEMPLATES, p3);
      fs.writeFileSync(path.join(p3, t0.pdf), stale);
      const r3 = judge(p3);
      const header3 = r3.failures.filter(f => /its header reads/.test(f));
      expect('P3 stale PDF: header disagreements', header3.length, 1);
      expect('P3 stale PDF: names the pdf', header3[0].split(':')[0], t0.pdf);
      expect('P3 stale PDF: names no other file', r3.failures.filter(f => !f.startsWith(t0.pdf + ':')).length, 0);
    }

    // P4 a PDF this instrument cannot read is CANNOT-JUDGE, never a pass.
    const p4 = path.join(base, 'p4');
    copyTrio(TEMPLATES, p4);
    fs.writeFileSync(path.join(p4, t0.pdf), '%PDF-1.4\n%nothing but a comment\n');
    const r4 = judge(p4);
    expect('P4 unreadable PDF: disagreements', r4.failures.length, 0);
    expect('P4 unreadable PDF: unreadable', r4.unjudgeable.length, 1);

    // P5 the PDF prints its Arabic in a fallback face - THE REAL PRE-FIX BYTES, taken from this
    // repository's own history: the first revision of this PDF whose embedded fonts do not carry the
    // declared face. Only the pdf is named, and it is named for its face.
    const face = declaredFace(TEMPLATES);
    const noFace = face ? pdfWithoutFaceFromHistory(t0, face) : null;
    if (!noFace) {
      bad++;
      console.log('  BAD  P5 no Arabic face: no PDF without the face found in history - the plant could not be built');
    } else {
      const p5 = path.join(base, 'p5');
      copyTrio(TEMPLATES, p5);
      fs.writeFileSync(path.join(p5, t0.pdf), noFace);
      const r5 = judge(p5);
      expect('P5 no Arabic face: disagreements', r5.failures.length, 1);
      expect('P5 no Arabic face: names the pdf', r5.failures[0].split(':')[0], t0.pdf);
      expect('P5 no Arabic face: names the missing face', /Arabic face/.test(r5.failures[0]), true);
    }

    // P6 the builder stops declaring the face at all: the instrument must say it cannot see its subject. A
    // check that went on comparing PDFs against a name nobody declares has not passed - it stopped looking.
    const p6 = path.join(base, 'p6');
    copyTrio(TEMPLATES, p6);
    plantNoFontFace(p6);
    const r6 = judge(p6);
    expect('P6 no @font-face: declared face', r6.face, null);
    expect('P6 no @font-face: disagreements', r6.failures.length, 1);
    expect('P6 no @font-face: says it cannot see its subject',
      /cannot see its own subject/.test(r6.failures[0]), true);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
  console.log(bad === 0 ? `selftest: every plant landed (${controls} controls)`
    : `selftest: ${bad} of ${controls} control(s) did not hold`);
  return bad === 0 ? 0 : 1;
}

function main() {
  if (process.argv.includes('--selftest')) {
    console.log('template-derivatives self-test (nothing else judged)');
    return selftest();
  }
  const res = judge(TEMPLATES);
  report(res, 'templates/: every derivative against the Markdown it is built from');
  if (res.unjudgeable.length) return 2;
  if (res.failures.length) return 1;
  return 0;
}

process.exitCode = main();
