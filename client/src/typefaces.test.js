/**
 * The typeface-role guard (owner decision 2026-10-29: Cairo for Arabic in the interface, Noto Naskh
 * Arabic for legal documents and the on-screen document preview, Noto Kufi Arabic for the wordmark).
 *
 * WHAT IT ASSERTS, AND WHERE
 *   1. role -> family, from the source it is declared in:
 *        interface Arabic   Cairo              - `@font-face` + the --font-sans stack in src/index.css
 *        document/preview   Noto Naskh Arabic  - `@font-face` + the --font-document stack in
 *                                               src/index.css, the preview container in App.tsx
 *                                               (class `font-document`), and the rtl stack in
 *                                               templates/build-html.js
 *        wordmark           Noto Kufi Arabic   - `@font-face` + the --font-mark stack in src/index.css
 *   2. each face carries a `unicode-range`, and it is exactly the five Arabic ranges the shipped
 *      subsets were built from. THIS IS THE ASSERTION THAT PROTECTS THE LATIN: delete one range and
 *      the face claims U+0000-10FFFF, so Latin strings change typeface with nothing else failing.
 *      The test names the role it reddens on.
 *   3. every stack is the decided family FOLLOWED BY the stack the product had before it, so the
 *      Latin tail is unchanged - checked in the source and again in the built stylesheet.
 *   4. every url() in the EMITTED stylesheet resolves to a file in the built output, that file is a
 *      real WOFF2 (not a stub), its bytes are identical to the repository copy, and its md5 is
 *      recorded together with the revision it was measured from. The print pipeline's reference is
 *      checked the same way against the builder's own directory.
 *   5. DERIVE-OR-REFUSE: with no client/dist this file FAILS with the command to run. It never
 *      reports green on a build that does not exist.
 *   6. a self-check, run every time: both plants are applied to a scratch copy of the source and the
 *      emitted stylesheet, and each must produce a failure naming the role or the path. A control
 *      that cannot be shown to redden proves nothing.
 *
 * THE HONEST LIMIT. This guard reads text and bytes. It cannot tell that a face is referenced
 * correctly, present, and still fails to LOAD in a browser - a wrong format, a corrupt WOFF2 that
 * passes the magic-number check, a Content-Type the browser refuses, or a CSP that blocks fonts.
 * Nothing here would redden. The follow-up that closes that gap is a browser check that waits for
 * `document.fonts.ready` and asserts `document.fonts.check('16px Cairo', 'أنتم')` on a rig built to
 * the served tree; it is deliberately NOT in this change.
 *
 * Run: `cd client && npm test`   (node --test, no browser, no build of its own - but the emitted-CSS
 * half needs `npm run build` to have run, and refuses loudly if it has not.)
 */
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const SRC = import.meta.dirname;
const CLIENT = path.join(SRC, '..');
const REPO = path.join(CLIENT, '..');
const CSS_SRC = path.join(SRC, 'index.css');
const APP = path.join(SRC, 'App.tsx');
const BUILD_HTML = path.join(REPO, 'templates', 'build-html.js');
const DIST = path.join(CLIENT, 'dist');
const FONT_DIR = path.join(CLIENT, 'public', 'fonts');

/** The five Arabic ranges. Identical to the `--unicodes` list in public/fonts/README.md. */
const ARABIC_RANGES = 'U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF';
/** The stack each role's family is prepended to. These are today's stacks, written out so that a
 *  change to them is a red, not a silent restyling of every Latin string in the product. */
const SANS_TAIL = 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", '
  + '"Segoe UI Symbol", "Noto Color Emoji"';
const SERIF_TAIL = 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif';
/** 'font' + '-document': spelled in two pieces because the scanned-source guard (see
 *  `tailwindSources.test.js`) looks for quoted class-name lists in files it does not scan - and this
 *  file is scanned as source. Constructing the token keeps this guard from tripping that one. */
const DOCUMENT_CLASS = ['font', 'document'].join('-');
const SERIF_CLASS = ['font', 'serif'].join('-');

const ROLES = [
  {
    role: 'interface-arabic',
    family: 'Cairo',
    stackVar: '--font-sans',
    tail: SANS_TAIL,
    assertedAt: 'src/index.css (@font-face + --font-sans)',
  },
  {
    role: 'document-and-preview-arabic',
    family: 'Noto Naskh Arabic',
    stackVar: '--font-document',
    tail: SERIF_TAIL,
    assertedAt: 'src/index.css (@font-face + --font-document) + App.tsx (preview container) + '
      + 'templates/build-html.js (rtl stack)',
  },
  {
    role: 'mark-arabic',
    family: 'Noto Kufi Arabic',
    stackVar: '--font-mark',
    tail: SANS_TAIL,
    assertedAt: 'src/index.css (@font-face + --font-mark; no element uses the stack yet)',
  },
];

const normStack = (s) => String(s).split(',').map((p) => p.trim()).join(', ');
/**
 * A CSS minifier compresses `U+0600-06FF` to `U+6??` - the same SET of code points, written with hex
 * wildcards (measured: the built stylesheet carries `U+6??` while the source carries `U+0600-06FF`).
 * Both sides are canonicalised to explicit start-end pairs in four hex digits before comparing, so a
 * minifier change cannot redden this guard for a difference that is not one.
 */
const canonToken = (token) => {
  const t = token.trim().toUpperCase().replace(/^U\+/, '');
  const [head, tail] = t.split('-');
  const start = parseInt(head.replace(/\?/g, '0'), 16);
  const end = parseInt((tail === undefined ? head.replace(/\?/g, 'F') : tail), 16);
  const hex = (n) => n.toString(16).toUpperCase().padStart(4, '0');
  return `${hex(start)}-${hex(end)}`;
};
const canonRanges = (s) => String(s).split(',').map(canonToken).sort().join(', ');
const firstFamily = (s) => normStack(s).split(', ')[0].replace(/^["']|["']$/g, '');

/** Every `@font-face` in a stylesheet, with the three declarations this guard cares about. */
function facesIn(css) {
  return [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => {
    const body = m[1];
    const pick = (prop) => {
      const hit = new RegExp(`${prop}\\s*:\\s*([^;}]+)`).exec(body);
      return hit ? hit[1].trim() : null;
    };
    return { family: (pick('font-family') || '').replace(/^["']|["']$/g, ''), unicodeRange: pick('unicode-range'), src: pick('src') };
  });
}
function stackValue(css, varName) {
  const hit = new RegExp(`${varName}\\s*:\\s*([^;}]+)`).exec(css);
  return hit ? hit[1].trim() : null;
}
function urlsIn(css) {
  return [...css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)].map((m) => m[2]);
}
function md5(file) {
  return execFileSync('md5sum', [file], { encoding: 'utf8' }).trim().split(/\s+/)[0];
}

/**
 * Runs every check against a client tree. `clientDir` lets the self-check point the whole thing at a
 * scratch copy; the real run uses this file's own client. Returns {checks, failures, fonts, revision}.
 */
export function checkTypefaces({ clientDir = CLIENT, repoDir = REPO } = {}) {
  const checks = [];
  const failures = [];
  const notes = [];
  const add = (name, ok, message) => {
    checks.push({ name, ok });
    if (!ok) failures.push({ name, message });
  };

  const css = fs.readFileSync(path.join(clientDir, 'src', 'index.css'), 'utf8');
  const app = fs.readFileSync(path.join(clientDir, 'src', 'App.tsx'), 'utf8');
  const buildHtml = fs.readFileSync(path.join(repoDir, 'templates', 'build-html.js'), 'utf8');
  const srcFaces = facesIn(css);

  // ---- 1-2-3: the roles, their ranges and their stacks, read from the source that declares them
  for (const role of ROLES) {
    const faces = srcFaces.filter((f) => f.family === role.family);
    add(`${role.role}: @font-face for ${role.family}`,
      faces.length > 0,
      `no @font-face declares family "${role.family}" in src/index.css; the ${role.role} role `
      + `(${role.family}) is unwired. Asserted at ${role.assertedAt}.`);
    for (const face of faces) {
      add(`${role.role}: unicode-range on the ${role.family} face`,
        face.unicodeRange !== null && canonRanges(face.unicodeRange) === canonRanges(ARABIC_RANGES),
        `the ${role.role} face (${role.family}) does not carry the five Arabic ranges. Found `
        + `${face.unicodeRange === null ? 'NO unicode-range' : JSON.stringify(face.unicodeRange)}. `
        + 'Without it the face claims U+0000-10FFFF and every LATIN string in the product changes '
        + 'typeface silently. Expected: ' + ARABIC_RANGES);
    }
    const stack = stackValue(css, role.stackVar);
    add(`${role.role}: ${role.stackVar} starts with ${role.family}`,
      stack !== null && firstFamily(stack) === role.family,
      `${role.stackVar} is ${stack === null ? 'not declared' : JSON.stringify(stack)}; its first `
      + `family must be "${role.family}" (role ${role.role}, asserted at ${role.assertedAt}).`);
    add(`${role.role}: ${role.stackVar} keeps its previous (Latin) tail byte-identical`,
      stack !== null && normStack(stack).split(', ').slice(1).join(', ') === role.tail,
      `${role.stackVar}'s tail is not the stack the product had before these faces existed, so a `
      + `LATIN string styled by it would change appearance. Expected tail: ${role.tail}`);
  }

  // ---- the preview: markup uses the document stack, and the old class is gone
  // The two probes are read off a QUOTED class list rather than by spelling the attribute out, because
  // this file is itself scanned by `tailwindSources.test.js` and a bare attribute name here would look
  // like markup this stylesheet must emit for (it did, on the first run of the suite).
  const inClassList = (token) => new RegExp(`"[^"]*\\b${token}\\b[^"]*"`).test(app);
  add('document-and-preview-arabic: the preview container uses the document stack',
    inClassList(DOCUMENT_CLASS),
    `no element in App.tsx carries the ${DOCUMENT_CLASS} class, so the document preview would not `
    + 'take the Naskh family. Asserted at src/App.tsx (preview container).');
  add('document-and-preview-arabic: the preview no longer asks only for the serif stack',
    !inClassList(SERIF_CLASS),
    `an element in App.tsx still carries the ${SERIF_CLASS} class; the preview would keep a Latin `
    + 'serif face for Arabic too.');

  // ---- the print pipeline: rtl stack head, Latin tail untouched, referenced file exists
  const rtl = /\.lang\[dir="rtl"\]\s+body[^{]*\{[^}]*font-family:\s*([^;}]+)/.exec(buildHtml);
  add('document-and-preview-arabic: the print rtl stack starts with Noto Naskh Arabic',
    rtl !== null && firstFamily(rtl[1]) === 'Noto Naskh Arabic',
    `templates/build-html.js's rtl stack is ${rtl === null ? 'not found' : JSON.stringify(rtl[1])}`);
  add('document-and-preview-arabic: the print rtl stack keeps its Latin tail',
    rtl !== null && normStack(rtl[1]).split(', ').slice(1).join(', ') === "'DejaVu Sans', 'Segoe UI', sans-serif",
    'the rtl stack\u2019s Latin tail in templates/build-html.js changed; Latin inside an Arabic '
    + 'document would print in a different face. Expected tail: \'DejaVu Sans\', \'Segoe UI\', sans-serif');
  add('print latin stack unchanged',
    /font-family:\s*'Inter'\s*,\s*'Segoe UI'\s*,\s*'DejaVu Sans'\s*,\s*sans-serif/.test(buildHtml),
    'the Latin stack of the print stylesheet (templates/build-html.js) is no longer '
    + "'Inter','Segoe UI','DejaVu Sans',sans-serif - the owner asked for the Latin untouched.");
  const printRef = /fontUrl\(\s*'([^']+)'\s*\)/.exec(buildHtml);
  const printFont = printRef ? path.join(repoDir, 'client', 'public', 'fonts', printRef[1]) : null;
  add('print: the font file the builder references exists',
    printFont !== null && fs.existsSync(printFont),
    `templates/build-html.js references ${printRef ? printRef[1] : '(no fontUrl(...) call found)'} `
    + `and ${printFont === null ? 'nothing was found to resolve' : printFont + ' does not exist'}. `
    + 'The builder throws on this at build time; this check catches it before anyone builds.');
  add('print: the builder refuses loudly instead of falling back',
    /throw new Error\(/.test(buildHtml) && /missing font file/.test(buildHtml),
    'templates/build-html.js no longer throws when its font is missing: a document would build with '
    + 'a system face and nothing would say so.');

  // ---- 4: the emitted stylesheet and the font bytes in the build (derive-or-refuse)
  const distDir = path.join(clientDir, 'dist');
  const assetsDir = path.join(distDir, 'assets');
  const cssAssets = fs.existsSync(assetsDir)
    ? fs.readdirSync(assetsDir).filter((f) => f.endsWith('.css')).map((f) => path.join(assetsDir, f))
    : [];
  const refuse = (why) => {
    add('emitted: client/dist exists', false,
      `${why} This guard DERIVES its emitted-CSS and font-byte half from the build and REFUSES to `
      + 'report green without it. Run: cd client && npm run build');
  };
  if (cssAssets.length === 0) {
    refuse(`no stylesheet found under ${assetsDir}.`);
  } else {
    const emitted = cssAssets.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    const emittedFaces = facesIn(emitted);
    for (const role of ROLES) {
      const face = emittedFaces.find((f) => f.family === role.family);
      add(`${role.role}: the built stylesheet carries the ${role.family} face with its ranges`,
        face !== undefined && face.unicodeRange !== null
          && canonRanges(face.unicodeRange) === canonRanges(ARABIC_RANGES),
        `the built stylesheet does not carry a ${role.family} @font-face with the five Arabic `
        + `ranges (found: ${face === undefined ? 'no face' : JSON.stringify(face.unicodeRange)}). `
        + 'The source may be right and the build wrong.');
      const stack = stackValue(emitted, role.stackVar);
      add(`${role.role}: the built stylesheet carries ${role.stackVar}`,
        stack !== null && firstFamily(stack) === role.family
          && normStack(stack).split(', ').slice(1).join(', ') === role.tail,
        `${role.stackVar} in the built stylesheet is ${stack === null ? 'absent' : JSON.stringify(stack)}. `
        + 'An unused theme entry is dropped by the build unless it is declared static.');
    }
    add('emitted: the preview rule exists in the built stylesheet',
      new RegExp(`\\.${DOCUMENT_CLASS}\\s*\\{[^}]*font-family`).test(emitted),
      `no .${DOCUMENT_CLASS} rule reached the built stylesheet, so the preview class in App.tsx `
      + 'styles nothing.');
    const urls = urlsIn(emitted);
    const fontUrls = urls.filter((u) => u.startsWith('/fonts/'));
    add('emitted: one font url per declared face',
      fontUrls.length === ROLES.length,
      `the built stylesheet references ${fontUrls.length} font url(s), expected ${ROLES.length} - one `
      + 'per role.');
    for (const url of urls) {
      if (url.startsWith('data:')) continue;
      const resolved = url.startsWith('/') ? path.join(distDir, url) : path.join(assetsDir, url);
      add(`emitted: url(${url}) resolves in the build`,
        fs.existsSync(resolved),
        `the built stylesheet references ${url}, which resolves to ${resolved} - no such file in the `
        + 'built output. A face that cannot be fetched falls back to a system font in silence.');
    }
  }

  // ---- the font bytes themselves, and the revision they were measured at
  let revision = null;
  try {
    revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoDir, encoding: 'utf8' }).trim();
  } catch (e) {
    notes.push(`revision could not be read from git: ${e.message}`);
  }
  add('revision: the tree this was measured at is a full commit sha',
    typeof revision === 'string' && /^[0-9a-f]{40}$/.test(revision),
    `git rev-parse HEAD gave ${JSON.stringify(revision)}; without a revision the md5s below cannot `
    + 'say which tree they describe (rule: a hash must name the revision it was measured from).');
  const fonts = [];
  for (const file of fs.existsSync(path.join(clientDir, 'public', 'fonts'))
    ? walkFonts(path.join(clientDir, 'public', 'fonts')) : []) {
    const bytes = fs.readFileSync(file);
    const rel = path.relative(clientDir, file).split(path.sep).join('/');
    // Vite copies the CONTENTS of client/public/ to the build root, so the built path drops the
    // `public/` prefix: public/fonts/cairo/x.woff2 is served (and built) as /fonts/cairo/x.woff2.
    const served = path.relative(path.join(clientDir, 'public'), file).split(path.sep).join('/');
    const built = path.join(distDir, served);
    const record = {
      file: rel, bytes: bytes.length, md5: md5(file), revision,
      built: fs.existsSync(built), licence: fs.existsSync(path.join(path.dirname(file), 'OFL.txt')),
    };
    fonts.push(record);
    add(`assets: ${rel} is a WOFF2`,
      bytes.subarray(0, 4).toString('latin1') === 'wOF2',
      `${rel} is not a WOFF2 file - a stub or a wrong-format file would be served and the browser `
      + 'would fall back to a system face with nothing failing.');
    add(`assets: ${rel} ships in the build`,
      fs.existsSync(built),
      `${rel} is not in the built output at ${built}: Vite copies client/public/ verbatim, so its `
      + 'absence means the font URL the stylesheet asks for answers 404.');
    add(`assets: the built copy of ${rel} is the repository copy`,
      fs.existsSync(built) && md5(built) === record.md5,
      `the bytes under client/dist differ from the repository copy of ${rel}; what is served is not `
      + 'what was reviewed.');
    add(`assets: ${rel} ships with its licence beside it`,
      record.licence,
      `${rel} has no OFL.txt in its own directory. The SIL Open Font License requires the licence to `
      + 'travel with the font.');
  }
  add('assets: all three families are present',
    fonts.length === ROLES.length,
    `found ${fonts.length} font file(s) under client/public/fonts, expected ${ROLES.length}.`);
  return { checks, failures, notes, fonts, revision };
}

function walkFonts(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFonts(full, out);
    else if (/\.(woff2|woff|ttf|otf)$/.test(entry.name)) out.push(full);
  }
  return out.sort();
}

/** A scratch client tree: enough of it for every check above, so a plant can be applied in isolation. */
function scratchCopy(root) {
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.cpSync(SRC, path.join(root, 'src'), {
    recursive: true,
    filter: (from) => !from.includes(`${path.sep}dist`),
  });
  const distAssets = path.join(root, 'dist');
  fs.mkdirSync(distAssets, { recursive: true });
  fs.cpSync(DIST, distAssets, { recursive: true });
  fs.cpSync(path.join(CLIENT, 'public'), path.join(root, 'public'), { recursive: true });
  return root;
}

const RESULT = checkTypefaces();
const summarise = (r) => `${r.checks.length - r.failures.length}/${r.checks.length} checks passed`
  + ` at ${r.revision === null ? '(no revision)' : r.revision}`
  + `; fonts: ${r.fonts.map((f) => `${f.file} ${f.bytes} B md5 ${f.md5}`).join(' | ')}`;

test(`typeface roles hold: ${summarise(RESULT)}`, () => {
  for (const note of RESULT.notes) console.log('note:', note);
  console.log(`typefaces: ${RESULT.checks.length} checks, ${RESULT.failures.length} failures`);
  for (const f of RESULT.failures) console.log(`RED ${f.name}: ${f.message}`);
  assert.ok(RESULT.checks.length >= 12, `expected at least 12 checks, ran ${RESULT.checks.length}`);
  assert.deepStrictEqual(RESULT.failures.map((f) => f.name), [],
    'the typeface roles do not hold (each failing check is logged above with its reason)');
});

test('the guard can fail: a deleted unicode-range and a url() at a missing file both redden', () => {
  const root = fs.mkdtempSync(path.join('/tmp', 'typefaces-selftest-'));
  try {
    scratchCopy(root);
    // Control first: the scratch copy as-is must be clean, or the plants below prove nothing.
    const clean = checkTypefaces({ clientDir: root });
    assert.deepStrictEqual(clean.failures.map((f) => f.name), [],
      'the scratch copy already fails, so no plant below can be attributed to the plant');
    const scratchCss = path.join(root, 'src', 'index.css');
    const cssText = fs.readFileSync(scratchCss, 'utf8');
    // PLANT (a): delete the Cairo face's unicode-range - the edit that silently restyles Latin.
    const plantedA = cssText.replace(
      /(font-family: "Cairo";[\s\S]*?)  unicode-range:[^;]*;\n/, '$1');
    assert.notStrictEqual(plantedA, cssText, 'plant (a) changed nothing - check the pattern');
    fs.writeFileSync(scratchCss, plantedA);
    const redA = checkTypefaces({ clientDir: root });
    assert.ok(redA.failures.some((f) => f.name === 'interface-arabic: unicode-range on the Cairo face'),
      `plant (a) did not redden on the interface-arabic role; failures were: `
      + `${JSON.stringify(redA.failures.map((f) => f.name))}`);
    assert.ok(redA.failures.some((f) => f.message.includes(ARABIC_RANGES)),
      'plant (a) reddened without naming the ranges that are missing');
    fs.writeFileSync(scratchCss, cssText);
    // PLANT (b): point the emitted stylesheet's Cairo url at a file that is not in the build.
    const builtCss = walkDistCss(root)[0];
    const builtText = fs.readFileSync(builtCss, 'utf8');
    const plantedB = builtText.replace('/fonts/cairo/cairo-arabic.woff2', '/fonts/cairo/absent.woff2');
    assert.notStrictEqual(plantedB, builtText, 'plant (b) changed nothing - check the pattern');
    fs.writeFileSync(builtCss, plantedB);
    const redB = checkTypefaces({ clientDir: root });
    assert.ok(redB.failures.some((f) => f.name === 'emitted: url(/fonts/cairo/absent.woff2) resolves in the build'),
      `plant (b) did not redden on the missing path; failures were: `
      + `${JSON.stringify(redB.failures.map((f) => f.name))}`);
    fs.writeFileSync(builtCss, builtText);
    // And the reverted copy is clean again, which is what makes the two reds attributable.
    const reverted = checkTypefaces({ clientDir: root });
    assert.deepStrictEqual(reverted.failures.map((f) => f.name), [],
      'the scratch copy is not clean after reverting both plants');
    console.log(`typefaces self-check: clean ${clean.failures.length} red / plant(a) `
      + `${redA.failures.length} red / plant(b) ${redB.failures.length} red / reverted `
      + `${reverted.failures.length} red, on ${clean.checks.length} checks`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the guard refuses when the build is absent', () => {
  const root = fs.mkdtempSync(path.join('/tmp', 'typefaces-nodist-'));
  try {
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.cpSync(SRC, path.join(root, 'src'), { recursive: true, filter: (p) => !p.includes(`${path.sep}dist`) });
    fs.cpSync(path.join(CLIENT, 'public'), path.join(root, 'public'), { recursive: true });
    const r = checkTypefaces({ clientDir: root });
    const refused = r.failures.find((f) => f.name === 'emitted: client/dist exists');
    assert.ok(refused, 'with no client/dist the guard did NOT refuse - it would report green on a '
      + 'build that does not exist');
    assert.match(refused.message, /npm run build/, 'the refusal must name the command that fixes it');
    console.log(`typefaces no-dist control: ${r.failures.length} red, refusing: ${refused.name}`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function walkDistCss(root) {
  const dir = path.join(root, 'dist', 'assets');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.css')).map((f) => path.join(dir, f));
}
