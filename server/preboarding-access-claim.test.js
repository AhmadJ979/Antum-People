/**
 * GUARD — a sentence the product SERVES must not state an access fact the access model contradicts.
 *
 * ---------------------------------------------------------------------------
 * THE DEFECT THIS FILE EXISTS FOR, quoted rather than paraphrased
 * ---------------------------------------------------------------------------
 * Until this change `preboarding-workspace.js` served, in `view.note` of every workspace board:
 *
 *   "This narrows the board to one function. It is a filter, not access control: everyone signed in
 *    can still open any case and see every line. Per-user scoping — "My lines" — ships with per-user
 *    accounts at Layer 3."
 *
 * Both halves were false in the tree they shipped in:
 *
 *   - the route behind that payload is `GET /preboarding/cases/:id/workspace` -> resource
 *     `preboarding:read:own` (server/access.js ROUTES), whose cell in POLICY holds `hr_admin`
 *     ALONE — so a signed-in `manager`, `finance`, `employee` or `compliance_viewer` is refused
 *     (403, no body) before the board is built. Saying "everyone signed in can open any case"
 *     UNDERSTATES a control the product enforces;
 *   - the per-user accounts that scoping was deferred to have shipped (Layer 3 is built, served and
 *     escalating), so the sentence also described a plan already executed. What is actually missing
 *     is the case -> person join (`PENDING_CELLS`), which is a schema gap, not a Layer-3 one.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS GUARD PROVES, AND WHAT IT CANNOT
 * ---------------------------------------------------------------------------
 * Proves, with the truth DERIVED FROM server/access.js at run time (never retyped here):
 *   1. the note read off a REAL board payload names the resource that governs the route;
 *   2. it names every role the access model knows — the allowed ones because omitting one would
 *      understate the control, the refused ones because a reader must be able to tell they are
 *      refused;
 *   3. it states a refusal and says what is NOT built;
 *   4. no served string anywhere in server/ (tests excluded) carries the removed claim's shapes
 *      again — so a sibling instance reddens here too, not just this one.
 * Because the cell is read from `access.js`, changing the cell and not the sentence reddens this
 * file, and so does changing the sentence away from the cell.
 *
 * Cannot prove: that the gate actually behaves as the sentence says (that every other role is
 * refused, 403 with an empty body, on this route). That is `server/access.test.js`'s job, asserted
 * on the gate itself with real roles; this file only holds TEXT against the TABLE it cites. Nor can
 * it prove any screen renders the sentence — the client draws `view.note` verbatim, and a rendered
 * claim needs a rig pass (rule: an API reading is not a rendered claim).
 *
 * HOW IT RUNS — the server suite, on its own throwaway database:
 *     cd server && PRODUCT_DB_PATH=/tmp/claim.db node --test preboarding-access-claim.test.js
 * or the whole suite (`cd server && npm test`), where it runs with every other server test.
 *
 * Comments are stripped before the claim sweep, deliberately: this file's own header and the two
 * module comments corrected alongside it quote the removed wording as history, and a historical
 * quote must not be able to self-trip the check. The stripper is a small reader, not a parser: it
 * does not understand regex literals, which is why no check depends on how a regex is spelled.
 */
const { test, describe, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const TEST_DB = path.join(os.tmpdir(), `antum-p24-access-claim-${randomUUID()}.db`);
process.env.PRODUCT_DB_PATH = TEST_DB;

const db = require('./db'); // eslint-disable-line no-unused-vars -- opened for its side effect
const preboarding = require('./preboarding');
const workspace = require('./preboarding-workspace');
const access = require('./access');

const SERVER_DIR = __dirname;
/** The route that serves the board whose note this file judges. */
const BOARD_ROUTE = ['GET', '/preboarding/cases/:id/workspace'];

/** Remove `//` and `/* *\/` comments, keeping every string literal's contents. */
function stripComments(src) {
  let out = '';
  let quote = null;
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') { out += n === undefined ? '' : n; i += 2; continue; }
      if (c === quote) quote = null;
      i += 1;
      continue;
    }
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i += 1; continue; }
    if (c === '/' && n === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; out += c; i += 1; continue; }
    out += c;
    i += 1;
  }
  return out;
}

const WORKSPACE_PATH = path.join(SERVER_DIR, 'preboarding-workspace.js');
const WORKSPACE_SOURCE = fs.readFileSync(WORKSPACE_PATH, 'utf8');
const WORKSPACE_CODE = stripComments(WORKSPACE_SOURCE);

/**
 * The shapes the removed sentence had. Each names WHY it is banned, so a future reader can judge a
 * near miss instead of pattern-matching against a list.
 */
const REMOVED_CLAIM_SHAPES = [
  {
    re: /everyone signed in/i,
    why: 'claims any signed-in caller can reach this board — the gate allows `hr_admin` alone on '
      + '`preboarding:read:own`, so the sentence understates a control the product enforces',
  },
  {
    re: /any case and see every line/i,
    why: 'is the removed sentence itself: an unfiltered reach claimed for every caller, which no '
      + 'role but `hr_admin` has',
  },
  {
    re: /ships with per-user accounts/i,
    why: 'defers a capability to per-user accounts, which have shipped — a served sentence must '
      + 'state what is missing (`PENDING_CELLS`: no case -> person join), not a plan already executed',
  },
  {
    re: /ships at Layer 3/i,
    why: 'points a shipped capability at a layer that is built, served and escalating',
  },
  {
    re: /not knowable at request time/i,
    why: 'asserts the caller is unknowable when the gate reads `req.user.access_role` on every '
      + 'request — an access claim the code contradicts',
  },
  {
    re: /one shared account/i,
    why: 'is the shared-account premise itself; the surface signs in per user, with a role',
  },
];

/** The resource the board's route is mapped to, read from the access model — never retyped. */
function resourceForBoardRoute() {
  const route = access.ROUTES.find(([method, pattern]) => method === BOARD_ROUTE[0] && pattern === BOARD_ROUTE[1]);
  assert.ok(route,
    `server/access.js ROUTES no longer declares ${BOARD_ROUTE[0]} ${BOARD_ROUTE[1]}. This guard judges `
    + 'the note served by that route: if the route moved, re-point the guard at its new resource '
    + 'rather than deleting it.');
  return route[2];
}

let offerCounter = 0;
/** Open a case through the single creation path, exactly as the intake form does. */
const openCase = async (overrides = {}) => {
  offerCounter += 1;
  const { case: row } = await preboarding.recordOfferAcceptance({
    offer_reference: `OFR-2026-CLAIM-${100 + offerCounter}`,
    candidate_name: 'Sara Nasser',
    candidate_email: 'sara.nasser@example.com',
    role: 'Sales Executive',
    department: 'Sales',
    reporting_line: 'Head of Sales',
    jurisdiction: 'AE',
    start_date: '2026-11-16',
    ...overrides,
  }, { actor: 'test-runner', source: 'intake_form' });
  return row;
};

after(() => {
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    try { fs.unlinkSync(TEST_DB + suffix); } catch { /* not created */ }
  }
});

describe('P2-4 · the served workspace note matches the access model', () => {
  test('the note in the payload names the cell that governs the route, and every role it knows', async () => {
    const resource = resourceForBoardRoute();
    const cell = access.POLICY[resource];
    assert.ok(Array.isArray(cell) && cell.length > 0,
      `the access model has no cell for ${resource}: this guard derives the note's truth from it, so `
      + 'an empty cell would make every assertion below vacuous');

    const row = await openCase();
    const board = await workspace.workspaceBoard(row.id);
    const note = board.view.note;

    // Anti-vacuity: the guard must be reading a real sentence, not an absent or stub field.
    assert.ok(typeof note === 'string' && note.length > 150,
      `the board serves no usable view.note (${typeof note}, length ${typeof note === 'string' ? note.length : 'n/a'}): `
      + 'there is nothing to hold against the access model');
    assert.strictEqual(note, workspace.VIEW_NOTE,
      'the payload and the exported constant disagree, so this guard is judging a string the '
      + 'product may not be serving');

    assert.ok(note.indexOf(resource) !== -1,
      `the served note does not name "${resource}", the resource its route is mapped to. A claim `
      + 'about who may open a case must name the rule it rests on, so a reader can check it.');

    for (const role of access.ROLE_LIST) {
      const named = new RegExp(`\\b${role}\\b`);
      const allowed = cell.indexOf(role) !== -1;
      assert.match(note, named, allowed
        ? `the served note does not name "${role}", which the cell for ${resource} ALLOWS. Omitting `
          + 'an allowed role understates a control the product enforces — the defect this guard '
          + 'was built for, in the opposite direction.'
        : `the served note does not name "${role}", which the cell for ${resource} REFUSES. A `
          + 'reader cannot tell that role is turned away, so the sentence may be claiming reach for '
          + 'a role the gate refuses.');
    }

    assert.match(note, /refus/i,
      'the served note states the role set but not the refusal: the cell is enforced by a 403, and '
      + 'a list of allowed roles alone leaves a reader to guess what happens to the others');
    assert.match(note, /not built/i,
      'the served note no longer says what is NOT built. Withholding the limitation is a legitimate '
      + 'answer only if it is a decision: if the sentence was narrowed on purpose, update this guard '
      + 'to assert the new truth (and say in the PR why the limitation is no longer stated) rather '
      + 'than deleting the check.');
    assert.match(note, /filter, not access control/i,
      'the note still has to tell the reader that the function chips are a FILTER: that much was '
      + 'always true, and it is the one part of the old sentence that must survive the correction');
  });

  test('every role in the note is CLASSIFIED — naming a role is not the same as placing it', async () => {
    // The presence check above would pass a sentence that named all five roles and then said the
    // wrong side of the cell. This one reads each role's own clause: a role the cell refuses must
    // sit in a clause that states the refusal, and a role it allows must not.
    const resource = resourceForBoardRoute();
    const cell = access.POLICY[resource];
    const row = await openCase();
    const note = (await workspace.workspaceBoard(row.id)).view.note;
    const clauses = note.split(/[.;]|\u2014/).map((clause) => clause.trim()).filter(Boolean);

    for (const role of access.ROLE_LIST) {
      const own = clauses.filter((clause) => new RegExp(`\\b${role}\\b`).test(clause));
      assert.ok(own.length > 0, `no clause in the served note mentions "${role}"`);
      const refusedIn = own.filter((clause) => /refus/i.test(clause));
      if (cell.indexOf(role) !== -1) {
        assert.strictEqual(refusedIn.length, 0,
          `the served note places "${role}" in a clause that refuses it, but the cell for ${resource} `
          + `ALLOWS it (${cell.join(', ')}): the sentence now understates the control for a role the `
          + 'product serves');
      } else {
        assert.ok(refusedIn.length > 0,
          `the served note names "${role}" but never refuses it in the same clause, and the cell for `
          + `${resource} does not allow it (${cell.join(', ')}): a reader can take the sentence as `
          + 'granting a role the gate turns away. State the refusal beside the role.');
      }
    }
  });

  test('no served string or code path in the module carries the removed claim again', () => {
    assert.ok(WORKSPACE_CODE.indexOf('note: VIEW_NOTE') !== -1,
      'the payload no longer serves VIEW_NOTE, so the sentence this guard checks is not the one '
      + 'being served — re-point the guard before trusting a green run');
    for (const { re, why } of REMOVED_CLAIM_SHAPES) {
      assert.doesNotMatch(WORKSPACE_CODE, re,
        `preboarding-workspace.js carries /${re.source}/ again outside its comments: that shape ${why}. `
        + 'server/preboarding-access-claim.test.js is what noticed; correct the sentence against '
        + 'server/access.js POLICY/ROUTES rather than relaxing this check.');
    }
  });

  test('a sibling instance anywhere in server/ reddens this file too, not just the note above', () => {
    const files = fs.readdirSync(SERVER_DIR)
      .filter((name) => name.endsWith('.js') && !name.endsWith('.test.js'));
    assert.ok(files.length > 10,
      `only ${files.length} server modules were scanned: this sweep is not looking at the tree it `
      + 'claims to sweep');
    for (const name of files) {
      const code = stripComments(fs.readFileSync(path.join(SERVER_DIR, name), 'utf8'));
      for (const { re, why } of REMOVED_CLAIM_SHAPES) {
        assert.doesNotMatch(code, re,
          `${name} carries /${re.source}/ outside its comments: ${why}. The same false premise was `
          + 'served from preboarding-workspace.js for weeks because nothing swept its siblings.');
      }
    }
  });

  test('the corrected comments still carry the quote they correct, so this guard has a history', () => {
    // Not a served string: this is the record that the premise was removed rather than never held.
    assert.match(WORKSPACE_SOURCE, /one shared account/,
      'the rule-4 comment no longer names the shared-account premise this guard was built for. A '
      + 'guard whose history is edited away cannot be reviewed: keep the quote, correct beside it.');
    assert.match(WORKSPACE_SOURCE, /not knowable at request time/,
      'the rule-4 comment no longer quotes the "unknown caller" premise; that sentence is the '
      + 'reason the note was wrong, and a reader needs it to judge the correction');
  });
});
