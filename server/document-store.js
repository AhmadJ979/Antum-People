/**
 * Antum People — Layer 2 · the document byte boundary.
 *
 * ---------------------------------------------------------------------------
 * THE DECISION IS MADE: A REFERENCE STRING ONLY, NO BYTES — UNTIL IFZA
 * REGISTRATION
 * ---------------------------------------------------------------------------
 * Owner decision, 2026-10-07: P2-2 — and everything built on it — records a short
 * `document_reference` (a file name, or the reference HR quoted) and never a document's
 * contents. The S3-compatible object store is **deliberately not built**: IFZA registration is
 * a hard gate on building it (owner decision 10 — an event, not a date), and no real document
 * bytes are stored before that.
 *
 * So this module is **not** a store waiting for a choice to be made. It is the boundary that
 * holds a decision already taken, and it refuses on every path that would write bytes —
 * because refusing is what keeps the code honest while the store does not exist. A reader who
 * finds this file should come away knowing **what was decided and why**, not that something is
 * still open.
 *
 * Why the decision is deliberately conservative:
 *
 *  1. It is a PDPL decision, not plumbing. A passport and an Emirates ID are personal data:
 *     where the bytes sit decides who is a processor, what the retention and deletion story
 *     is, and whether anything crosses a border. That is the owner's call with counsel —
 *     made, as option d below — not the convenience of a route handler.
 *  2. A silent default is the worst option. If bytes were stored by accident, the product
 *     would be collecting passports into a place nobody had assessed — the failure would be
 *     invisible until an audit.
 *
 * The options as the owner weighed them, kept for the record (their cost, operations and
 * PDPL notes are the compliance expert's to review; this file asserts none of them):
 *
 *   a. Local disk on the deployment host, one directory outside the repository, with the path
 *      in an environment variable. Cheapest and keeps the bytes on a host we control; needs
 *      the retention/backup story thought through and does not survive the host being
 *      replaced. **Not chosen.**
 *   b. The product SQLite database, as BLOBs. Nothing new to run and it travels with the
 *      database backups; makes the product database hold personal documents, so its own
 *      handling and access rules widen. **Not chosen.**
 *   c. An external object store (S3-compatible), addressed by reference. Scales and takes
 *      backups out of our hands; adds a processor to contract with and a credentials
 *      management job. **This is the store the decision names for after IFZA registration —
 *      and it is not built.**
 *   d. No store in this release: the item records that a document was collected and where it
 *      was received, and the bytes stay wherever HR already keeps them. Nothing is claimed to
 *      be stored by the product. **This is the decision in force (owner, 2026-10-07).**
 *
 * Today an item carries a short `document_reference` (a file name, or the reference HR
 * quoted) and never a document's contents — see `preboarding_items` in schema.sql. When IFZA
 * registration completes and option c is built, it goes behind `saveDocument`/`readDocument`
 * below and is called from `server/preboarding-items.js`; no other file needs to know where
 * the bytes went. Until then `isConfigured()` is false **by decision**, and both functions
 * refuse with that reason (501).
 */

/**
 * The variable the future store (option c, after IFZA registration) will take its destination
 * from. Naming it gives that build one obvious door — it is **not** configuration, nothing
 * reads it today, and naming it does not create a store: `isConfigured()` is a constant false
 * until the real thing is written.
 */
const STORE_CONFIG_VAR = 'ANTUM_DOCUMENT_STORE';

class DocumentStoreNotConfiguredError extends Error {
  constructor(message) {
    super(message || 'Document bytes are not stored: by decision (owner, 2026-10-07) this '
      + 'release records a reference string only, and the store is built after IFZA '
      + 'registration.');
    this.name = 'DocumentStoreNotConfiguredError';
    this.status = 501; // Not Implemented: the capability is deliberately absent, not broken
  }
}

/**
 * Whether document content storage exists in this build. **False by decision, not by
 * omission:** the owner's 2026-10-07 ruling ships a reference string and no bytes, and the
 * S3-compatible store is built only once IFZA registration completes. The tests assert this
 * rather than leaving it to a comment.
 */
function isConfigured() {
  return false;
}

/**
 * Store a document's bytes against a case item. Unimplemented by decision — see the header.
 *
 * @param {object} input { case_id, item_key, filename, contentType, bytes, actor }
 */
async function saveDocument() {
  throw new DocumentStoreNotConfiguredError(
    'Document bytes are not stored: the owner\'s decision (2026-10-07) is a reference string '
    + 'only — a file name, or the reference HR quoted — with no bytes, and the S3-compatible '
    + 'store is deliberately not built until IFZA registration completes. So the product '
    + 'refuses to store document content rather than choose a place for it. '
    + `The future store takes its destination from ${STORE_CONFIG_VAR}.`
  );
}

/**
 * Read a stored document back. Unimplemented by decision: this release records a reference
 * string and holds no bytes, so there is nothing to read back.
 */
async function readDocument() {
  throw new DocumentStoreNotConfiguredError(
    'No document content is stored: by decision (owner, 2026-10-07) this release records a '
    + 'reference string only and holds no bytes, so there is nothing to read back. Bytes are '
    + 'stored only after IFZA registration, when the store is built.'
  );
}

module.exports = {
  STORE_CONFIG_VAR,
  DocumentStoreNotConfiguredError,
  isConfigured,
  saveDocument,
  readDocument,
};
