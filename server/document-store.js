/**
 * Antum People — Layer 2 · the document byte boundary.
 *
 * ---------------------------------------------------------------------------
 * NO STORE HAS BEEN CHOSEN, AND CHOOSING ONE IS NOT A BUILDER'S CALL
 * ---------------------------------------------------------------------------
 * P2-2 collects documents and tracks what is collected and what is missing. It does **not**
 * store their contents, and this module is the one place where the contents will live once the
 * decision is made. The design spec reaches the same conclusion from the other side: its
 * §9 lists "a document store" as D5, and §11 records that P2-2's "documents stored per
 * employee" is exactly what D5 blocks. §10 Q5 asks the owner where collected documents live and
 * whether the PDPL position needs the compliance expert first.
 *
 * So this module holds the interface and refuses, loudly, rather than a store being picked in
 * passing. Two reasons that is the honest shape:
 *
 *  1. It is a PDPL decision, not plumbing. A passport and an Emirates ID are personal data:
 *     where the bytes sit decides who is a processor, what the retention and deletion story is,
 *     and whether anything crosses a border. That is the owner's call with counsel, not the
 *     convenience of a route handler.
 *  2. A silent default is the worst option. If a store were chosen by accident, the product
 *     would be collecting passports into a place nobody had assessed — the failure would be
 *     invisible until an audit.
 *
 * The candidate stores, for the owner's decision (cost, operations and PDPL notes are for the
 * compliance expert to review, not for this file to assert):
 *
 *   a. Local disk on the deployment host, one directory outside the repository, with the path
 *      in an environment variable. Cheapest and keeps the bytes on a host we control; needs the
 *      retention/backup story thought through and does not survive the host being replaced.
 *   b. The product SQLite database, as BLOBs. Nothing new to run and it travels with the
 *      database backups; makes the product database hold personal documents, so its own
 *      handling and access rules widen.
 *   c. An external object store (S3-compatible), addressed by reference. Scales and takes backups
 *      out of our hands; adds a processor to contract with and a credentials management job.
 *   d. No store in this release: the item records that a document was collected and where it was
 *      received, and the bytes stay wherever HR already keeps them. Nothing is claimed to be
 *      stored by the product.
 *
 * Today an item carries a short `document_reference` (a file name, or the reference HR quoted)
 * and never a document's contents — see `preboarding_items` in schema.sql. When a store is
 * chosen, it is implemented behind `saveDocument`/`readDocument` below and called from
 * `server/preboarding-items.js`; no other file needs to know where the bytes went.
 */

/** The configuration a real store will need. Named here so the decision has one obvious door. */
const STORE_CONFIG_VAR = 'ANTUM_DOCUMENT_STORE';

class DocumentStoreNotConfiguredError extends Error {
  constructor(message) {
    super(message || 'No document store is configured, so no document content can be stored.');
    this.name = 'DocumentStoreNotConfiguredError';
    this.status = 501; // Not Implemented: the capability is deliberately absent, not broken
  }
}

/**
 * Whether document content storage exists in this build. False, and it stays false until the
 * owner chooses a store — the tests assert this rather than leaving it to a comment.
 */
function isConfigured() {
  return false;
}

/**
 * Store a document's bytes against a case item. Unimplemented on purpose: see the header.
 *
 * @param {object} input { case_id, item_key, filename, contentType, bytes, actor }
 */
async function saveDocument() {
  throw new DocumentStoreNotConfiguredError(
    'No document store is configured: where collected documents live is undecided, so the '
    + 'product refuses to store document content rather than choose a place for it. '
    + `A chosen store is configured through ${STORE_CONFIG_VAR}.`
  );
}

/** Read a stored document back. Unimplemented on purpose: nothing has been stored. */
async function readDocument() {
  throw new DocumentStoreNotConfiguredError(
    'No document store is configured: nothing has been stored, so there is nothing to read.'
  );
}

module.exports = {
  STORE_CONFIG_VAR,
  DocumentStoreNotConfiguredError,
  isConfigured,
  saveDocument,
  readDocument,
};
