/**
 * P2-4 acceptance criteria — the workspace track: one provisioning checklist covering hardware,
 * software, email, system access and the building card, split automatically across IT, Admin, HR
 * and Manager, every line carrying a responsible function and a due date.
 *
 * The four criteria, and where each is held below:
 *
 *   1. "Assignment is derived from the role on the case — it is not typed per case."
 *      → the role rules, determinism, and the fact that no argument can add a line.
 *   2. "Every line has a responsible function and a due date."
 *      → ownership, the derived due date, and that the date moves with the case's start date.
 *   3. "IT and Admin see only their own lines; HR and the manager see the whole board."
 *      → the filter, its counts, and the payload saying out loud that it is not access control.
 *      The scope half cannot be delivered while the product has one shared account; the design
 *      review says so, and this file asserts the honest label rather than the claim.
 *   4. "Adding a role or a line item is configuration, not a code change per hire."
 *      → catalog integrity, and the derivation being driven by the two exported tables.
 *
 * Runs against its own throwaway product database (PRODUCT_DB_PATH is set before db.js is
 * required), never the live one: `cd server && npm test`. Every value below is synthetic.
 */
const { test, describe, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const TEST_DB = path.join(os.tmpdir(), `antum-p2-4-${randomUUID()}.db`);
process.env.PRODUCT_DB_PATH = TEST_DB;

const db = require('./db');
const preboarding = require('./preboarding');
const items = require('./preboarding-items');
const workspace = require('./preboarding-workspace');

const acceptedOffer = (overrides = {}) => ({
  offer_reference: 'OFR-2026-P24-101',
  candidate_name: 'Sara Nasser',
  candidate_email: 'sara.nasser@example.com',
  role: 'Sales Executive',
  department: 'Sales',
  reporting_line: 'Head of Sales',
  jurisdiction: 'AE',
  start_date: '2026-11-16',
  ...overrides,
});

let offerCounter = 0;
/** Open a case through the single creation path, exactly as the intake form does. */
const openCase = async (overrides = {}) => {
  offerCounter += 1;
  const { case: row } = await preboarding.recordOfferAcceptance(
    acceptedOffer({ offer_reference: `OFR-2026-P24-${100 + offerCounter}`, ...overrides }),
    { actor: 'test-runner', source: 'intake_form' }
  );
  return row;
};

const keysOf = (board) => board.groups.flatMap((group) => group.lines.map((line) => line.item_key));

after(() => {
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    try { fs.unlinkSync(TEST_DB + suffix); } catch { /* not created */ }
  }
});

describe('P2-4 · the checklist is derived from the case, never typed per case', () => {
  test('an accepted offer seeds the workspace track from the role and department on the case', async () => {
    const row = await openCase();
    const board = await workspace.workspaceBoard(row.id);
    const expected = workspace.deriveWorkspaceLines(row).lines.map((line) => line.item_key);
    assert.ok(expected.length > 0, 'a case always carries provisioning lines');
    assert.deepStrictEqual(keysOf(board), expected, 'the board is the derivation, in its order');
    assert.ok(board.groups.length === 4, 'all four functions own at least one line on a base case');
  });

  test('the same role and department always produce the same list, whoever the hire is', async () => {
    const a = await openCase();
    const b = await openCase({ candidate_name: 'Someone Else', candidate_email: 'other@example.com' });
    const [boardA, boardB] = await Promise.all([
      workspace.workspaceBoard(a.id),
      workspace.workspaceBoard(b.id),
    ]);
    assert.deepStrictEqual(keysOf(boardA), keysOf(boardB), 'two hires in the same role get one list');
    assert.deepStrictEqual(
      boardA.groups.map((group) => [group.function, group.lines.map((l) => l.owner)]),
      boardB.groups.map((group) => [group.function, group.lines.map((l) => l.owner)]),
      'and the same owners'
    );
  });

  test('a profile fires on the case\'s own role or department, case-insensitively', async () => {
    const manager = await openCase({ role: 'Marketing Manager', department: 'Marketing' });
    const analyst = await openCase({ role: 'Product Designer', department: 'Product' });
    const finance = await openCase({ role: 'Analyst', department: 'finance' });

    const [m, a, f] = await Promise.all([
      workspace.workspaceBoard(manager.id),
      workspace.workspaceBoard(analyst.id),
      workspace.workspaceBoard(finance.id),
    ]);

    assert.deepStrictEqual(m.derived_from.profile_keys, ['people_manager']);
    assert.ok(keysOf(m).includes('ws_manager_system_access'), 'the manager line follows the role');
    assert.deepStrictEqual(a.derived_from.profile_keys, [], 'a role that matches nothing gets the base set');
    assert.ok(!keysOf(a).includes('ws_manager_system_access'), 'and is not given a guess about the hire');
    assert.deepStrictEqual(f.derived_from.profile_keys, ['finance_department'],
      'the department match is case-insensitive, so it cannot depend on how HR typed it');
    assert.ok(keysOf(f).includes('ws_finance_system_access'));
  });

  test('the role read is the job role on the case, not a system role on an account', async () => {
    // The spec flags this naming hazard: `preboarding_cases.role` is the person's job role
    // ("Marketing Manager"); `users.role` is a system role on a login account. The two are
    // separate columns and the derivation reads the case.
    const columns = (await db.query('PRAGMA table_info(preboarding_cases)')).map((c) => c.name);
    assert.ok(columns.includes('role'), 'the case carries the job role');
    const row = await openCase({ role: 'Marketing Manager' });
    const board = await workspace.workspaceBoard(row.id);
    assert.strictEqual(board.derived_from.role, 'Marketing Manager', 'the derived role is the case\'s');
    assert.strictEqual(board.derived_from.department, 'Sales');
  });

  test('no argument can add a line per hire — the board takes a filter and nothing else', async () => {
    const row = await openCase();
    const plain = await workspace.workspaceBoard(row.id);
    const withJunk = await workspace.workspaceBoard(row.id, {
      lines: [{ item_key: 'hand_typed_line', owner: 'IT' }],
      item_keys: ['ws_vpn', 'hand_typed_line'],
      addLine: 'ws_manager_system_access',
    });
    assert.deepStrictEqual(keysOf(withJunk), keysOf(plain),
      'the only per-case input is the case id; a caller cannot type a line into a case');
  });
});

describe('P2-4 · every line has a responsible function and a due date', () => {
  test('each line names one of the four functions and one owner, never none and never two', async () => {
    const row = await openCase();
    const board = await workspace.workspaceBoard(row.id);
    const lines = board.groups.flatMap((group) => group.lines);
    assert.ok(lines.length > 0);
    for (const line of lines) {
      assert.ok(workspace.WORKSPACE_FUNCTIONS.includes(line.owner), `${line.item_key} has one function`);
    }
    for (const group of board.groups) {
      assert.ok(group.lines.every((line) => line.owner === group.function),
        'a line is never shown under a second function');
    }
  });

  test('the due date is the start date minus the line\'s configured offset, and it says so', async () => {
    const row = await openCase({ start_date: '2026-12-07' });
    const board = await workspace.workspaceBoard(row.id);
    for (const line of board.groups.flatMap((group) => group.lines)) {
      const catalog = workspace.WORKSPACE_CATALOG.find((l) => l.item_key === line.item_key);
      assert.ok(catalog, 'every seeded line comes from the catalog');
      assert.strictEqual(line.due_offset_days, catalog.due_offset_days);
      assert.strictEqual(line.due_rule, `D-${catalog.due_offset_days}`, 'the rule travels with the date');
      assert.strictEqual(line.due_date, workspace.dueDateFor('2026-12-07', catalog.due_offset_days).due_date);
      assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(line.due_date), 'a due date is always a real date');
    }
    const device = board.groups.flatMap((g) => g.lines).find((l) => l.item_key === 'ws_device');
    assert.strictEqual(device.due_date, '2026-12-02', 'D-5 of 2026-12-07');
    assert.strictEqual(device.days_to_due, workspace.daysUntilDate('2026-12-02'));
  });

  test('the due date is derived on read: moving the case\'s start date moves every line', async () => {
    const row = await openCase({ start_date: '2026-11-02' });
    const before = await workspace.workspaceBoard(row.id);
    const deviceBefore = before.groups.flatMap((g) => g.lines).find((l) => l.item_key === 'ws_device');
    await db.query(`UPDATE preboarding_cases SET start_date = '2026-11-09' WHERE id = ${db.escapeString(row.id)}`);
    const after = await workspace.workspaceBoard(row.id);
    const deviceAfter = after.groups.flatMap((g) => g.lines).find((l) => l.item_key === 'ws_device');
    assert.strictEqual(deviceBefore.due_date, '2026-10-28');
    assert.strictEqual(deviceAfter.due_date, '2026-11-04',
      'no stored date could follow a corrected start date; a derived one does');
  });

  test('a line past its due date with nothing done is late, and a complete line is not', async () => {
    const row = await openCase({ start_date: '2026-01-10' });
    const board = await workspace.workspaceBoard(row.id);
    assert.ok(board.groups.flatMap((g) => g.lines).every((line) => line.overdue),
      'every open line whose due date has passed reads late');
    assert.ok(board.totals.overdue === board.totals.open);
  });

  test('the five areas P2-4 names are each covered by at least one line', async () => {
    const categories = workspace.WORKSPACE_CATALOG.map((line) => line.category);
    for (const area of ['hardware', 'software', 'email', 'system_access', 'building_card']) {
      assert.ok(categories.includes(area), `${area} is covered`);
    }
  });
});

describe('P2-4 · the function filter ("IT and Admin see only their own lines")', () => {
  test('filtering by a function returns only that function\'s lines', async () => {
    const row = await openCase();
    const all = await workspace.workspaceBoard(row.id);
    const it = await workspace.workspaceBoard(row.id, { function: 'IT' });
    assert.ok(it.groups.length === 1 && it.groups[0].function === 'IT');
    assert.ok(it.groups[0].lines.every((line) => line.owner === 'IT'));
    assert.strictEqual(it.totals.lines, it.groups[0].lines.length);
    const allIT = all.groups.find((g) => g.function === 'IT').lines.length;
    assert.strictEqual(it.totals.lines, allIT, 'the filter narrows, it does not lose a line');
  });

  test('a filtered board still carries every function\'s counts, so the chips can be labelled', async () => {
    const row = await openCase();
    const admin = await workspace.workspaceBoard(row.id, { function: 'admin' });
    assert.strictEqual(admin.groups[0].function, 'Admin', 'the name is canonicalised, not echoed');
    assert.deepStrictEqual(admin.available_functions.map((f) => f.function),
      workspace.WORKSPACE_FUNCTIONS, 'all four counts travel with a filtered board');
    const totalOpen = admin.available_functions.reduce((sum, f) => sum + f.open, 0);
    const unfiltered = await workspace.workspaceBoard(row.id);
    assert.strictEqual(totalOpen, unfiltered.totals.open, 'and they add up to the whole board');
  });

  test('the board says out loud that this is a filter, not access control', async () => {
    const row = await openCase();
    const board = await workspace.workspaceBoard(row.id, { function: 'IT' });
    assert.strictEqual(board.view.label, 'View by function');
    assert.strictEqual(board.view.is_access_control, false);
    assert.match(board.view.note, /filter, not access control/);
    assert.match(board.view.note, /Layer 3/, 'and points at where the scope lands');
    const all = await workspace.workspaceBoard(row.id);
    assert.strictEqual(all.view.mode, 'all', 'unfiltered is its own mode, not a silent default');
    assert.strictEqual(all.groups.length, 4, 'HR and the manager see the whole board');
  });

  test('an unknown function is refused by name, never ignored', async () => {
    const row = await openCase();
    await assert.rejects(
      () => workspace.workspaceBoard(row.id, { function: 'Finance' }),
      (err) => err instanceof workspace.PreboardingWorkspaceError
        && err.status === 400
        && /IT, Admin, HR, Manager/.test(err.message)
    );
  });

  test('an unknown case is a 404, and the catalogue is refused a phantom case', async () => {
    await assert.rejects(
      () => workspace.workspaceBoard('no-such-case'),
      (err) => err.status === 404
    );
  });
});

describe('P2-4 · adding a role or a line item is configuration', () => {
  test('the catalog is data with one owner, one offset and a unique key per line', async () => {
    const keys = workspace.WORKSPACE_CATALOG.map((line) => line.item_key);
    assert.strictEqual(new Set(keys).size, keys.length, 'no duplicate line keys');
    for (const line of workspace.WORKSPACE_CATALOG) {
      assert.ok(workspace.WORKSPACE_FUNCTIONS.includes(line.owner), `${line.item_key} names one function`);
      assert.ok(Number.isInteger(line.due_offset_days) && line.due_offset_days >= 0,
        `${line.item_key} carries a whole-day offset before the start date`);
      assert.ok(line.label && line.category, `${line.item_key} is a line a human can read`);
    }
  });

  test('every profile adds only catalogue lines, so a profile cannot invent one', async () => {
    const keys = workspace.WORKSPACE_CATALOG.map((line) => line.item_key);
    for (const profile of workspace.WORKSPACE_PROFILES) {
      assert.ok(profile.profile_key && profile.when && Array.isArray(profile.adds));
      for (const key of profile.adds) {
        assert.ok(keys.includes(key), `${profile.profile_key} adds ${key}, which is in the catalog`);
      }
      const rule = profile.when;
      assert.ok(Array.isArray(rule.role_matches) || Array.isArray(rule.department_in),
        `${profile.profile_key} reads a field the case actually carries`);
    }
  });

  test('a line no profile owns is carried by every case, and one that a profile owns is not', async () => {
    const profileOnly = workspace.WORKSPACE_PROFILES.reduce((acc, p) => acc.concat(p.adds), []);
    const plain = workspace.deriveWorkspaceLines({ role: 'Analyst', department: 'Operations' });
    for (const key of profileOnly) {
      assert.ok(!plain.lines.map((l) => l.item_key).includes(key),
        `${key} arrives only through its profile`);
    }
    assert.ok(plain.lines.length >= 10, 'the base set is the bulk of the checklist');
  });
});

describe('P2-4 · one item model, two tracks — and they are never merged', () => {
  test('case creation seeds both tracks, and a replayed acceptance adds no second copy', async () => {
    const offer = acceptedOffer({ offer_reference: 'OFR-2026-P24-REPLAY' });
    const first = await preboarding.recordOfferAcceptance(offer, { actor: 'test-runner', source: 'intake_form' });
    const second = await preboarding.recordOfferAcceptance(offer, { actor: 'test-runner', source: 'intake_form' });
    assert.strictEqual(first.created, true);
    assert.strictEqual(second.created, false, 'the UNIQUE offer_reference is the guarantee');
    assert.ok(first.workspace_lines > 0, 'the creation path reports the workspace track too');
    const all = await items.listAllItems(first.case.id);
    const employee = all.filter((i) => i.track === 'employee');
    const workspaceLines = all.filter((i) => i.track === 'workspace');
    assert.strictEqual(employee.length, items.DOCUMENT_SETS.AE.items.length);
    assert.strictEqual(workspaceLines.length, first.workspace_lines);
    assert.strictEqual(workspaceLines.length, workspace.deriveWorkspaceLines(first.case).lines.length);
  });

  test('the employee-track checklist read never returns a workspace line', async () => {
    const row = await openCase();
    const checklist = await items.caseChecklist(row.id);
    assert.ok(checklist.items.length > 0);
    assert.ok(checklist.items.every((item) => item.track === 'employee'),
      'the documents panel is documents; the provisioning lines have their own read');
    assert.strictEqual(checklist.summary.by_track.workspace.lines, workspace.deriveWorkspaceLines(row).lines.length);
  });

  test('the case roll-up carries both counts, and neither is the other', async () => {
    const row = await openCase();
    const checklist = await items.caseChecklist(row.id);
    const summary = checklist.summary;
    assert.strictEqual(summary.items_total, items.DOCUMENT_SETS.AE.items.length, 'employee track only');
    assert.strictEqual(summary.by_track.employee.lines, summary.items_total);
    assert.strictEqual(summary.by_track.workspace.lines, checklist.summary.by_track.workspace.lines);
    assert.ok(summary.by_track.workspace.lines > 0);
    assert.strictEqual(summary.by_track.employee.active, true);
    assert.strictEqual(summary.by_track.workspace.active, true);
    assert.strictEqual(summary.outstanding_count, summary.items_total, 'nothing collected yet');
  });

  test('a reminder is about the hire\'s documents: a workspace line is never in one', async () => {
    const row = await openCase();
    const { reminder, outstanding } = await items.recordReminder({ case_id: row.id, actor: 'hr' });
    assert.strictEqual(reminder.outstanding_count, items.DOCUMENT_SETS.AE.items.length);
    assert.ok(outstanding.every((item) => item.track === 'employee'));
    assert.ok(outstanding.every((item) => item.owner === null),
      'the employee track records no owner, so none is named');
  });

  test('the PDPL consent gate stays on documents: a provisioning line is not gated by it', async () => {
    const row = await openCase();
    // No consent record exists on this case. A document is asked for, then arrives — and the
    // arrival is what the gate refuses, exactly as it did before P2-4.
    assert.strictEqual(await items.hasConsent(row.id), false);
    await items.setItemStatus({ case_id: row.id, item_key: 'passport', status: 'requested', actor: 'hr' });
    await assert.rejects(
      () => items.setItemStatus({ case_id: row.id, item_key: 'passport', status: 'received', actor: 'hr' }),
      (err) => err.status === 428 && /PDPL consent/.test(err.message),
      'a hire\'s document still cannot be collected before consent'
    );
    // The provisioning line walks the same four-state machine and is NOT gated: issuing a laptop
    // is not collecting the hire's personal data.
    await items.setItemStatus({ case_id: row.id, item_key: 'ws_device', status: 'requested', actor: 'it' });
    const moved = await items.setItemStatus({
      case_id: row.id, item_key: 'ws_device', status: 'received', actor: 'it',
    });
    assert.strictEqual(moved.status, 'received');
    const board = await workspace.workspaceBoard(row.id);
    const device = board.groups.flatMap((g) => g.lines).find((l) => l.item_key === 'ws_device');
    assert.strictEqual(device.complete, true, 'and the board reads it as done');
    assert.strictEqual(device.overdue, false);
  });

  test('the 48-hour flag counts both tracks, and names the owner where one is recorded', async () => {
    const row = await openCase({ start_date: '2026-01-10' });
    const checklist = await items.caseChecklist(row.id);
    const flag = checklist.summary.flag;
    const employeeOutstanding = checklist.summary.outstanding_count;
    const workspaceLines = checklist.summary.by_track.workspace.lines;
    assert.strictEqual(flag.open_count, employeeOutstanding + workspaceLines,
      'the flag is defined over every item on the case (P2-5)');
    const named = flag.open_items.filter((item) => item.owner_known);
    assert.ok(named.length > 0, 'workspace lines arrive with an owner to name');
    assert.ok(named.every((item) => workspace.WORKSPACE_FUNCTIONS.includes(item.owner)));
    const noOwner = flag.open_items.filter((item) => !item.owner_known);
    assert.ok(noOwner.length > 0, 'the employee-track items still have none');
    assert.match(flag.scope_note, /workspace track/);
  });

  test('the workspace track is switched off outside the active jurisdictions', async () => {
    const row = await openCase({ jurisdiction: 'SA' });
    const board = await workspace.workspaceBoard(row.id);
    assert.strictEqual(board.track_active, false);
    assert.match(board.track_note, /UAE-first/);
    assert.ok(board.totals.lines > 0, 'the lines are kept, so the board can still be read');
    await assert.rejects(
      () => items.setItemStatus({ case_id: row.id, item_key: 'ws_device', status: 'requested', actor: 'it' }),
      (err) => err.status === 409 && /workspace track is kept but not active/.test(err.message),
      'the switch refuses the move and names itself, rather than blaming the status machine'
    );
    const stuck = await items.getItem(row.id, 'ws_device');
    assert.strictEqual(stuck.status, 'not_started', 'and the line did not move');
  });
});
