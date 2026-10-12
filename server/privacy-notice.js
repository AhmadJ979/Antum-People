/**
 * Antum People — the privacy notice the server serves.
 *
 * ---------------------------------------------------------------------------
 * ONE DEFINITION OF "THE NOTICE"
 * ---------------------------------------------------------------------------
 * An acknowledgement record's evidential value rests on one thing: the version it names must be
 * the version of the notice a client could actually have been shown. So the route that serves the
 * notice and the route that records an acknowledgement read the SAME file through this module.
 * Two independent resolutions could disagree, and a record stating a version the served notice does
 * not carry is precisely the defect the acknowledgement work exists to remove.
 *
 * The resolution order below is the one the template route already used before this module existed
 * (the host-shared templates directory first, this repository's own `templates/` as the fallback).
 * It is kept rather than chosen because changing what the product serves is a decision with its own
 * blast radius, not a side effect of this one — see the note on divergence below.
 *
 * ---------------------------------------------------------------------------
 * A KNOWN DIVERGENCE, RECORDED NOT FIXED
 * ---------------------------------------------------------------------------
 * At the time of writing the two copies differ in content (not in version): the copy this module
 * resolves first still carries the words "statutory retention" in its retention table, and the
 * repository's copy does not — that qualifier was removed as unsourced in an earlier change that
 * landed in the repository only. So the notice a client can download today is the older text.
 * That is a finding for the owner of the notice, not something this module should paper over by
 * silently preferring the repository's copy: which copy the product serves is a deliberate choice,
 * and until it is made this module reads what the product actually serves and says so here.
 */

const fs = require('fs');
const path = require('path');

/** The template name the notice is served under (`GET /api/compliance/templates/:name/:employeeId`). */
const NOTICE_TEMPLATE = 'privacy-notice';

/** Where the product's shared templates live, and where this repository keeps its own. */
const SHARED_TEMPLATES_DIR = '/home/team/shared/templates';
const REPO_TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

/**
 * The absolute path of the notice the server serves. The first existing candidate wins, so a host
 * without the shared directory still serves the repository's copy rather than failing.
 */
function noticePath() {
  const shared = path.join(SHARED_TEMPLATES_DIR, `${NOTICE_TEMPLATE}.md`);
  if (fs.existsSync(shared)) return shared;
  return path.join(REPO_TEMPLATES_DIR, `${NOTICE_TEMPLATE}.md`);
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
 * Never a literal in code. The rule that keeps a record true is that changing the notice's content
 * means bumping this line — a content change that did not bump it is how a record ends up
 * describing a notice nobody can produce. So the record reads whatever the served file says, and
 * the `Arabic: الإصدار` half of the header is matched structurally rather than by its characters.
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
  noticePath,
  readNotice,
  noticeVersion,
};
