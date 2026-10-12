/**
 * Antum People — the legal templates the server serves, and the privacy notice among them.
 *
 * ---------------------------------------------------------------------------
 * ONE AUTHORITATIVE COPY, AND IT IS THIS REPOSITORY'S
 * ---------------------------------------------------------------------------
 * An acknowledgement record's evidential value rests on one thing: the version it names must be the
 * version of a text somebody can produce. So the route that serves the notice and the route that
 * writes a record read the SAME file through this module — and that file is
 * `templates/privacy-notice.md` in this repository, beside the code that serves it, reviewed in git
 * like every other document here.
 *
 * Until 2026-10-12 the resolution was the other way round: `/home/team/shared/templates` first, this
 * repository as a fallback. The host copy had drifted, and both copies read **v2.2** — one version
 * string describing two different texts:
 *
 *     host copy (served)     : "Duration of employment + statutory retention"
 *     repo copy (reviewed)   : "Duration of employment + retention period"
 *
 * The repository's copy is the reviewed one: `313a017` dropped that qualifier as unsourced. So the
 * product served the text we had reviewed *out*, and the `v2.2` on any record written against it
 * could not distinguish the two texts — the exact defect the acknowledgement work exists to remove.
 *
 * The resolution below therefore follows the code, not the host: this repository is authoritative and
 * the host-shared directory is not consulted at all. A host copy that still exists is a duplicate,
 * never a source.
 *
 * ---------------------------------------------------------------------------
 * WHY EVERY TEMPLATE RESOLVES HERE, NOT ONLY THE NOTICE
 * ---------------------------------------------------------------------------
 * The same drift was measured on 2026-10-12 for `templates/ksa-employment-contract.md` — a document
 * the product renders for a KSA employee's contract, whose EOSB bands and notice-penalty clause
 * `9f4426d` corrected in the repository only. Two copies of a served document is the defect; which
 * template it is does not change that. `templatePath()` is the single resolution for all of them, and
 * `server/privacy-notice.test.js` fails if any module under `server/` starts reading the host-shared
 * directory again.
 *
 * ---------------------------------------------------------------------------
 * THE VERSION LINE IS DOCUMENT CONTENT, NOT CODE
 * ---------------------------------------------------------------------------
 * `noticeVersion()` reads the version out of the file it serves, never a literal here, so the only
 * way a record can name an unknown text is a content change that forgot to bump the line. Writing or
 * bumping that line is the notice owner's act, not the engineer's: this module reports what the
 * served file says.
 *
 * ---------------------------------------------------------------------------
 * TWO NUMBERS FOR TWO TEXTS — AND THE OLD NUMBER IS NOT MEANINGLESS
 * ---------------------------------------------------------------------------
 * Moving which copy is served moves the *text* clients receive while the version line on it does not
 * move on its own. The ruling of 2026-10-12 splits the numbers, and both halves are recorded because a
 * record's version string has to name a text somebody can produce:
 *
 *     v2.2  the text served to date — the host copy, md5 `e011d3d6f18eb8175050917bb4fb08fe`, whose
 *           retention row reads "Duration of employment + statutory retention". Every acknowledgement
 *           and consent row written so far was written against this text: it is the text the route
 *           resolved when the row was written, so `v2.2` names a real, producible document.
 *     v2.3  the corrected text — `templates/privacy-notice.md` here, retention row "Duration of
 *           employment + retention period". It has been served to nobody yet, so no existing record
 *           can name it. Minted when it lands, on the notice owner's act, in the served file.
 *
 * The ambiguity was in the *file claim* only: one number described two byte-strings. Re-labelling the
 * served text `v2.3` retrospectively would misdescribe every record written against the text that was
 * actually served, so `v2.2` stays attached to the text it named and the next number moves forward.
 * `v2.4` is the qualifications purpose row, behind counsel.
 *
 * Numbering rule: **one number = one byte-string.** Minted when a text lands, as the next free
 * integer; never reserved for planned work, never reused for a different text.
 */

const fs = require('fs');
const path = require('path');

/** The template name the notice is served under (`GET /api/compliance/templates/:name/:employeeId`). */
const NOTICE_TEMPLATE = 'privacy-notice';

/** This repository's own template directory — the single authoritative copy of every template. */
const REPO_TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

/**
 * The absolute path of a template the server serves, resolved inside this repository.
 *
 * `path.basename` keeps a caller from walking out of the template directory through the route's
 * `:templateName` parameter; every legitimate name is a single path segment, so it is a no-op for
 * them.
 */
function templatePath(templateName) {
  return path.join(REPO_TEMPLATES_DIR, `${path.basename(templateName)}.md`);
}

/** The absolute path of the notice the server serves. */
function noticePath() {
  return templatePath(NOTICE_TEMPLATE);
}

/** The notice's markdown, exactly as it is served. */
function readNotice() {
  return fs.readFileSync(noticePath(), 'utf8');
}

/**
 * The notice's own version string, read from its version header line:
 *
 *     > **Version / الإصدار:** v2.2 (2026-09-17) — owner legal details applied
 *
 * The `Arabic: الإصدار` half of the header is matched structurally rather than by its characters.
 *
 * @throws {Error} when the served file carries no version header at all — better a loud failure
 *                 than a record written against an unknown version.
 */
function noticeVersion() {
  const match = readNotice().match(/^\s*>\s*\*\*Version[^*]*\*\*:?\s*(v[0-9][0-9A-Za-z.\-]*)/m);
  if (!match) {
    throw new Error(
      `No version header in ${noticePath()}: expected a line like '> **Version / ...:** v2.2'`
    );
  }
  return match[1];
}

module.exports = {
  NOTICE_TEMPLATE,
  REPO_TEMPLATES_DIR,
  templatePath,
  noticePath,
  readNotice,
  noticeVersion,
};
