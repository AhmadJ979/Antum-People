/**
 * The scanned-source guard (row 022ff68b).
 *
 * `src/index.css` pins Tailwind's scanned set to the files that carry markup, because v4 scans RAW TEXT
 * and automatic detection let prose move the shipped stylesheet: on 2026-10-20 the sentence in
 * `src/httpStatus.js:54` and the test name in `src/httpStatus.test.js:58` emitted
 * `.collapse{visibility:collapse}` into the served CSS, changing its bytes and its hash for a comment.
 * See `docs/evidence/tailwind-pinned-sources/`.
 *
 * Pinning has a cost, and this file is that cost made visible: a class name that lives in a file the pin
 * does not cover is never emitted, so the element renders unstyled with nothing failing. This test fails
 * instead - at the moment the class name moves, not at the moment a user sees a broken card.
 *
 * Three assertions, each reddenable on purpose:
 *   1. automatic detection is OFF (`source(none)`) and the declared sources still name the markup;
 *   2. every file in the client tree that carries a class ATTRIBUTE is inside the declared set - or is
 *      named in `NON_MARKUP` with a reason, and `NON_MARKUP` is exact, so a new one cannot slip in;
 *   3. no file outside the declared set contains a quoted class-name LIST (a helper returning
 *      `'bg-teal-50 border-teal-200'` is the shape this catches). A regex cannot prove absence - it is a
 *      gate, not a proof, and it is honest about that.
 *
 * Run: `cd client && npm test`   (node --test, no browser, no build)
 */
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const SRC = import.meta.dirname;
const CLIENT = path.join(import.meta.dirname, '..');
const CSS_PATH = path.join(SRC, 'index.css');

/**
 * Static assets that carry a `class` attribute but can never be styled by this stylesheet, so excluding
 * them from the scanned set loses nothing. Exact list, with the reason, because an allow-list that can
 * grow silently is the defect this whole row is about.
 */
const NON_MARKUP = {
  'src/assets/react.svg': 'the Vite logo: imported by no source file, and an SVG used as an image never '
    + 'receives the page stylesheet (its internals are not in the document)',
  'src/assets/vite.svg': 'the Vite mark: same as react.svg',
};

const CLASS_ATTRIBUTE = /\bclass(?:Name)?\s*=/;
const UTILITY_PREFIXES = 'bg|text|border|ring|shadow|font|opacity|gap|space|px|py|pt|pb|pl|pr|mx|my|mt|'
  + 'mb|ml|mr|min|max|rounded|flex|grid|items|justify|col|row|order|overflow|inset|top|left|right|bottom|'
  + 'leading|tracking|uppercase|lowercase|capitalize|underline|truncate|whitespace|align|list|object|aspect|'
  + 'transition|duration|ease|delay|animate|scale|rotate|translate|skew|origin|cursor|select|pointer|'
  + 'resize|scroll|snap|touch|fill|stroke|sr';
const CLASS_LIST = new RegExp(`['"\`][^'"\`]*\\b(?:${UTILITY_PREFIXES})-[a-z0-9\\[]`);

const cssText = fs.readFileSync(CSS_PATH, 'utf8');
const declared = [...cssText.matchAll(/@source\s+"([^"]+)"/g)].map((m) => m[1]);
const automaticOff = /@import\s+["']tailwindcss["']\s+source\(\s*none\s*\)/.test(cssText);

/**
 * A glob straight from the stylesheet, resolved against this file's directory. `**` crosses separators,
 * so a `**` followed by `/` must match ZERO or more segments - without that, `src/**` + `/*.tsx` would
 * not cover `src/App.tsx` (the markup itself) and this guard would redden on a correct tree.
 */
function globToRegExp(glob) {
  const abs = path.resolve(SRC, glob).split(path.sep).join('/');
  const pattern = abs
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '@@SEGMENTS@@')
    .replace(/\*/g, '[^/]*')
    .replace(/@@SEGMENTS@@/g, '(?:.*/)?');
  return new RegExp(`^${pattern}$`);
}

const covered = declared.map(globToRegExp);
const isCovered = (file) => covered.some((re) => re.test(file.split(path.sep).join('/')));

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const tree = [
  ...walk(SRC).filter((f) => !/\.(png|jpg|jpeg|gif|webp|woff2?|ttf)$/.test(f)),
  path.join(CLIENT, 'index.html'),
];

test('automatic source detection is off, and the declared sources still name the markup', () => {
  assert.ok(automaticOff,
    'src/index.css no longer imports tailwindcss with source(none): with automatic detection on, prose '
    + 'and test strings move the shipped stylesheet again (row 022ff68b)');
  assert.ok(declared.length >= 2, `expected the markup sources to be declared, found ${declared.length}`);
  const app = path.join(SRC, 'App.tsx');
  const index = path.join(CLIENT, 'index.html');
  assert.ok(isCovered(app), `no @source covers ${path.relative(CLIENT, app)} - the markup itself`);
  assert.ok(isCovered(index), `no @source covers ${path.relative(CLIENT, index)}`);
  // The stylesheet itself must NOT be a source: it explains this defect in prose, and a scanned comment
  // would re-emit the very utility the narrowing removed.
  assert.ok(!isCovered(CSS_PATH), 'index.css must not be one of its own scanned sources');
});

test('every class-carrying file is inside the declared sources, or states why it is not markup', () => {
  const offenders = [];
  const allowedUnused = new Set(Object.keys(NON_MARKUP));
  for (const file of tree) {
    const rel = path.relative(CLIENT, file).split(path.sep).join('/');
    if (isCovered(file) || rel === 'src/index.css') continue;
    if (!CLASS_ATTRIBUTE.test(fs.readFileSync(file, 'utf8'))) continue;
    if (rel in NON_MARKUP) { allowedUnused.delete(rel); continue; }
    offenders.push(rel);
  }
  assert.deepStrictEqual(offenders, [],
    'these files carry class attributes but no @source in src/index.css covers them, so their utilities '
    + 'would never be emitted. Add them to index.css, or add them to NON_MARKUP with the reason they '
    + 'cannot be styled by this stylesheet.');
  assert.deepStrictEqual([...allowedUnused], [],
    'NON_MARKUP names a file that no longer carries class attributes: delete the entry, an allow-list '
    + 'keeps no dead reasons');
});

test('no class-name list hides outside the declared sources', () => {
  const hits = [];
  for (const file of tree) {
    const rel = path.relative(CLIENT, file).split(path.sep).join('/');
    if (isCovered(file)) continue;
    // A test file's strings are never applied to an element (there is no DOM here), and this very file
    // quotes `'bg-teal-50 border-teal-200'` as the example of the shape it looks for: a check must not
    // scan its own bookkeeping, or it reddens on its own explanation.
    if (/\.test\.js$/.test(file)) continue;
    if (!/\.(js|ts|tsx|jsx|css|html|json|md)$/.test(file)) continue;
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (CLASS_LIST.test(line)) hits.push(`${rel}:${i + 1}`);
    });
  }
  assert.deepStrictEqual(hits, [],
    'a quoted class-name list appears in a file that no @source covers: if it is ever applied to an '
    + 'element, its utilities are missing from the stylesheet. Move the string into a scanned file '
    + '(a .tsx source) or declare the file in src/index.css.');
});
