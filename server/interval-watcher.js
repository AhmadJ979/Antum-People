'use strict';
/**
 * server/interval-watcher.js — the ONE in-process clock this product has.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS (and why it is not a second scheduler)
 * ---------------------------------------------------------------------------
 * This host has no cron and no working systemd, so a time-based check cannot be delegated to the OS:
 * it has to run inside this process and survive a restart. P2-5 built that loop for the 48-hour
 * pre-boarding boundary and said so, in its own header, in these words: *"The same watcher is the
 * shape Layer 3's probation-milestone escalation (P3-3) needs — one clock, one record, no delivery
 * — but P3-3 is not built here and nothing in this file assumes it."*
 *
 * P3-3's row then made the constraint explicit: *"Uses the in-process, restart-safe scheduler built
 * for P2-5. If that scheduler is not merged yet, this task depends on it explicitly rather than
 * writing a second one."* A second `setInterval` next to the first would be exactly that second
 * scheduler, so the loop was EXTRACTED here instead — the timer, the tick, the idempotence set, the
 * catch-up accounting and the status are now written once — and both watchers are compositions of
 * it: `server/preboarding-flag-scheduler.js` (P2-5) and `server/probation-escalation.js` (P3-3).
 * That refactor's control is P2-5's own suite: it is unchanged and green on the extracted loop.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE LOOP GUARANTEES — the restart-safe part, stated so it can be checked
 * ---------------------------------------------------------------------------
 *   * `due(at)` is asked, once per tick, what has come due; each item carries a stable `key` (its
 *     idempotence key) and a `due_at` (when it fell due).
 *   * an item is handed to `onDue` AT MOST ONCE per process — a tick that sees the same key again
 *     does nothing. `onDue` returning `null` means "nothing to record", and then the key is NOT
 *     marked, so a case that is not yet recordable is re-considered on the next tick rather than
 *     being swallowed by the first look.
 *   * `late` is decided by the clock, not by the caller: an item whose `due_at` falls BEFORE this
 *     process started is recorded on the first tick and flagged late, with how many hours late it
 *     was noticed. An item that falls due while the process is up is `late: false`.
 *   * nothing is ever silently skipped: it is either met on a tick or caught up late and says so.
 *   * the loop DELIVERS NOTHING. `status().delivery` is `'none'` for every watcher, because the
 *     product has no mailer, no webhook and no SMS. A record written by a watcher is an in-product
 *     observation and never proof that a message reached a person.
 *   * a durable record is the CALLER's business, not the loop's: P2-5 keeps its records in memory
 *     (capped, gone on restart, and its header says so), while P3-3's escalation is written to a
 *     table with a UNIQUE key so one escalation per missed milestone survives a restart. The loop
 *     is the same loop either way; the durability difference is named where it is decided.
 *
 * No database, no domain term and no `require` of anything but the clock: this file is the loop.
 */

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
/** How many records a watcher keeps in memory. A cap, not a retention policy. */
const MAX_RECORDS = 200;

const isoOf = (ms) => (ms === null || ms === undefined ? null : new Date(ms).toISOString());

/**
 * The cadence clause — the ONE sentence either watcher's note may carry about its own ticking.
 *
 * Both watchers' notes are served to an HR reader as statements about the product, and until
 * 2026-10-28 each of them closed with a DETECTION LATENCY: *"…so it was seen within N minute(s) of
 * the next tick."* The process can see that its interval is N minutes. It CANNOT see whether its own
 * ticks ran on schedule — on this host a suspended guest, a stall or a lost span is exactly how a
 * tick goes missing, so an interval read as a promise of how fast a person would have been told is
 * a claim this mechanism cannot establish. The clause therefore states the cadence as DESIGN INTENT,
 * names that limit, and leaves the recorded instants to the note itself (the deadline/boundary and
 * the first-seen reading, both already on the record and in the payload). Same rule as the catch-up
 * clauses above it: state only what the clock comparison can see.
 *
 * Written once and imported by both watchers, so the sentence cannot drift apart in the two modules
 * that serve it, and so `server/watcher-note-detection-claim.test.js` can hold ONE string against
 * both notes instead of two copies of the same claim against each other.
 */
function cadenceClause(intervalMs) {
  const minutes = Math.round((intervalMs || DEFAULT_INTERVAL_MS) / 60000);
  return `The watcher reads for what has come due every ${minutes} minute(s) by design; it cannot `
    + 'see whether its own ticks ran on schedule, so that interval is the intended cadence, not a '
    + 'measured detection time.';
}

/**
 * @param {object} options
 * @param {string} options.name            how log lines are prefixed, e.g. `preboarding-flag`
 * @param {number} [options.intervalMs]    the tick period (default 5 minutes)
 * @param {() => Date} [options.clock]     injected so tests drive time instead of waiting
 * @param {(line: string) => void} [options.log]
 * @param {(at: Date) => Promise<Array<{key: string, due_at: number|string}>>} options.due
 *        What has come due as of `at`. Injected so this file holds no rule of its own.
 * @param {(item, ctx) => Promise<{record: object, log?: string}|null>} options.onDue
 *        Turns a due item into the record to append — or `null` for "not recordable yet".
 *        `ctx` is `{ at, late, lateByHours, intervalMs }`.
 * @param {string} [options.catchUpRule]   the human-readable rule, carried on every status read
 */
function createIntervalWatcher(options = {}) {
  const { name, due, onDue, catchUpRule } = options;
  const intervalMs = options.intervalMs || DEFAULT_INTERVAL_MS;
  const log = options.log || (() => {});
  const clock = options.clock || (() => new Date());

  if (typeof due !== 'function') throw new Error(`createIntervalWatcher(${name}) needs a due() function`);
  if (typeof onDue !== 'function') throw new Error(`createIntervalWatcher(${name}) needs an onDue() function`);

  const startedAt = clock();
  const seen = new Set();
  const records = [];
  let timer = null;
  let lastScanAt = null;
  let lastError = null;

  async function tick(at = clock()) {
    let items;
    try {
      items = await due(at);
    } catch (err) {
      lastError = err && err.message ? err.message : String(err);
      throw err;
    }
    lastScanAt = at.toISOString();
    const added = [];

    for (const item of items || []) {
      if (!item || !item.key) continue;
      if (seen.has(item.key)) continue;
      const dueAtMs = typeof item.due_at === 'string' ? Date.parse(item.due_at) : item.due_at;
      const late = Number.isFinite(dueAtMs) && dueAtMs < startedAt.getTime();
      const lateByHours = Number.isFinite(dueAtMs)
        ? Math.round(((at.getTime() - dueAtMs) / 3600000) * 100) / 100
        : null;
      const outcome = await onDue(item, { at, late, lateByHours, intervalMs });
      if (!outcome) continue; // not recordable yet: leave the key unmarked, look again next tick
      seen.add(item.key);
      records.push(outcome.record);
      if (records.length > MAX_RECORDS) records.shift();
      added.push(outcome.record);
      if (outcome.log) log(`[${name}] ${outcome.log}`);
    }

    return { at: lastScanAt, added, records: records.length };
  }

  function start() {
    if (timer) return;
    const poll = () => {
      // The FIRST tick IS the catch-up: a boundary that fell while the process was down is recorded
      // late on this tick, rather than waiting for the next interval to notice it.
      tick().catch((err) => {
        lastError = err && err.message ? err.message : String(err);
        log(`[${name}] scan failed: ${lastError}`);
      });
    };
    poll();
    timer = setInterval(poll, intervalMs);
    if (typeof timer.unref === 'function') timer.unref();
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  return {
    start,
    stop,
    tick,
    records,
    catchUpRule,
    status: () => ({
      process_started_at: startedAt.toISOString(),
      last_scan_at: lastScanAt,
      interval_ms: intervalMs,
      records_recorded: records.length,
      keys_seen: seen.size,
      last_error: lastError,
      delivery: 'none',
      catch_up_rule: catchUpRule || null,
      records: records.slice(),
    }),
  };
}

module.exports = { createIntervalWatcher, DEFAULT_INTERVAL_MS, MAX_RECORDS, isoOf, cadenceClause };
