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
 * WHERE THE LOOP LIVES NOW (P3-3, 2026-10-26)
 * ---------------------------------------------------------------------------
 * The timer, the tick, the idempotence set and the catch-up accounting are in
 * `server/interval-watcher.js` — ONE clock for this product, extracted when P3-3 needed the same
 * shape rather than a second `setInterval`. This file is now only what is P2-5's own: what counts
 * as a boundary, how the flag is derived, and the words of the record. Its behavior did not change
 * in that extraction, and its own suite is the control that says so.
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
 *     which is the honest statement of what this is. This is the difference between this watcher
 *     and P3-3's, and it is deliberate: P3-3's escalation is an ACT of the system that HR must be
 *     able to look up later, so it is written to a table; the flag is re-derivable on every read,
 *     so storing it would only create a second thing that can disagree with the first.
 *
 * CATCH-UP RULE (the restart-safe part, stated so it can be checked):
 *   - a boundary that falls after this watcher started is recorded on the next tick;
 *   - a boundary that fell BEFORE this watcher started is recorded on the first tick, flagged
 *     `late: true`, with when it was first seen and how long after the boundary that was;
 *   - the note states that relation and the first-seen time, and nothing else: this clock comparison
 *     can see only its own start, so it makes no claim about whether the app was up. It said "while
 *     the app was not running" until 2026-10-26 — the same invented cause fixed in
 *     server/probation-escalation.js, in the other served string an HR reader sees;
 *   - a boundary is never silently skipped: it is either met on a tick or caught up late and says
 *     so. Nothing is marked as missed, because a derived flag has nothing to miss — the chip reads
 *     correctly on the next read either way.
 */

const { deriveFlag, BOUNDARY_HOURS } = require('./preboarding-flag');
const { createIntervalWatcher, DEFAULT_INTERVAL_MS, MAX_RECORDS, isoOf } = require('./interval-watcher');

const CATCH_UP_RULE = [
  `A case enters the flag at ${BOUNDARY_HOURS} hours before 00:00 of its start date.`,
  'A boundary that falls after this watcher started is recorded on the next tick.',
  'A boundary that fell before this watcher started is recorded on the first tick, marked late, with when it was first seen and how long after the boundary that was.',
  'The note states when the boundary fell relative to THIS process and when it was first seen. It makes no claim about whether the app was up: the only thing this clock comparison can see is its own start.',
  'A boundary is never silently skipped. A derived flag has nothing to miss, so no "missed notification" state exists.',
  'Nothing here is delivered anywhere, and nothing here is read to render the flag.',
].join(' ');

/**
 * @param {object} options
 * @param {() => Promise<Array<{case_id: string, offer_reference?: string, start_date: string, items: Array}>>} options.snapshot
 *        Reads the cases and their items. Injected so this file holds no DB rule of its own (and
 *        so it can be driven by a stub clock in tests).
 */
function createFlagWatcher(options = {}) {
  const snapshot = options.snapshot;

  if (typeof snapshot !== 'function') {
    throw new Error('createFlagWatcher needs a snapshot() function');
  }

  const boundaryOf = (caseRow) => {
    if (!caseRow || !caseRow.start_date) return null;
    const ms = Date.parse(`${String(caseRow.start_date).slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(ms)) return null;
    return ms - BOUNDARY_HOURS * 3600000;
  };

  const watcher = createIntervalWatcher({
    name: 'preboarding-flag',
    intervalMs: options.intervalMs,
    clock: options.clock,
    log: options.log,
    catchUpRule: CATCH_UP_RULE,
    due: async (at) => {
      const cases = await snapshot();
      const items = [];
      for (const caseRow of cases || []) {
        const boundaryMs = boundaryOf(caseRow);
        if (boundaryMs === null) continue;
        if (boundaryMs > at.getTime()) continue; // the boundary has not arrived yet
        items.push({ key: `${caseRow.case_id}@${isoOf(boundaryMs)}`, due_at: boundaryMs, caseRow });
      }
      return items;
    },
    onDue: async (item, ctx) => {
      const caseRow = item.caseRow;
      const flag = deriveFlag(
        {
          start_date: caseRow.start_date,
          items: caseRow.items || [],
          collected_statuses: caseRow.collected_statuses,
        },
        ctx.at
      );
      // Nothing outstanding: the case never raises, so there is nothing to record. Returning null
      // leaves the key unmarked, exactly as this watcher behaved before the loop was extracted.
      if (flag.open_count === 0) return null;

      // OBSERVABLE ONLY, the same rule as server/probation-escalation.js: `late` compares the boundary
      // instant against THIS process's start (server/interval-watcher.js) and can see nothing else. A
      // restart, a redeploy or a first-ever start are indistinguishable from here, and this string is
      // read by HR as a statement about the product. It said "while the app was not running" until
      // 2026-10-26, when the two log lines recorded on this host crossed that mark while the app had in
      // fact been serving.
      const note = ctx.late
        ? `This case reached the ${BOUNDARY_HOURS}-hour mark before this watcher started`
          + ` (first seen ${isoOf(ctx.at)}, ${ctx.lateByHours}h after the mark). The flag itself is`
          + ' derived and read correctly on the first read after restart; nothing is marked missed.'
        : `This case reached the ${BOUNDARY_HOURS}-hour mark after this watcher started, so it was seen`
          + ` within ${Math.round(ctx.intervalMs / 60000)} minute(s) of the next tick.`;

      return {
        record: {
          case_id: caseRow.case_id,
          offer_reference: caseRow.offer_reference || null,
          boundary_at: isoOf(item.due_at),
          detected_at: ctx.at.toISOString(),
          late: ctx.late,
          late_by_hours: ctx.lateByHours,
          state_at_detection: flag.state,
          open_count_at_detection: flag.open_count,
          channel: 'none',
          note,
        },
        log: `${caseRow.case_id} — ${note}`,
      };
    },
  });

  return {
    start: watcher.start,
    stop: watcher.stop,
    tick: watcher.tick,
    records: watcher.records,
    catchUpRule: CATCH_UP_RULE,
    // The served payload of `GET /api/preboarding/flag-watch` keeps the key names it has served, so
    // the extraction is invisible to a reader of the route: `boundaries_*` is P2-5's vocabulary for
    // the loop's generic counters, and renaming them is not this row's change to make. Read PER
    // CALL, not once at construction — a status snapshot taken at construction would freeze at zero.
    status: () => {
      const { records_recorded, keys_seen, ...rest } = watcher.status();
      return { ...rest, boundaries_recorded: records_recorded, boundaries_seen: keys_seen };
    },
  };
}

module.exports = { createFlagWatcher, CATCH_UP_RULE, DEFAULT_INTERVAL_MS, MAX_RECORDS };
