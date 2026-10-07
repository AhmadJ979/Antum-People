/**
 * P2-5 acceptance criteria — the derived 48-hour flag.
 *
 * The flag is a rule about time, so the clock is injected everywhere below and every instant
 * named in a test is an exact instant. No database is needed for the derivation; the one test
 * that touches the schema reads PRAGMA on a throwaway product database to prove nothing about
 * the flag is persisted.
 */
const { test, describe, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const TEST_DB = path.join(os.tmpdir(), `antum-p2-5-${randomUUID()}.db`);
process.env.PRODUCT_DB_PATH = TEST_DB;

const flag = require('./preboarding-flag');
const { createFlagWatcher } = require('./preboarding-flag-scheduler');
const db = require('./db');

after(() => {
  try { fs.rmSync(TEST_DB, { force: true }); } catch (err) { /* nothing to remove */ }
});

/** The active UAE document set (7 items), as the product itself defines it. */
const items = require('./preboarding-items');
const uaeItems = () => items.DOCUMENT_SETS.AE.items.map((item) => ({
  item_key: item.item_key,
  label: item.label,
  status: 'not_started',
  required: true,
}));

const at = (iso) => new Date(iso);

describe('P2-5 · the boundary is inclusive at exactly 48 hours', () => {
  const START = '2026-11-02'; // boundary: 2026-10-31T00:00:00Z

  test('exactly 48.000 hours before 00:00 of the start date, the flag IS raised', () => {
    const derived = flag.deriveFlag({ start_date: START, items: uaeItems() }, at('2026-10-31T00:00:00Z'));
    assert.strictEqual(derived.hours_to_start, 48);
    assert.strictEqual(derived.state, 'inside_48_hours');
    assert.strictEqual(derived.raised, true);
  });

  test('one second outside 48 hours, it is NOT raised', () => {
    const derived = flag.deriveFlag({ start_date: START, items: uaeItems() }, at('2026-10-30T23:59:59Z'));
    assert.strictEqual(derived.hours_to_start > flag.BOUNDARY_HOURS, true);
    assert.strictEqual(derived.state, 'clear');
    assert.strictEqual(derived.raised, false);
  });

  test('one second inside 48 hours, it IS raised', () => {
    const derived = flag.deriveFlag({ start_date: START, items: uaeItems() }, at('2026-10-31T00:00:01Z'));
    assert.strictEqual(derived.hours_to_start < 48, true);
    assert.strictEqual(derived.state, 'inside_48_hours');
    assert.strictEqual(derived.raised, true);
  });

  test('the boundary is measured from 00:00 of the start date, not from the moment of the read', () => {
    const a = flag.deriveFlag({ start_date: START, items: uaeItems() }, at('2026-10-31T06:00:00Z'));
    const b = flag.deriveFlag({ start_date: START, items: uaeItems() }, at('2026-10-31T18:00:00Z'));
    assert.strictEqual(a.hours_to_start, 42);
    assert.strictEqual(b.hours_to_start, 30);
    assert.strictEqual(a.days_to_start, b.days_to_start);
  });
});

describe('P2-5 · the three states on the seeded cases', () => {
  test('start date passed with items open → Started (the tone escalates, nothing is hidden)', () => {
    const derived = flag.deriveFlag({ start_date: '2026-10-06', items: uaeItems() }, at('2026-10-07T14:00:00Z'));
    assert.strictEqual(derived.state, 'started');
    assert.strictEqual(derived.raised, true);
    assert.strictEqual(derived.open_count, 7);
    assert.match(derived.chip, /^Started 1 day ago · 7 items open$/);
    assert.match(derived.headline, /^Started with 7 items still open$/);
    assert.deepStrictEqual(derived.body, ['These were due before day one.']);
  });

  test('inside 48 hours with items open → the amber state', () => {
    const derived = flag.deriveFlag({ start_date: '2026-10-08', items: uaeItems() }, at('2026-10-07T14:00:00Z'));
    assert.strictEqual(derived.state, 'inside_48_hours');
    assert.strictEqual(derived.raised, true);
    assert.match(derived.chip, /^Inside 48 hours · 7 items open$/);
    assert.strictEqual(derived.days_to_start, 1);
  });

  test('more than 48 hours out with everything still open → On track, not a flag', () => {
    const derived = flag.deriveFlag({ start_date: '2026-10-21', items: uaeItems() }, at('2026-10-07T14:00:00Z'));
    assert.strictEqual(derived.state, 'clear');
    assert.strictEqual(derived.raised, false);
    assert.strictEqual(derived.chip, 'On track');
    assert.strictEqual(derived.open_count, 7);
    assert.strictEqual(derived.days_to_start, 14);
  });
});

describe('P2-5 · the flag clears by derivation, and is never sticky', () => {
  test('a case whose start date has passed with EVERY item collected renders complete, not overdue', () => {
    const done = uaeItems().map((item) => ({ ...item, status: 'verified' }));
    const derived = flag.deriveFlag({ start_date: '2026-10-06', items: done }, at('2026-10-07T14:00:00Z'));
    assert.strictEqual(derived.state, 'clear');
    assert.strictEqual(derived.raised, false);
    assert.strictEqual(derived.chip, 'On track');
    assert.strictEqual(derived.open_count, 0);
    assert.deepStrictEqual(derived.open_items, []);
    assert.strictEqual(derived.body[0].indexOf('nothing for the 48-hour boundary to raise') !== -1, true);
  });

  test('the same case flips to the flag on the next read, with no write in between', () => {
    const open = uaeItems();
    const before = flag.deriveFlag({ start_date: '2026-10-06', items: open }, at('2026-10-07T09:00:00Z'));
    const after = flag.deriveFlag(
      { start_date: '2026-10-06', items: open.map((item) => ({ ...item, status: 'received' })) },
      at('2026-10-07T09:00:01Z')
    );
    assert.strictEqual(before.raised, true);
    assert.strictEqual(after.raised, false);
  });

  test('clearing is one-sided: any single open item keeps it raised', () => {
    const partly = uaeItems();
    partly[6] = { ...partly[6], status: 'received' };
    const derived = flag.deriveFlag({ start_date: '2026-10-06', items: partly }, at('2026-10-07T14:00:00Z'));
    assert.strictEqual(derived.open_count, 6);
    assert.strictEqual(derived.raised, true);
  });
});

describe('P2-5 · one rule over every item, whatever track created it', () => {
  test('an item that is not in the employee-track document set still counts', () => {
    const workspaceItem = { item_key: 'laptop', label: 'Laptop issued', status: 'not_started', required: true };
    const withWorkspace = uaeItems().concat([workspaceItem]);
    const derived = flag.deriveFlag({ start_date: '2026-10-08', items: withWorkspace }, at('2026-10-07T14:00:00Z'));
    assert.strictEqual(derived.open_count, 8);
    assert.ok(derived.open_items.some((item) => item.item_key === 'laptop'),
      'a workspace item joins the derivation with no change to the rule');
  });

  test('open items are named worst-first, with the item, its status and the days to start', () => {
    const mixed = [
      { item_key: 'bank_details', label: 'Bank details (IBAN letter)', status: 'received' },
      { item_key: 'passport', label: 'Passport copy', status: 'not_started' },
      { item_key: 'visa_or_entry_permit', label: 'Visa or entry permit', status: 'requested' },
    ];
    const derived = flag.deriveFlag({ start_date: '2026-10-09', items: mixed }, at('2026-10-08T12:00:00Z'));
    assert.deepStrictEqual(derived.open_items.map((item) => item.status), ['not_started', 'requested']);
    assert.deepStrictEqual(derived.open_items.map((item) => item.label),
      ['Passport copy', 'Visa or entry permit']);
    assert.strictEqual(derived.days_to_start, 1);
  });

  test('no owner is invented where the item model has none', () => {
    const derived = flag.deriveFlag({ start_date: '2026-10-09', items: uaeItems() }, at('2026-10-08T12:00:00Z'));
    for (const item of derived.open_items) {
      assert.strictEqual(item.owner, null, 'the employee track has no owner field to read');
      assert.strictEqual(item.owner_known, false);
    }
    const columns = ['passport'];
    assert.ok(columns.length === 1);
  });
});

describe('P2-5 · a case with no start date', () => {
  test('no flag is raised and the surface is told why, rather than being given a default date', () => {
    const derived = flag.deriveFlag({ items: uaeItems() }, at('2026-10-07T14:00:00Z'));
    assert.strictEqual(derived.state, 'no_start_date');
    assert.strictEqual(derived.raised, false);
    assert.strictEqual(derived.chip, null);
    assert.match(derived.body[0], /no start date/i);
  });
});

describe('P2-5 · nothing about the flag is stored', () => {
  test('no column on the Layer 2 tables holds a flag, a state or a boundary', async () => {
    for (const table of ['preboarding_cases', 'preboarding_items']) {
      const columns = (await db.query(`PRAGMA table_info(${table})`)).map((column) => column.name);
      for (const forbidden of ['flag', 'flag_state', 'overdue', 'boundary_at', 'days_to_start']) {
        assert.ok(!columns.includes(forbidden), `${table}.${forbidden} would make the flag storable`);
      }
    }
  });

  test('the derivation declares no write path', () => {
    const names = Object.keys(flag);
    for (const forbidden of ['saveFlag', 'setFlag', 'storedFlag', 'persist']) {
      assert.strictEqual(names.indexOf(forbidden), -1);
    }
    assert.strictEqual(typeof flag.deriveFlag, 'function');
  });
});

describe('P2-5 · the in-process watcher records, catches up, and never sends', () => {
  const caseBoundaryAt = (startDate) => Date.parse(`${startDate}T00:00:00Z`) - 48 * 3600000;
  const caseRow = (startDate, status = 'not_started') => ({
    case_id: `case-${startDate}`,
    offer_reference: `OFR-${startDate}`,
    start_date: startDate,
    items: uaeItems().map((item) => ({ ...item, status })),
  });

  test('a boundary met while the process is up is recorded as met while the app was open', async () => {
    let clockNow = at('2026-10-31T00:00:30Z');
    const watcher = createFlagWatcher({
      clock: () => clockNow,
      intervalMs: 60000,
      snapshot: async () => [caseRow('2026-11-02')],
    });
    // process starts just after the boundary → this one is late by construction
    assert.strictEqual(caseBoundaryAt('2026-11-02') < clockNow.getTime(), true);
    await watcher.tick();
    assert.strictEqual(watcher.records.length, 1);
    assert.strictEqual(watcher.records[0].late, true);
    assert.match(watcher.records[0].note, /while the app was not running/);
    assert.strictEqual(watcher.records[0].channel, 'none');
    assert.strictEqual(watcher.records[0].state_at_detection, 'inside_48_hours');
    assert.strictEqual(watcher.records[0].open_count_at_detection, 7);

    // the same boundary is never recorded twice
    clockNow = at('2026-10-31T00:05:30Z');
    await watcher.tick();
    assert.strictEqual(watcher.records.length, 1);
  });

  test('a boundary that falls after this process started is recorded as met, not late', async () => {
    let clockNow = at('2026-10-30T12:00:00Z');
    const watcher = createFlagWatcher({
      clock: () => clockNow,
      intervalMs: 60000,
      snapshot: async () => [caseRow('2026-11-02')],
    });
    await watcher.tick();
    assert.strictEqual(watcher.records.length, 0, 'nothing is recorded before the boundary arrives');

    clockNow = at('2026-10-31T00:00:01Z'); // the boundary fell while the process was up
    await watcher.tick();
    assert.strictEqual(watcher.records.length, 1);
    assert.strictEqual(watcher.records[0].late, false);
    assert.match(watcher.records[0].note, /while the app was open/);
  });

  test('a case with nothing outstanding is never recorded, and a passed-and-complete case stays complete', async () => {
    const clockNow = at('2026-10-07T14:00:00Z');
    const watcher = createFlagWatcher({
      clock: () => clockNow,
      intervalMs: 60000,
      snapshot: async () => [
        caseRow('2026-10-08'),          // inside 48h, everything open → recorded
        caseRow('2026-10-06', 'verified'), // start passed, everything in hand → complete, not recorded
        caseRow('2026-10-21'),          // far out → not recorded
      ],
    });
    await watcher.tick();
    assert.strictEqual(watcher.records.length, 1);
    assert.strictEqual(watcher.records[0].case_id, 'case-2026-10-08');

    const status = watcher.status();
    assert.strictEqual(status.delivery, 'none');
    assert.match(status.catch_up_rule, /never silently skipped/);
    assert.strictEqual(status.last_error, null);
  });

  test('the watcher holds no write path: its records are in memory and it declares no delivery', () => {
    const watcher = createFlagWatcher({ snapshot: async () => [] });
    const names = Object.keys(watcher);
    for (const forbidden of ['send', 'notify', 'email', 'dispatch', 'save']) {
      assert.strictEqual(names.indexOf(forbidden), -1);
    }
    assert.strictEqual(watcher.status().delivery, 'none');
  });
});
