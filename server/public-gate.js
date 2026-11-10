// ── THE PUBLIC GATE ──────────────────────────────────────────────────────────────────────────────
// Both platform URLs proxy port 3000, so whatever this process serves IS the public product: until
// this module existed a stranger with the URL got the sign-in card, and behind it one `admin`
// account. The platform's proxy is not ours to change, so the gate lives here, in front of every
// route, every file under `client/dist` and the SPA catch-all.
//
// WHAT A REQUEST WITHOUT A VALID GATE CREDENTIAL GETS — nothing of the product:
//   * a page path (`/`, a deep link, any file under client/dist including `/assets/*.js`) -> the gate
//     page: one input, one submit, no bundle name, no `#root`, no API hint.
//   * an `/api/*` path -> PASSED STRAIGHT THROUGH to the app, which answers exactly as it answered
//     before this module existed. The gate does not touch it (see THE API IS NOT GATED below).
//
// WHAT A REQUEST WITH A VALID GATE CREDENTIAL GETS: exactly what it got before this module — the
// built shell, the assets, and the sign-in card with the admin login as a SECOND layer.
//
// THE API IS NOT GATED — and the first cut of this module was wrong about that (revised 2026-11-08).
// That cut answered `/api` itself with a body it described as "byte-identical" to
// `auth.authenticateToken`'s refusal. The BODY was identical; the ANSWER was not, and three of the
// differences were reachable by a single request:
//   * the gate ran BEFORE the CORS middleware, so a non-allowlisted `Origin` got `401` from the gate
//     where the app answers `403` with its own body. `scripts/cors-error-contract-test.sh` test 1
//     measured exactly this (401 where 403 was expected) on a rig with the gate configured.
//   * it ran before the JSON body parser, so a malformed `POST /api/login` body got `401` where the
//     app answers `400 {"error":"Bad Request"}`.
//   * it ran before the routes, so `/api/login`'s own 25-failures/60 s limiter, `/api/health`'s 404
//     and every other route's answer were replaced by a refusal for callers the app would have served.
// A module header asserting sameness is a claim, and that claim was false. So the API is now passed
// through untouched — same status, same bytes, same CORS behaviour, same preflight handling, same
// limiter, BY CONSTRUCTION, because this module never writes to that response. The API carries its
// own authentication (a JWT; 401 without one), so what this gate protects is the shell and the
// assets, which is the whole of the owner's "keep it public or gate it" question.
// It also keeps the keep-alive guard's health contract (`scripts/keep-alive.sh` `check_health`)
// meaningful without any help from here: that guard judges the product healthy by the app's own
// `401 {"error":"Authentication token required"}` bytes on `GET /api/employees`, which is what the
// pass-through delivers — and what a gate-answered `/api` would have replaced with an HTML page,
// putting the guard into a kill/restart loop against a state no restart repairs.
//
// THE TWO FILES THIS MODULE READS AT BOOT (never in the repository, never printed):
//   ANTUM_GATE_PASSCODE_FILE  default /home/team/shared/.antum-gate-passcode  — one line, a bcrypt
//                             hash at cost 12, exactly the shape of the admin credential.
//   ANTUM_GATE_SECRET_FILE    default /home/team/shared/.antum-gate-secret    — one line, hex, the
//                             HMAC key the cookie is signed with.
// `scripts/deploy-main.sh` creates both when they are absent (mode 600) so a fresh host works.
//
// FAIL CLOSED, LOUDLY. If either file is missing, unreadable or empty the gate is NOT CONFIGURED and
// says so once at boot, naming the file. A page request then answers 503 with a gate page that names
// nothing; it never falls through to the shell, and no asset is served either. `/api` is unaffected
// by that state, because `/api` is never gated at all (see above) — so the guard's health probe still
// reads the app's own 401 while the shell is sealed.
//
// THE COOKIE. `antum_gate=v1.<issuedAtMs>.<hmac>` — HttpOnly, SameSite=Lax, Secure, 180 days, signed
// with the secret above so a forged, truncated or hand-edited cookie cannot pass, and refused if the
// stamp is in the future or older than the max age. `POST /gate/logout` (and GET, for a one-click
// link) clears it.
//
// WHAT THIS GATE IS NOT. It is not a defence against someone who can read the host's filesystem:
// the signing key lives there, so an operator on this machine can mint a cookie (that is how the
// deploy and the instruments are meant to reach the shell — see `mintCookieHeader`). It stops a
// stranger with the URL, which is the whole of what was asked.

const crypto = require('crypto');
const fs = require('fs');
const express = require('express');
const bcrypt = require('bcryptjs');

const COOKIE_NAME = 'antum_gate';
const COOKIE_VERSION = 'v1';
const COOKIE_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;
const COOKIE_MAX_AGE_SECONDS = Math.floor(COOKIE_MAX_AGE_MS / 1000);

// The passcode endpoint's limiter, the same shape as `/api/login`'s (server/index.js): 25 failures in
// 60 s from one address -> 429. Success clears the bucket.
const FAILURE_WINDOW_MS = 60000;
const FAILURE_LIMIT = 25;

const GATE_PAGE_PATH = '/gate';
const GATE_LOGOUT_PATH = '/gate/logout';

const DEFAULT_PASSCODE_FILE = '/home/team/shared/.antum-gate-passcode';
const DEFAULT_SECRET_FILE = '/home/team/shared/.antum-gate-secret';

const API_REFUSAL = { error: 'Authentication token required' };
// The string above is the API's OWN refusal (`server/auth.js` `authenticateToken`), held here for one
// reason: `server/public-gate.test.js` asserts that a `/api` request THROUGH the gate still carries
// exactly these bytes, so a pass-through that quietly started reshaping the refusal would redden. The
// gate never writes this body — it writes no `/api` response at all (see THE API IS NOT GATED).

/** Where the two host files are. Every value is an override, so a scratch rig never reads the host's. */
function filePaths(env = process.env) {
  return {
    passcodeFile: env.ANTUM_GATE_PASSCODE_FILE || DEFAULT_PASSCODE_FILE,
    secretFile: env.ANTUM_GATE_SECRET_FILE || DEFAULT_SECRET_FILE,
  };
}

/**
 * Read one single-line host file. Returns `{ value }` or `{ problem }` — never throws, because a
 * throw here would take the process down and the brief's requirement is a 503 that names the file,
 * not a crash. The value is trimmed; a file with trailing whitespace is not a different credential.
 */
function readLine(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    const code = err && err.code ? err.code : 'unreadable';
    return { problem: code === 'ENOENT' ? 'is missing' : `could not be read (${code})` };
  }
  const value = text.trim();
  if (!value) return { problem: 'is empty' };
  return { value };
}

/**
 * The gate's configuration, read once at boot.
 *
 * A file that exists but holds something that is not a bcrypt hash is NOT treated as "not
 * configured": it is treated as a passcode nobody knows, so every submission fails on the generic
 * page. Only a missing, unreadable or empty file makes the gate unconfigured — that is the case the
 * brief requires to be a loud 503.
 */
function readConfig({ passcodeFile, secretFile, log, env } = {}) {
  const defaults = filePaths(env);
  const paths = {
    passcodeFile: passcodeFile || defaults.passcodeFile,
    secretFile: secretFile || defaults.secretFile,
  };
  const passcode = readLine(paths.passcodeFile);
  if (passcode.problem) {
    return notConfigured(paths, paths.passcodeFile, passcode.problem, log);
  }
  const secret = readLine(paths.secretFile);
  if (secret.problem) {
    return notConfigured(paths, paths.secretFile, secret.problem, log);
  }
  if (secret.value.length < 32) {
    return notConfigured(paths, paths.secretFile, 'is shorter than 32 characters', log);
  }
  return {
    configured: true,
    passcodeHash: passcode.value,
    secret: secret.value,
    passcodeFile: paths.passcodeFile,
    secretFile: paths.secretFile,
  };
}

function notConfigured(paths, file, problem, log) {
  if (typeof log === 'function') {
    // ONE line, at boot, naming the file. It is the operator's first move and the only place the
    // state is announced: the request path stays silent so a stranger cannot make the log grow.
    log(`[gate] NOT CONFIGURED — ${file} ${problem}. The app shell and every static asset answer 503`
      + ' until it exists (a restart re-reads it); /api is not gated and is unaffected.');
  }
  return { configured: false, file, problem, passcodeFile: paths.passcodeFile, secretFile: paths.secretFile };
}

// ── the cookie ───────────────────────────────────────────────────────────────────────────────────

/** HMAC over the version and the raw stamp STRING, so a stamp with leading zeros cannot re-sign. */
function sign(secret, stamp) {
  return crypto.createHmac('sha256', secret).update(`antum-gate.${COOKIE_VERSION}.${stamp}`).digest('base64url');
}

function makeCookieValue(secret, now = Date.now()) {
  const stamp = String(Math.floor(now));
  return `${COOKIE_VERSION}.${stamp}.${sign(secret, stamp)}`;
}

/** True only for a cookie this server minted, still inside its window. Never throws. */
function verifyCookieValue(secret, value, now = Date.now()) {
  if (typeof value !== 'string' || !value) return false;
  const parts = value.split('.');
  if (parts.length !== 3) return false;
  const [version, stamp, mac] = parts;
  if (version !== COOKIE_VERSION) return false;
  if (!/^(0|[1-9][0-9]{0,15})$/.test(stamp)) return false;
  const issuedAt = Number(stamp);
  if (!Number.isFinite(issuedAt)) return false;
  // A stamp from the future is refused: a clock-skew allowance would let a far-future stamp outlive
  // any max-age. 60 s of slack is for hosts whose clocks disagree by seconds, nothing more.
  if (issuedAt > now + 60000) return false;
  if (now - issuedAt > COOKIE_MAX_AGE_MS) return false;
  const expected = sign(secret, stamp);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * A valid cookie value, minted from the host's secret file. This is how the deploy and the
 * instruments reach the shell: the passcode file is a bcrypt HASH, so no script can derive the
 * passcode, but anything that can read the signing key can mint the credential — which is the right
 * boundary, because reading that key already means you are on the host.
 */
function mintCookieHeader(secretFile) {
  const secret = readLine(secretFile);
  if (secret.problem) throw new Error(`${secretFile} ${secret.problem}`);
  return `${COOKIE_NAME}=${makeCookieValue(secret.value)}`;
}

// ── the pages ────────────────────────────────────────────────────────────────────────────────────

// ── THE WORDMARK ────────────────────────────────────────────────────────────────────────────────
// أنتم — the brand's Arabic wordmark — drawn as VECTOR PATHS, not as text in a font.
//
// Why paths: this page is the first thing a stranger with the URL sees, on a machine whose fonts we
// cannot know. Text would need an Arabic-capable font on the visitor's machine and would show empty
// boxes (tofu) where there is none; a webfont would need a second request that this gate would answer
// with the gate page itself, and would dwarf the page. The outlines below are Cairo's (OFL, the brand
// face, `client/public/fonts/cairo/cairo-arabic.woff2`), shaped with HarfBuzz for the connected forms
// of أنتم and cut with fontTools, then committed here as path data — so the mark draws identically
// with NO font installed, no network fetch and no extra byte of CSS.
//
// These numbers are generated, not hand-written. To regenerate after a brand change: shape the string
// with HarfBuzz against the Cairo face, emit each glyph with fontTools' SVGPathPen (glyphs placed by
// their HarfBuzz advances, y flipped for SVG, the ink box translated to the origin) and paste the
// result here beside the viewBox. `server/public-gate.test.js` asserts the mark is on the page, that
// it is a path, that no font is loaded, and pins the page's byte count.
const WORDMARK_VIEWBOX = '0 0 1413 1295';
const WORDMARK_PATH = 'M511 963V892H619V963ZM25 1295Q15 1238 8 1187Q0 1136 0 1100Q0 1035 22 988Q45 942 88 917Q130 892 189 892Q206 892 239'
  + ' 892Q272 892 315 892Q358 892 404 892Q450 892 491 892L433 943V718Q433 648 417 608Q401 568 362 551Q324 534 258 534Q216'
  + ' 534 174 540Q133 546 110 556L157 508Q151 532 145 568Q139 605 136 647Q132 689 132 731Q132 774 136 815Q139 856 144'
  + ' 886Q149 916 152 928L78 949Q74 936 68 904Q63 872 58 827Q54 782 54 731Q54 682 58 636Q63 589 70 551Q76 513 82 490Q104'
  + ' 481 152 472Q200 463 258 463Q308 463 348 472Q389 480 420 499Q450 518 470 548Q491 577 501 620Q511 662 511 718V963Q469'
  + ' 963 420 963Q372 963 326 963Q279 963 242 963Q206 963 189 963Q173 963 154 968Q135 972 118 986Q100 999 89 1026Q78 1054'
  + ' 78 1100Q78 1138 85 1187Q92 1236 101 1295ZM619 963V892Q625 892 629 894Q633 897 635 902Q637 906 638 912Q639 919 639'
  + ' 927Q639 935 638 942Q637 949 635 954Q633 958 629 960Q625 963 619 963ZM805 963V892H913V963ZM913 963V892Q919 892 923'
  + ' 894Q927 897 929 902Q931 906 932 912Q933 919 933 927Q933 935 932 942Q931 949 929 954Q927 958 923 960Q919 963 913'
  + ' 963ZM619 963Q613 963 609 960Q605 958 603 954Q601 949 600 942Q599 935 599 927Q599 916 600 908Q602 901 606 896Q611 892'
  + ' 619 892ZM619 963V892H763L727 921V463H805V963ZM659 373V283H737V373ZM796 373V283H874V373ZM913 963V892H1057L1021'
  + ' 921V463H1099V963ZM913 963Q907 963 903 960Q899 958 897 954Q895 949 894 942Q893 935 893 927Q893 916 894 908Q896 901'
  + ' 900 896Q905 892 913 892ZM1021 373V283H1099V373ZM1276 963V246H1353V963ZM1268 180Q1252 160 1244 141Q1235 122 1235'
  + ' 101Q1235 72 1250 49Q1264 26 1288 13Q1312 0 1340 0Q1356 0 1372 4Q1388 9 1400 17L1374 62Q1366 57 1358 56Q1351 54 1343'
  + ' 54Q1320 54 1306 67Q1293 80 1293 101Q1293 114 1298 126Q1304 138 1315 152ZM1216 180V127H1413V180Z';

const PAGE_CSS = 'body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;'
  + 'background:#0f172a;color:#e2e8f0;font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}'
  + 'main{width:min(92vw,22rem);padding:2rem;background:#1e293b;border-radius:.75rem}'
  + 'h1{margin:0 0 .5rem;font-size:1.125rem;font-weight:600}'
  + 'p{margin:0 0 1.25rem;color:#94a3b8;font-size:.875rem}'
  + 'input{width:100%;box-sizing:border-box;padding:.625rem .75rem;border-radius:.5rem;border:1px solid #334155;'
  + 'background:#0f172a;color:#e2e8f0;font-size:1rem}'
  + 'button{margin-top:.75rem;width:100%;padding:.625rem .75rem;border:0;border-radius:.5rem;'
  + 'background:#38bdf8;color:#0f172a;font-size:1rem;font-weight:600;cursor:pointer}'
  + '.mark{display:block;width:6.5rem;height:auto;margin:0 0 .5rem}'
  + '.name{margin:0 0 1.25rem;color:#94a3b8;font-size:.75rem;letter-spacing:.14em;'
  + 'text-transform:uppercase}'
  + '.notice{margin:1rem 0 0;color:#fca5a5;font-size:.8125rem}';

/**
 * THE GATE PAGE. One input, one submit, nothing else — no bundle name, no `#root`, no API hint, no
 * product chrome beyond the title. `notice` is a fixed sentence from a small closed set; it never
 * echoes anything a caller sent, so it cannot become a reflection point.
 */
function gatePage(notice = '') {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Antum People — access</title>
<style>${PAGE_CSS}</style>
</head>
<body>
<main>
<svg class="mark" viewBox="${WORDMARK_VIEWBOX}" role="img" aria-label="أنتم — Antum People"><path fill="#e2e8f0" d="${WORDMARK_PATH}"/></svg>
<p class="name">Antum People</p>
<h1>Access</h1>
<p>This site is restricted. Enter the passcode to continue.</p>
<form method="post" action="${GATE_PAGE_PATH}" autocomplete="off">
<input type="password" name="passcode" aria-label="Passcode" autofocus required>
<button type="submit">Continue</button>
</form>
${notice ? `<p class="notice">${notice}</p>` : ''}
</main>
</body>
</html>
`;
}

// The only two sentences a failure can carry. Both are fixed strings, both are about the request and
// never about the file behind it — so a wrong passcode cannot tell a caller whether the passcode file
// exists, is empty, or holds something that is not a hash. The 503 is the one state that is
// distinguishable, and that is the brief's own requirement: an operator must be able to see it.
const NOTICE_REJECTED = 'That passcode was not accepted.';
const NOTICE_UNAVAILABLE = 'Access is temporarily unavailable.';

// ── the gate itself ─────────────────────────────────────────────────────────────────────────────

function parseCookies(header) {
  const out = {};
  if (typeof header !== 'string' || !header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    if (!name) continue;
    out[name] = part.slice(eq + 1).trim();
  }
  return out;
}

/**
 * Build the gate. `options.log` is the boot/limiter log sink (index.js passes console.log);
 * `options.env` and the two `*File` options exist so a test rig can point the gate at its own
 * throwaway files instead of the host's.
 */
function createGate(options = {}) {
  const log = options.log || ((line) => console.log(line));
  const paths = {
    passcodeFile: options.passcodeFile || filePaths(options.env).passcodeFile,
    secretFile: options.secretFile || filePaths(options.env).secretFile,
  };
  const config = readConfig({ ...paths, log });

  // A hash that is not a bcrypt string is compared against a throwaway hash instead, so the time an
  // attempt takes says nothing about why it failed (the same timing fix `/api/login` carries).
  const usableHash = config.configured && /^\$2[aby]\$/.test(config.passcodeHash)
    ? config.passcodeHash
    : (config.configured ? bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12) : null);

  const failures = new Map();

  const isLimited = (ip) => {
    const now = Date.now();
    const recent = (failures.get(ip) || []).filter((ts) => now - ts < FAILURE_WINDOW_MS);
    failures.set(ip, recent);
    return recent.length >= FAILURE_LIMIT;
  };
  const recordFailure = (ip) => {
    const recent = failures.get(ip) || [];
    recent.push(Date.now());
    failures.set(ip, recent);
  };

  const cookieAttributes = `Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${COOKIE_MAX_AGE_SECONDS}`;

  const sendPage = (res, status, notice) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    res.status(status).type('html').send(gatePage(notice));
  };

  const hasValidCookie = (req) => {
    if (!config.configured) return false;
    const cookies = parseCookies(req.headers.cookie);
    return verifyCookieValue(config.secret, cookies[COOKIE_NAME]);
  };

  // GET /gate — the page, always. Reachable with or without a cookie: a visitor who already holds one
  // and follows a stale link should land on the page, not on a redirect loop.
  const page = (req, res) => {
    if (!config.configured) return sendPage(res, 503, NOTICE_UNAVAILABLE);
    return sendPage(res, 200, '');
  };

  // POST /gate — the passcode. Every failure answers the SAME page; only the status differs (401 for
  // a passcode that was not accepted, 429 for the limiter), so the body cannot become an oracle.
  const submit = async (req, res) => {
    if (!config.configured) return sendPage(res, 503, NOTICE_UNAVAILABLE);
    const ip = req.ip;
    if (isLimited(ip)) return sendPage(res, 429, NOTICE_REJECTED);
    const body = req.body || {};
    const submitted = typeof body.passcode === 'string' ? body.passcode : '';
    let accepted = false;
    if (submitted) {
      try {
        accepted = await bcrypt.compare(submitted, usableHash);
      } catch (err) {
        accepted = false;
      }
    }
    if (!accepted) {
      recordFailure(ip);
      return sendPage(res, 401, NOTICE_REJECTED);
    }
    failures.delete(ip);
    res.set('Set-Cookie', `${COOKIE_NAME}=${makeCookieValue(config.secret)}; ${cookieAttributes}`);
    res.set('Cache-Control', 'no-store');
    return res.redirect(303, '/');
  };

  // /gate/logout — clears the cookie and sends the caller back to the gate page. Nothing here needs a
  // credential: clearing a cookie is not an act the cookie protects.
  const logout = (req, res) => {
    res.set('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`);
    res.set('Cache-Control', 'no-store');
    return res.redirect(303, GATE_PAGE_PATH);
  };

  /**
   * The router for the gate's own paths — mounted at GATE_PAGE_PATH, so `/gate` and `/gate/logout`.
   * index.js mounts it BEFORE the middleware below, which makes these the only paths in the product
   * that are answered without a credential.
   */
  const router = express.Router();
  router.get(GATE_PAGE_PATH, page);
  router.post(GATE_PAGE_PATH, express.urlencoded({ extended: false, limit: '4kb' }), submit);
  router.get(GATE_LOGOUT_PATH, logout);
  router.post(GATE_LOGOUT_PATH, logout);

  /**
   * Everything else. Registered before every other middleware and route in index.js, so it is the
   * first thing a request meets — before CORS, before the API, before express.static, before the SPA
   * catch-all.
   */
  const middleware = (req, res, next) => {
    // THE ONE LINE THAT IS THE API DECISION: `/api` and everything under it is handed to the app
    // before any gate state is consulted — configured or not, cookie or not. The app therefore
    // answers exactly what it answered before this module existed, because nothing here touches
    // that response. The header above names the three divergences the first cut introduced and this
    // line removes; `server/public-gate.test.js` asserts the pass-through by asking for a shape the
    // gate would never produce (a foreign Origin gets the app's 403, not a 401).
    if (req.path === '/api' || req.path.startsWith('/api/')) return next();
    if (!config.configured) {
      // FAIL CLOSED ON THE PRODUCT: no shell, no asset, ever.
      return sendPage(res, 503, NOTICE_UNAVAILABLE);
    }
    if (hasValidCookie(req)) return next();
    return sendPage(res, 200, '');
  };

  return { config, router, middleware, page, submit, logout, isLimited, usableHash: Boolean(usableHash) };
}

module.exports = {
  COOKIE_NAME,
  COOKIE_MAX_AGE_MS,
  COOKIE_MAX_AGE_SECONDS,
  FAILURE_LIMIT,
  FAILURE_WINDOW_MS,
  GATE_PAGE_PATH,
  GATE_LOGOUT_PATH,
  DEFAULT_PASSCODE_FILE,
  DEFAULT_SECRET_FILE,
  API_REFUSAL,
  NOTICE_REJECTED,
  NOTICE_UNAVAILABLE,
  filePaths,
  readConfig,
  sign,
  makeCookieValue,
  verifyCookieValue,
  mintCookieHeader,
  gatePage,
  createGate,
};
