/**
 * Antum People — Layer 2 · Pre-boarding Intelligence
 * P2-5: the derived 48-hour flag and its three states.
 *
 * ---------------------------------------------------------------------------
 * DERIVED, NEVER STORED — the whole point of this file
 * ---------------------------------------------------------------------------
 * The flag is a pure function of two things: the case's start date and the case's items'
 * current statuses. It is computed on every read, so it cannot drift from the data and cannot
 * survive a restart as a stale value. There is deliberately:
 *   - no column for it, no cached field, no seeded state, and no write path;
 *   - no dismiss, no snooze, no "acknowledge" — a dismissible flag lies about the state of
 *     the work, and §5 of design-concepts/LAYER2-PREBOARDING-UI.md rules them out;
 *   - no record of a notification, because a derived flag has nothing to notify about and the
 *     product has no delivery channel (the in-process watcher in preboarding-flag-scheduler.js
 *     records what it saw; it never stores this flag and never sends anything).
 *
 * ---------------------------------------------------------------------------
 * EVERY ITEM ON THE CASE, WHATEVER TRACK CREATED IT
 * ---------------------------------------------------------------------------
 * The derivation reads `input.items` — the case's items, by one rule — and never a fixed item
 * list and never "the employee track" by name. Today the employee track (P2-2) is the only
 * track that exists, so today that is the set it sees; when P2-4's workspace items are written
 * into the same table they join this rule with no change here. The surface states that scope
 * rather than implying it (see `scope_note`).
 *
 * Which statuses count as "collected" is passed in by the caller (preboarding-items.js passes
 * its own COLLECTED_STATUSES) so the item model owns that list and this file cannot drift from
 * it. The default below is only for callers that have no item model to hand.
 */

/** §5: the flag fires at or inside 48 hours before 00:00 of the start date — inclusive. */
const BOUNDARY_HOURS = 48;

const HOUR_MS = 3600000;
const DAY_MS = 86400000;

const DEFAULT_COLLECTED_STATUSES = ['received', 'verified'];

/** Worst-first: how far an item still is from being in hand. Lower is worse. */
const STATUS_SEVERITY = { not_started: 0, requested: 1, received: 2, verified: 3 };

/**
 * The one thing every surface shows, so no surface may compute its own version (§5.3).
 * `tone` is the colour family; the client maps it to classes.
 */
const TONES = {
  clear: 'slate',
  inside_48_hours: 'amber',
  started: 'rose',
  no_start_date: 'rose',
};

function parseStartMidnight(startDate) {
  if (!startDate) return null;
  const iso = String(startDate).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const ms = Date.parse(`${iso}T00:00:00Z`);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Whole days from today's UTC midnight to the start midnight — the same measure the roll-up row
 * already prints next to the chip, so the chip and the row can never be counting differently.
 * (A negative number means the start date has passed.)
 */
function wholeDaysToStart(startMidnightMs, now) {
  if (startMidnightMs === null) return null;
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((startMidnightMs - startOfToday) / DAY_MS);
}

function hoursToStart(startMidnightMs, now) {
  if (startMidnightMs === null) return null;
  // Deliberately NOT rounded: the boundary is at exactly 48.0, and a value rounded to two decimals
  // would report 48 for an instant that is 48.0003 hours out — indistinguishable across the very
  // edge the flag is defined on. Formatting for display is the caller's business.
  return (startMidnightMs - now.getTime()) / HOUR_MS;
}

/** The open items, worst-first, each named with its status and — honestly — its owner. */
function nameOpenItems(items, collectedStatuses) {
  return items
    .filter((item) => collectedStatuses.indexOf(item.status) === -1)
    .map((item) => ({
      item_key: item.item_key,
      label: item.label,
      status: item.status,
      // The employee track has no owner field. Owners live on the workspace track (P2-4), which
      // does not exist yet, so there is nothing to name here and nothing is invented to fill the
      // gap: `owner: null` plus a line that says so on the surface.
      owner: item.owner === undefined || item.owner === null ? null : item.owner,
      owner_known: Boolean(item.owner),
    }))
    .sort((a, b) => {
      const sa = STATUS_SEVERITY[a.status] === undefined ? 99 : STATUS_SEVERITY[a.status];
      const sb = STATUS_SEVERITY[b.status] === undefined ? 99 : STATUS_SEVERITY[b.status];
      if (sa !== sb) return sa - sb;
      return String(a.item_key).localeCompare(String(b.item_key));
    });
}

/**
 * Derive the flag for one case.
 *
 * @param {{start_date?: string, items?: Array, collected_statuses?: string[]}} input
 * @param {Date} [now]  injectable clock — the boundary is a rule about time, so it must be testable
 */
function deriveFlag(input = {}, now = new Date()) {
  const items = Array.isArray(input.items) ? input.items : [];
  const collectedStatuses = Array.isArray(input.collected_statuses) && input.collected_statuses.length
    ? input.collected_statuses
    : DEFAULT_COLLECTED_STATUSES;

  const startMidnightMs = parseStartMidnight(input.start_date);
  const openItems = nameOpenItems(items, collectedStatuses);
  const openCount = openItems.length;

  // §5: a case with no start date cannot exist (P2-1 requires one). If one were ever read, the
  // surface shows the error state rather than a default date — and no flag is raised.
  if (startMidnightMs === null) {
    return {
      state: 'no_start_date',
      raised: false,
      tone: TONES.no_start_date,
      chip: null,
      headline: 'No start date on this case',
      body: [
        'This case has no start date, so no 48-hour boundary can be worked out. A pre-boarding '
          + 'case is not supposed to exist without one — P2-1 requires it at creation.',
      ],
      open_count: openCount,
      open_items: openItems,
      hours_to_start: null,
      days_to_start: null,
      boundary_hours: BOUNDARY_HOURS,
      boundary_inclusive: true,
      scope_note: 'Derived from every item on this case, whatever track created it. Today that is '
        + 'the employee track only, because it is the only track that exists.',
    };
  }

  const hours = hoursToStart(startMidnightMs, now);
  const days = wholeDaysToStart(startMidnightMs, now);

  const shared = {
    open_count: openCount,
    open_items: openItems,
    hours_to_start: hours,
    days_to_start: days,
    boundary_hours: BOUNDARY_HOURS,
    boundary_inclusive: true,
    scope_note: 'Derived from every item on this case, whatever track created it. Today that is '
      + 'the employee track only, because it is the only track that exists.',
  };

  // Nothing outstanding: the flag clears itself, on the next read, with nothing to dismiss.
  if (openCount === 0) {
    return Object.assign({}, shared, {
      state: 'clear',
      raised: false,
      tone: TONES.clear,
      chip: 'On track',
      headline: 'On track',
      body: [
        'Every item on this case is in hand, so there is nothing for the 48-hour boundary to '
          + 'raise.',
      ],
    });
  }

  // Start date has passed with items still open — the honest state, escalated in tone. It does
  // NOT become "overdue" forever: the moment the last item is collected this branch stops
  // applying on the read, which is what makes "complete" possible after day one.
  if (hours < 0) {
    const daysAgo = Math.abs(days || 0);
    return Object.assign({}, shared, {
      state: 'started',
      raised: true,
      tone: TONES.started,
      chip: `Started ${daysAgo} day${daysAgo === 1 ? '' : 's'} ago · ${openCount} item${openCount === 1 ? '' : 's'} open`,
      headline: `Started with ${openCount} item${openCount === 1 ? '' : 's'} still open`,
      body: ['These were due before day one.'],
    });
  }

  // At or inside 48 hours with items open — the flag the whole feature exists for.
  if (hours <= BOUNDARY_HOURS) {
    return Object.assign({}, shared, {
      state: 'inside_48_hours',
      raised: true,
      tone: TONES.inside_48_hours,
      chip: `Inside 48 hours · ${openCount} item${openCount === 1 ? '' : 's'} open`,
      // The spec's headline reads "start in under 48 hours"; at exactly 48.0 hours that is false,
      // and the boundary is inclusive by the same spec. "or less" is true on both sides of it.
      headline: `${openCount} item${openCount === 1 ? '' : 's'} open · start in 48 hours or less`,
      body: [],
    });
  }

  // More than 48 hours out with items still open: nothing is late yet.
  return Object.assign({}, shared, {
    state: 'clear',
    raised: false,
    tone: TONES.clear,
    chip: 'On track',
    headline: 'On track',
    body: [
      `${openCount} item${openCount === 1 ? '' : 's'} still open, with ${days} day${days === 1 ? '' : 's'} to go `
        + `— the flag starts ${BOUNDARY_HOURS} hours before the start date.`,
    ],
  });
}

module.exports = {
  BOUNDARY_HOURS,
  TONES,
  STATUS_SEVERITY,
  DEFAULT_COLLECTED_STATUSES,
  deriveFlag,
  parseStartMidnight,
  wholeDaysToStart,
  hoursToStart,
  nameOpenItems,
};
