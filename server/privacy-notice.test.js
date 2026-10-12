/**
 * The notice the server serves — one authoritative copy, and it is this repository's.
 *
 * Measured on 2026-10-12: the product served `/home/team/shared/templates/privacy-notice.md`, a copy
 * outside the repository that had drifted from the reviewed one and carried the same version string
 * `v2.2`. The repository's copy is the reviewed text (`313a017` dropped its unsourced "statutory
 * retention" qualifier on the record); the served copy still had it. So a client downloading the
 * notice got the text we had reviewed *out*, and an acknowledgement record naming `v2.2` could not
 * say which of the two texts the hire was shown.
 *
 * These tests hold the resolution, not the wording: which file is served, that the bytes served are
 * that file's bytes, that the version a record names is read from the same file, and that no module
 * under `server/` starts reading the host-shared directory again. The notice's own sentence about
 * retention is counsel's and the compliance owner's — deliberately not asserted here.
 *
 * Runs against the repository's own files: `cd server && npm test`.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const privacyNotice = require('./privacy-notice');

const SERVER_DIR = __dirname;
const REPO_TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

// Built from parts on purpose: this guard must not match its own source line.
const HOST_SHARED_DIR = ['', 'home', 'team', 'shared'].join('/');

// The template names the product offers a client, taken from the `fetchTemplate(...)` calls in
// client/src/App.tsx (the privacy notice, the employment contract per jurisdiction, the settlement
// statement). If a screen offers a fifth document, it belongs here and in `templates/`.
const CLIENT_REACHABLE_TEMPLATES = [
  'privacy-notice',
  'uae-employment-contract',
  'ksa-employment-contract',
  'final-settlement-statement',
];

describe('the notice resolves from this repository', () => {
  test('noticePath() is the repository copy, and it exists', () => {
    assert.strictEqual(
      privacyNotice.noticePath(),
      path.join(REPO_TEMPLATES_DIR, 'privacy-notice.md')
    );
    assert.ok(fs.existsSync(privacyNotice.noticePath()));
  });

  test('the notice served is the repository copy byte for byte', () => {
    const onDisk = fs.readFileSync(path.join(REPO_TEMPLATES_DIR, 'privacy-notice.md'), 'utf8');
    assert.strictEqual(privacyNotice.readNotice(), onDisk);
  });

  test('the version is read from the file served, never a literal in code', () => {
    const header = privacyNotice
      .readNotice()
      .match(/^\s*>\s*\*\*Version[^*]*\*\*:?\s*(v[0-9][0-9A-Za-z.\-]*)/m);
    assert.ok(header, 'the served notice carries a version header');
    assert.strictEqual(privacyNotice.noticeVersion(), header[1]);
  });

  test('every document the product offers resolves to a file in this repository', () => {
    for (const name of CLIENT_REACHABLE_TEMPLATES) {
      const resolved = privacyNotice.templatePath(name);
      assert.strictEqual(path.dirname(resolved), REPO_TEMPLATES_DIR, `${name} resolves under templates/`);
      assert.ok(fs.existsSync(resolved), `${name} exists in the repository`);
    }
  });

  test('a caller cannot walk out of the template directory', () => {
    for (const attempt of ['../../server/db', '..%2F..%2Fetc/passwd', '/etc/passwd', '..']) {
      assert.strictEqual(
        path.dirname(privacyNotice.templatePath(attempt)),
        REPO_TEMPLATES_DIR,
        `${attempt} stays inside templates/`
      );
    }
  });
});

/**
 * Comments are not reads: this module and the module's own history note both *name* the path in
 * prose, which is the point of naming it. The guard looks at code, so it strips block comments and
 * whole-line comments first. (Without this it failed on its own documentation the first time it ran,
 * which is a check reporting on text rather than on behaviour.)
 */
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('the host-shared directory is not a source any more', () => {
  test('no module under server/ reads it', () => {
    const scanned = fs.readdirSync(SERVER_DIR).filter((f) => f.endsWith('.js'));
    assert.ok(scanned.length > 5, 'the scan found the server modules');
    const offenders = scanned.filter((f) =>
      stripComments(fs.readFileSync(path.join(SERVER_DIR, f), 'utf8')).includes(HOST_SHARED_DIR)
    );
    assert.deepStrictEqual(
      offenders,
      [],
      'a server module reads the host-shared templates directory again — the copy a client downloads is no longer the reviewed one'
    );
  });
});

/**
 * The version string appears three times in the served notice, and a record's truth depends on all
 * three agreeing: the status line, the version header this module parses, and the consent-version
 * table row a reader sees. A partial bump leaves the served document contradicting itself, and
 * `:247`'s row must stay a table row — `noticeVersion()` takes the FIRST `**Version ...:**` match, so
 * a second header would shadow nothing today and silently win tomorrow.
 *
 * These guard the shape, never the number: they pass whether the served copy reads `v2.2` or `v2.3`,
 * so they do not pre-empt the notice owner's bump.
 */
describe('the served notice states one version in all three places', () => {
  const notice = privacyNotice.readNotice();

  test('the status line, the version header and the consent row agree', () => {
    const version = privacyNotice.noticeVersion();
    const status = notice.match(/\*\*Status[^*]*\*\*:?\s*Template\s+(v[0-9][0-9A-Za-z.\-]*)/);
    const consent = notice.match(/\|\s*Consent Version[^|]*\|\s*(v[0-9][0-9A-Za-z.\-]*)/);
    assert.ok(status, 'the status line carries a version');
    assert.ok(consent, 'the consent-version table row carries a version');
    assert.strictEqual(status[1], version, 'the status line names the served version');
    assert.strictEqual(consent[1], version, 'the consent-version row names the served version');
  });

  test('there is exactly one version header, so a later row cannot shadow it', () => {
    const headers = notice.match(/^\s*>\s*\*\*Version[^*]*\*\*/gm) || [];
    assert.strictEqual(headers.length, 1, 'one version header line, never a second');
    assert.strictEqual(
      notice.search(/^\s*>\s*\*\*Version[^*]*\*\*/m),
      notice.search(/^\s*>\s*\*\*Version[^*]*\*\*:?\s*(v[0-9][0-9A-Za-z.\-]*)/m),
      'the header the parser reads is the first one in the file'
    );
  });
});
