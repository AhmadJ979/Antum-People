/**
 * The live-database guard — a check on the SOURCE of the suite, not on its behaviour.
 *
 * `server/db.js:14` binds `/home/team/.data/antum-product.db` — the database the demo reads from —
 * whenever `PRODUCT_DB_PATH` is unset, and `db.js` reads that variable when it loads. Loading it is
 * not inert either: at module level it executes `schema.sql` and then `applyColumnMigrations()`
 * (`db.js:81-89`), so pointing it at the live file can run DDL against the demo's data — and any
 * query a test then makes lands there.
 *
 * So a test file that loads `db.js` without pinning the path first does not merely fail. It writes
 * into the database a prospect is being shown: cases a test created appear in the roster on screen,
 * and a seed can be overwritten. Nothing is wrong today — the four files that never load `db.js`
 * are listed at the bottom — but the next mistake costs a demo, which is why this is a guard.
 *
 * What it catches, so the next reader knows what "loads db.js" means here:
 *   - a test file requiring `./db` directly, and
 *   - a test file requiring anything that loads it **transitively** — today `./preboarding`,
 *     `./preboarding-items`, `./preboarding-package`, `./preboarding-workspace`, `./migrate` — and
 *   - a pin placed **after** the first require that loads `db.js`, which is too late: the module has
 *     already bound the path by then.
 *
 * It reads the files rather than running them: the subject is the source, and the point is to fail
 * when someone adds the twelfth test file and forgets the pin.
 *
 * `db.js` itself is deliberately untouched. It is served (loaded by `server/index.js:4`), so changing
 * it is a movement with a cutover; this guard is the no-cutover interim answer, and the second test
 * below retires it honestly if the fallback ever changes.
 *
 * Legitimately not loading `db.js`, and therefore legitimately unpinned:
 * `eosb.test.js`, `privacy-notice.test.js`, `reachability.test.js`, `schema-migration.test.js`.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SERVER_DIR = __dirname;
const DB_MODULE = path.join(SERVER_DIR, 'db.js');
const SELF = path.basename(__filename);

/** Every relative require in a source file, in source order. */
const relativeRequires = (source) => {
  const found = [];
  const re = /require\(\s*['"](\.\/[^'"]+)['"]\s*\)/g;
  let match;
  while ((match = re.exec(source)) !== null) found.push({ spec: match[1], index: match.index });
  return found;
};

const resolveModule = (spec, fromFile) => {
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const candidate of [base, `${base}.js`, path.join(base, 'index.js')]) {
    try {
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {
      /* keep looking */
    }
  }
  return null;
};

const memo = new Map();

/** Does loading this file load `db.js`, directly or through anything it requires? */
const loadsDb = (file, visiting = new Set()) => {
  if (file === DB_MODULE) return true;
  if (memo.has(file)) return memo.get(file);
  if (visiting.has(file)) return false; // a cycle is not itself evidence
  visiting.add(file);
  let source = '';
  try {
    source = fs.readFileSync(file, 'utf8');
  } catch {
    source = '';
  }
  let result = false;
  for (const { spec } of relativeRequires(source)) {
    const target = resolveModule(spec, file);
    if (target && loadsDb(target, visiting)) {
      result = true;
      break;
    }
  }
  visiting.delete(file);
  memo.set(file, result);
  return result;
};

const pinIndex = (source) => {
  const match = /process\.env\.PRODUCT_DB_PATH\s*=/.exec(source);
  return match ? match.index : -1;
};

/** The index of the first require in `source` that pulls `db.js` in, or -1. */
const firstDbLoadIndex = (source, file) => {
  for (const { spec, index } of relativeRequires(source)) {
    const target = resolveModule(spec, file);
    if (target && loadsDb(target)) return index;
  }
  return -1;
};

const testFiles = fs
  .readdirSync(SERVER_DIR)
  .filter((name) => name.endsWith('.test.js') && name !== SELF)
  .sort();

const readTestFile = (name) => fs.readFileSync(path.join(SERVER_DIR, name), 'utf8');

test('no test file can reach the live product database without pinning the path first', () => {
  const offenders = [];

  for (const name of testFiles) {
    const file = path.join(SERVER_DIR, name);
    const source = readTestFile(name);
    const loadAt = firstDbLoadIndex(source, file);
    if (loadAt === -1) continue; // never loads db.js: nothing to pin

    const pinnedAt = pinIndex(source);
    if (pinnedAt === -1) {
      offenders.push(`${name}: loads db.js (directly or transitively) and never sets PRODUCT_DB_PATH — it would run against the live database`);
    } else if (pinnedAt > loadAt) {
      offenders.push(`${name}: sets PRODUCT_DB_PATH AFTER db.js is loaded — too late, the path is already bound; move the pin above the requires`);
    }
  }

  assert.deepStrictEqual(
    offenders,
    [],
    `a test file can reach the live product database (server/db.js:14 defaults to it, and merely loading db.js runs DDL):\n  ${offenders.join('\n  ')}\nSet process.env.PRODUCT_DB_PATH to a throwaway path (os.tmpdir() + a random name) ABOVE the first require that loads db.js.`
  );
});

test('the guard is actually looking at the files that load db.js (not passing vacuously)', () => {
  const loaders = testFiles.filter((name) => firstDbLoadIndex(readTestFile(name), path.join(SERVER_DIR, name)) !== -1);

  assert.ok(
    loaders.length >= 5,
    `the guard found only ${loaders.length} test file(s) that load db.js — if the module graph moved, this check must be re-grounded before its green means anything`
  );
  assert.ok(
    loaders.includes('preboarding-package.test.js') && loaders.includes('preboarding.test.js'),
    `the guard cannot see the files it exists to check; it found: ${loaders.join(', ')}`
  );
});

test('the premise: db.js still binds the product database when the path is unset', () => {
  const source = fs.readFileSync(DB_MODULE, 'utf8');
  assert.match(
    source,
    /process\.env\.PRODUCT_DB_PATH\s*\|\|/,
    'db.js no longer falls back to a default path — if the fallback is gone, this guard is obsolete and should be retired deliberately, not left green'
  );
  assert.match(
    source,
    /antum-product\.db/,
    'the fallback is no longer the product database this guard exists for'
  );
});
