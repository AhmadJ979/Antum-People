/**
 * Antum People — Layer 2 · Pre-boarding Intelligence
 * P2-5: the in-process watcher for the 48-hour boundary — a RECORD, not a notification.
 *
 * ---------------------------------------------------------------------------
 * WHY THERE IS A TIMER IN OUR OWN PROCESS
 * ---------------------------------------------------------------------------
 * This host has no cron and no working systemd, so a time-based check cannot be delegated to the
 * OS. The watch therefore runs inside the server process, and it has to survive a restart.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT DOES, EXACTLY — AND WHAT IT DOES NOT
 * ---------------------------------------------------------------------------
 * It reads each case on a tick, derives the flag with the one derivation in preboarding-flag.js,
 * and — when a case's boundary is at or behind us and the case still has open items — appends one
 * record saying when the boundary fell and when this process noticed. It:
 *   - does NOT store the flag (the flag is derived on every read; nothing here is a source of
 *     truth for it, and the surface never reads these records to render a chip);
 *   - does NOT send anything: the product has no mailer, no webhook and no SMS, so a record here
 *     is an in-product observation and never proof that a message reached a person;
 *   - does NOT need the DB to hold a row: records are in memory, capped, and gone on restart —
 *     which is the honest statement of what this is. If a durable record is wanted later, that is
 *     a schema decision and its own row.
 *
 * CATCH-UP RULE (the restart-safe part, stated so it can be checked):
 *   - a boundary that falls while the process is up is recorded on the next tick, as met while the
 *     app was open;
 *   - a boundary that fell BEFORE this process started is recorded on the first tick, flagged
 *     `late: true`, with how late it was noticed and the words "while the app was not running";
 *   - a boundary is never silently skipped: it is either met on a tick or caught up late and says
 *     so. Nothing is marked as missed, because a derived flag has nothing to miss — the chip reads
 *     correctly on the next read either way.
 *
 * The same watcher is the shape Layer 3's probation-milestone escalation (P3-3) needs — one
 * clock, one record, no delivery — but P3-3 is not built here and nothing in this file assumes it.
 */

const { deriveFlag, BOUNDARY_HOURS } = require('./preboarding-flag');

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const MAX_RECORDS = 200;

const CATCH_UP_RULE = [
  `A case enters the flag at ${BOUNDARY_HOURS} hours before 00:00 of its start date.`,
  'A boundary that falls while the process is up is recorded on the next tick ("while the app was open").',
  'A boundary that fell before this process started is recorded on the first tick, marked late, with how late it was noticed ("while the app was not running").',
  'A boundary is never silently skipped. A derived flag has nothing to miss, so no "missed notification" state exists.',
  'Nothing here is delivered anywhere, and nothing here is read to render the flag.',
].join(' ');

function isoOf(ms) {
  return ms === null || ms === undefined ? null : new Date(ms).toISOString();
}

/**
 * @param {object} options
 * @param {() => Promise<Array<{case_id: string, offer_reference?: string, start_date: string, items: Array}>>} options.snapshot
 *        Reads the cases and their items. Injected so this file holds no DB rule of its own (and
 *        so it can be driven by a stub clock in tests).
 */
function createFlagWatcher(options = {}) {
  const snapshot = options.snapshot;
  const intervalMs = options.intervalMs || DEFAULT_INTERVAL_MS;
  const log = options.log || (() => {});
  const clock = options.clock || (() => new Date());

  if (typeof snapshot !== 'function') {
    throw new Error('createFlagWatcher needs a snapshot() function');
  }

  const startedAt = clock();
  const seen = new Set();
  const records = [];
  let timer = null;
  let lastScanAt = null;
  let lastError = null;

  function boundaryOf(caseRow) {
    if (!caseRow || !caseRow.start_date) return null;
    const ms = Date.parse(`${String(caseRow.start_date).slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(ms)) return null;
    return ms - BOUNDARY_HOURS * 3600000;
  }

  async function tick(at = clock()) {
    let cases;
    try {
      cases = await snapshot();
    } catch (err) {
      lastError = err && err.message ? err.message : String(err);
      throw err;
    }
    lastScanAt = at.toISOString();
    const added = [];

    for (const caseRow of cases || []) {
      const boundaryMs = boundaryOf(caseRow);
      if (boundaryMs === null) continue;
      if (boundaryMs > at.getTime()) continue; // the boundary has not arrived yet

      const flag = deriveFlag(
        {
          start_date: caseRow.start_date,
          items: caseRow.items || [],
          collected_statuses: caseRow.collected_statuses,
        },
        at
      );
      // Nothing outstanding: the case never raises, so there is nothing to record.
      if (flag.open_count === 0) continue;

      const key = `${caseRow.case_id}@${isoOf(boundaryMs)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const late = boundaryMs < startedAt.getTime();
      const lateByHours = Math.round(((at.getTime() - boundaryMs) / 3600000) * 100) / 100;
      const note = late
        ? `This case reached the ${BOUNDARY_HOURS}-hour mark while the app was not running`
          + ` (noticed ${lateByHours}h late). The flag itself is derived and read correctly on the`
          + ' first read after restart; nothing is marked missed.'
        : `This case reached the ${BOUNDARY_HOURS}-hour mark while the app was open`
          + ` (noticed within ${Math.round(intervalMs / 60000)} minute(s) of the boundary).`;

      const record = {
        case_id: caseRow.case_id,
        offer_reference: caseRow.offer_reference || null,
        boundary_at: isoOf(boundaryMs),
        detected_at: at.toISOString(),
        late,
        late_by_hours: lateByHours,
        state_at_detection: flag.state,
        open_count_at_detection: flag.open_count,
        channel: 'none',
        note,
      };
      records.push(record);
      if (records.length > MAX_RECORDS) records.shift();
      added.push(record);
      log(`[preboarding-flag] ${caseRow.case_id} — ${note}`);
    }

    return { at: lastScanAt, added, records: records.length };
  }

  function start() {
    if (timer) return;
    const poll = () => {
      tick().catch((err) => {
        lastError = err && err.message ? err.message : String(err);
        log(`[preboarding-flag] scan failed: ${lastError}`);
      });
    };
    poll(); // the first tick IS the catch-up
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
    catchUpRule: CATCH_UP_RULE,
    status: () => ({
      process_started_at: startedAt.toISOString(),
      last_scan_at: lastScanAt,
      interval_ms: intervalMs,
      boundaries_recorded: records.length,
      boundaries_seen: seen.size,
      last_error: lastError,
      delivery: 'none',
      catch_up_rule: CATCH_UP_RULE,
      records: records.slice(),
    }),
  };
}

module.exports = { createFlagWatcher, CATCH_UP_RULE, DEFAULT_INTERVAL_MS, MAX_RECORDS };
