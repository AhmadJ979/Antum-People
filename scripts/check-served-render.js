#!/usr/bin/env node
"use strict";
/*
  check-served-render.js - does the SERVED PRODUCT actually RENDER?

  WHY THIS FILE EXISTS (2026-11-02). The owner opened the product and saw a blank page. Every
  instrument we had was green: check-all 9 OK / 0 BROKEN, the server suite 404 pass, the bundle
  md5 correct, the API answering. None of them looks at a rendered screen. An uptime check would
  not have caught it either: the document returns HTTP 200. The only thing that catches this is
  a browser loading the page and asking whether the app mounted.

  WHAT IT MEASURES, PER TARGET (one line each, measured values only - never a bare verdict):
    - the HTTP status of the DOCUMENT, read from the browser's own network log (not curl);
    - the HTTP status of EVERY same-origin script/stylesheet the document NAMES (read from the
      DOM, so a request the browser never made reads NO-REQUEST and fails - it is not a pass);
    - whether the app MOUNTED: `#root` exists, has >= 1 child element, and its trimmed innerText
      is non-empty (first 60 chars printed);
    - the page-error count and how long it waited for the mount, so a zero on a page that never
      finished painting cannot read as a zero on a page that did.

  WHY THE DECLARED-RED TARGET IS INSIDE THIS FILE AND NOT check-all's `expect="known-red"`.
  One hostname (`.cto.site`) is served by a platform edge that answers 403 `{"error":"Forbidden"}`
  to every request carrying an `Origin` header - including the document's own module-script and
  stylesheet requests - so the app cannot mount there while the document itself is 200. That edge
  is outside this repository and is not ours to fix. Declaring the WHOLE CHECK known-red in
  check-all would make a real failure of the OTHER two targets print RED-KNOWN and PASS the run -
  a false green, and exactly the class of defect this file exists to end. So the discrimination is
  PER TARGET here: a declared-red target that fails prints RED-KNOWN and does not fail the run; a
  declared-red target that PASSES prints STALE-DECLARATION and exits 1 (a declaration that no
  longer fires is a lie about the tree). check-all registers this check `expect="green"`, so
  everything else - including the local process and the working public host - is a hard gate.

  WHAT IT CANNOT SEE, so a green run never implies otherwise:
    - whether the rendered TEXT IS CORRECT (it asserts non-empty, not truthful);
    - anything behind a sign-in (it never authenticates; rule 26 - a credentialed pass runs on a
      rig of its own, never the live product);
    - a page that mounts and then blanks itself after the measurement window;
    - whether the stylesheet is APPLIED (status 200, not cascade);
    - a target it was not given: the checked set is the three below, printed every run.

  EXIT CODES (the team's convention, #266):
    0  every required target GREEN, every declared-red target still RED
    1  a required target failed, OR a declaration went stale
    2  CANNOT-JUDGE - the instrument could not run (no agent-browser on PATH, no target measured,
       the probe could not be evaluated). Never printed as a verdict; check-all fails the run on it.

  USAGE
    node scripts/check-served-render.js                  # the default set: local process + both public hosts
    node scripts/check-served-render.js --target <url>   # add a required target
    node scripts/check-served-render.js --replace --target <url>   # ONLY the given targets
    node scripts/check-served-render.js --wait 20000 --timeout 30000
    node scripts/check-served-render.js --selftest       # proves the instrument can redden (3 plants)
    node scripts/check-served-render.js --json           # the same measurements as one JSON object

  HOW IT DRIVES A BROWSER. `agent-browser` (installed on this host, version printed in the output),
  headless, one isolated session per target, per-step and per-target timeouts so a browser that
  will not start FAILS the run instead of hanging it. Nothing is installed and nothing is rebuilt:
  this file reads, it does not change the product, the database or client/dist.
*/

const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const http = require("node:http");

const pexec = promisify(execFile);

const BIN = process.env.AGENT_BROWSER_BIN || "agent-browser";
const MOUNT = "#root";
const MAXBUF = 32 * 1024 * 1024;

// ---------------------------------------------------------------- the checked set

const DEFAULT_TARGETS = [
  {
    id: "local",
    url: "http://127.0.0.1:3000/",
    note: "the product process on this host (port 3000)",
  },
  {
    id: "public-app",
    url: "https://b974147c03228029e277d1cbe6646fe6.ctonew.app/",
    note: "the public hostname that serves the product",
  },
  {
    id: "public-site",
    url: "https://b974147c03228029e277d1cbe6646fe6.cto.site/",
    note: "the public hostname the owner was given",
    declaredRed: {
      reason:
        "the platform edge fronting this hostname answers 403 {\"error\":\"Forbidden\"} to every " +
        "request that carries an Origin header - the document's own <script type=module> and " +
        "stylesheet requests carry one - so no bundle executes and #root stays empty while the " +
        "document itself answers 200. Outside this repository; not ours to fix.",
      pointer: "docs/evidence/served-render-blank-page-2026-11-02/EVIDENCE.md",
      endsWhen:
        "every named asset answers 200 and #root mounts on this hostname. Then DELETE this " +
        "declaration: a declaration that no longer fires exits 1 (STALE-DECLARATION), never green.",
    },
  },
];

// ---------------------------------------------------------------- browser driver

class CannotJudge extends Error {}

function parseLoose(text) {
  const s = String(text || "").trim();
  try {
    return JSON.parse(s);
  } catch (_) {
    /* agent-browser may print chatter before the JSON blob; take the outermost object */
    const a = s.indexOf("{");
    const b = s.lastIndexOf("}");
    if (a >= 0 && b > a) return JSON.parse(s.slice(a, b + 1));
    throw new Error("no JSON object in the output");
  }
}

async function ab(args, timeoutMs) {
  try {
    const { stdout } = await pexec(BIN, args, {
      timeout: timeoutMs,
      killSignal: "SIGKILL",
      maxBuffer: MAXBUF,
      encoding: "utf8",
    });
    return { ok: true, out: stdout };
  } catch (e) {
    if (e.code === "ENOENT") {
      throw new CannotJudge(
        "`" + BIN + "` is not on PATH (set AGENT_BROWSER_BIN) - this check cannot drive a browser here"
      );
    }
    if (e.killed || e.signal || e.code === "ETIMEDOUT") {
      return { ok: false, timedOut: true, err: `${args[0]} timed out after ${timeoutMs}ms` };
    }
    const err = (e.stderr || e.message || "").toString().split("\n")[0].slice(0, 300);
    return { ok: false, err: `${args[0]} exited ${e.code}: ${err}` };
  }
}

async function abJson(args, timeoutMs) {
  const r = await ab(args, timeoutMs);
  if (!r.ok) return r;
  try {
    const j = parseLoose(r.out);
    if (j && j.success === false) return { ok: false, err: (j.error || "reported failure").toString().slice(0, 300) };
    return { ok: true, json: j };
  } catch (e) {
    return { ok: false, err: `${args[0]} printed no JSON: ${String(r.out).slice(0, 200)}` };
  }
}

const PROBE = `(() => {
  const r = document.querySelector(${JSON.stringify(MOUNT)});
  const named = [];
  for (const s of document.querySelectorAll('script[src]')) named.push(s.getAttribute('src'));
  for (const l of document.querySelectorAll('link[rel~="stylesheet"][href]')) named.push(l.getAttribute('href'));
  return JSON.stringify({
    rootFound: !!r,
    children: r ? r.children.length : -1,
    text: r ? (r.innerText || '').replace(/\\s+/g, ' ').trim() : '',
    bodyLen: document.body ? (document.body.innerText || '').length : -1,
    title: document.title,
    named: named
  });
})()`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function originOf(u) {
  try {
    return new URL(u).origin;
  } catch (_) {
    return null;
  }
}

function pathOf(u) {
  try {
    const x = new URL(u);
    return x.pathname + (x.search || "");
  } catch (_) {
    return String(u);
  }
}

/*
  Measure ONE target. Returns a record of what was measured; it never judges, so the caller can
  print the values and then say which assertion each value failed.
*/
async function measure(t, opts) {
  const started = Date.now();
  const session = `antum-render-${process.pid}-${t.id}-${started % 1000000}`;
  const m = {
    id: t.id,
    url: t.url,
    session,
    title: null,
    docStatus: null,
    docEntry: null,
    assets: [],
    crossOriginSkipped: 0,
    dom: null,
    pageErrors: null,
    waitedMs: 0,
    elapsedMs: 0,
    error: null,
    cannotJudge: false,
  };
  const stepTimeout = opts.stepTimeoutMs;
  const deadline = started + opts.targetTimeoutMs;

  const left = () => Math.max(1000, deadline - Date.now());

  try {
    // 1. navigate. A browser that cannot start is CANNOT-JUDGE; a URL that will not load is a
    //    measured failure of that target, and is named as such.
    const open = await abJson(["--session", session, "--json", "open", t.url], Math.min(stepTimeout, left()));
    if (!open.ok) {
      m.error = `open failed: ${open.err}`;
      m.timedOut = !!open.timedOut;
      return m;
    }
    m.title = (open.json.data && open.json.data.title) || null;
    m.finalUrl = (open.json.data && open.json.data.url) || t.url;

    // 2. wait for the mount, up to opts.waitMs. A page that never paints must not read as a
    //    zero measured on a page that did (the pre-paint trap).
    const waitUntil = Math.min(started + opts.waitMs, deadline);
    let lastErr = null;
    for (;;) {
      const e = await abJson(["--session", session, "--json", "eval", PROBE], Math.min(stepTimeout, left()));
      if (e.ok && e.json.data && typeof e.json.data.result === "string") {
        try {
          m.dom = JSON.parse(e.json.data.result);
        } catch (_) {
          lastErr = "the probe returned something that is not JSON";
        }
      } else {
        lastErr = e.err || "eval returned no result";
      }
      if (m.dom && m.dom.rootFound && m.dom.children >= 1 && m.dom.text) break;
      if (Date.now() >= waitUntil) break;
      await sleep(400);
    }
    m.waitedMs = Date.now() - started;
    if (!m.dom) {
      m.cannotJudge = true;
      m.error = `could not evaluate the probe: ${lastErr || "no result"}`;
      return m;
    }

    // 3. the browser's own network log: document status + asset statuses. Read AFTER the wait, so
    //    every request the page made is in it.
    const n = await abJson(["--session", session, "--json", "network", "requests"], Math.min(stepTimeout, left()));
    if (!n.ok) {
      m.cannotJudge = true;
      m.error = `could not read the network log: ${n.err}`;
      return m;
    }
    const entries = (n.json.data && n.json.data.requests) || [];
    const byUrl = new Map();
    for (const r of entries) if (r && r.url) byUrl.set(r.url, r);

    const want = [t.url, m.finalUrl].filter(Boolean).map((u) => u.replace(/\/$/, ""));
    const docs = entries.filter((r) => r && r.resourceType === "Document");
    const doc =
      docs.find((r) => want.includes(String(r.url).replace(/\/$/, ""))) ||
      docs.find((r) => String(r.url).replace(/\/$/, "") === String(t.url).replace(/\/$/, "")) ||
      (docs.length === 1 ? docs[0] : null);
    m.docStatus = doc ? doc.status : null;
    m.docEntry = doc
      ? { url: doc.url, status: doc.status, contentType: (doc.responseHeaders || {})["Content-Type"] || null }
      : null;

    // 4. every same-origin script/stylesheet the DOCUMENT NAMES (from the DOM, not from the log):
    //    a named asset with no request is NO-REQUEST, which fails - never a silent pass.
    const origin = originOf(t.url);
    const seen = new Set();
    for (const rel of m.dom.named || []) {
      let abs;
      try {
        abs = new URL(rel, m.finalUrl || t.url).href;
      } catch (_) {
        continue;
      }
      if (originOf(abs) !== origin) {
        m.crossOriginSkipped += 1;
        continue;
      }
      if (seen.has(abs)) continue;
      seen.add(abs);
      const e = byUrl.get(abs) || byUrl.get(abs.replace(/#.*$/, ""));
      const kind = /\.css(\?|$)/i.test(abs) ? "stylesheet" : "script";
      m.assets.push({
        url: abs,
        path: pathOf(abs),
        kind,
        status: e ? e.status : null,
        originHeader: e && e.headers ? e.headers.Origin || null : null,
        requestId: e ? e.requestId || null : null,
      });
    }

    // 5. page errors: printed as a count. On a 403'd module script Chrome stays SILENT, which is
    //    exactly why the console is not the instrument - it is context for the numbers above.
    const er = await abJson(["--session", session, "--json", "errors"], Math.min(stepTimeout, left()));
    m.pageErrors = er.ok && er.json.data && Array.isArray(er.json.data.errors) ? er.json.data.errors.length : null;
  } finally {
    m.elapsedMs = Date.now() - started;
    // best effort: never let a stuck session hold a browser for the next run
    await ab(["--session", session, "close"], 15000).catch(() => {});
  }
  return m;
}

// ---------------------------------------------------------------- judging + printing

/*
  Every assertion, with the measured value beside it. `total` counts assertions evaluated so a
  green run can print how many it actually made (a green with a zero count is the defect).
*/
function judge(m) {
  const failures = [];
  let total = 0;

  total += 1;
  if (m.docStatus !== 200) {
    failures.push(
      `document status ${m.docStatus === null ? "NO-ENTRY (the browser logged no Document request)" : m.docStatus}` +
        ` (must be 200)`
    );
  }

  total += 1;
  if (m.assets.length === 0) {
    failures.push("the document names 0 same-origin script/stylesheet (must name at least 1)");
  }
  for (const a of m.assets) {
    total += 1;
    if (a.status !== 200) {
      const carried = a.originHeader ? ` [request carried Origin: ${a.originHeader}]` : "";
      failures.push(
        `${a.kind} ${a.path} answered ${a.status === null ? "NO-REQUEST (never fetched)" : a.status}` +
          ` (must be 200)${carried}`
      );
    }
  }

  total += 1;
  if (!m.dom || !m.dom.rootFound) {
    failures.push(`no ${MOUNT} element in the served document`);
  } else {
    total += 1;
    if (m.dom.children < 1) {
      failures.push(`${MOUNT} has ${m.dom.children} child element(s) (must be >= 1) - the app did not mount`);
    }
    total += 1;
    if (!m.dom.text) {
      failures.push(`${MOUNT} innerText is empty (must be non-empty)`);
    }
  }
  return { failures, total };
}

function assetList(m) {
  if (!m.assets.length) return "none";
  return m.assets.map((a) => `${a.path}=${a.status === null ? "NO-REQUEST" : a.status}`).join(", ");
}

function text60(s) {
  const t = String(s || "");
  return t.length > 60 ? t.slice(0, 60) + "..." : t;
}

function printTarget(m, verdict, failures) {
  const v = `[${verdict}]`.padEnd(17);
  console.log(
    `${v} ${m.id.padEnd(12)} ${m.url}\n` +
      `                  doc=${m.docStatus === null ? "NO-ENTRY" : m.docStatus}` +
      `  assets=${m.assets.length} (${assetList(m)})` +
      `  ${MOUNT}children=${m.dom ? m.dom.children : "n/a"}` +
      `  text="${text60(m.dom ? m.dom.text : "")}"` +
      `  pageErrors=${m.pageErrors === null ? "n/a" : m.pageErrors}` +
      `  waited=${m.waitedMs}ms` +
      `  title=${JSON.stringify(m.title)}` +
      (m.crossOriginSkipped ? `  crossOriginSkipped=${m.crossOriginSkipped}` : "")
  );
  for (const f of failures) console.log(`                  FAILED: ${m.id}: ${f}`);
}

// ---------------------------------------------------------------- the run

function parseArgs(argv) {
  const opts = {
    targets: [],
    replace: false,
    waitMs: 12000,
    stepTimeoutMs: 25000,
    targetTimeoutMs: 70000,
    json: false,
    selftest: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      const v = argv[++i];
      if (v === undefined) {
        console.error(`check-served-render: ${a} needs a value`);
        process.exit(2);
      }
      return v;
    };
    if (a === "--target") opts.targets.push({ id: `target-${opts.targets.length + 1}`, url: val() });
    else if (a === "--replace") opts.replace = true;
    else if (a === "--wait") opts.waitMs = Number(val());
    else if (a === "--timeout") opts.targetTimeoutMs = Number(val());
    else if (a === "--step-timeout") opts.stepTimeoutMs = Number(val());
    else if (a === "--json") opts.json = true;
    else if (a === "--selftest") opts.selftest = true;
    else if (a === "--help" || a === "-h") opts.help = true;
    else {
      // Fail loudly on an invocation this file did not understand: a plausible-looking flag must
      // never buy a green run.
      console.error(`check-served-render: unknown argument '${a}' (see --help)`);
      process.exit(2);
    }
  }
  for (const k of ["waitMs", "targetTimeoutMs", "stepTimeoutMs"]) {
    if (!Number.isFinite(opts[k]) || opts[k] <= 0) {
      console.error(`check-served-render: --${k} must be a positive number of milliseconds`);
      process.exit(2);
    }
  }
  return opts;
}

async function runTargets(targets, opts) {
  const rows = [];
  for (const t of targets) {
    let m;
    try {
      m = await measure(t, opts);
    } catch (e) {
      if (e instanceof CannotJudge) throw e;
      throw e;
    }
    const { failures, total } = m.dom ? judge(m) : { failures: [], total: 0 };
    if (m.error) failures.unshift(m.error);
    rows.push({ t, m, failures, total });
    if (opts.json) continue;

    if (m.cannotJudge) printTarget(m, "CANNOT-JUDGE", failures);
    else if (failures.length === 0) printTarget(m, "GREEN", []);
    else if (t.declaredRed) printTarget(m, "RED-KNOWN", failures);
    else printTarget(m, "RED", failures);

    if (t.declaredRed && !m.cannotJudge && failures.length === 0) {
      console.log(`                  STALE-DECLARATION: ${t.id} was declared RED and measured GREEN.`);
      console.log(`                  recorded at : ${t.declaredRed.pointer}`);
      console.log(`                  delete the declaration in scripts/check-served-render.js - an exception that no longer fires is a lie.`);
    }
    if (t.declaredRed && failures.length > 0) {
      console.log(`                  WHY THIS IS NOT A REGRESSION: ${t.declaredRed.reason}`);
      console.log(`                  recorded at : ${t.declaredRed.pointer}`);
      console.log(`                  ends when   : ${t.declaredRed.endsWhen}`);
    }
  }
  return rows;
}

function summarize(rows) {
  let green = 0,
    red = 0,
    declared = 0,
    stale = 0,
    cannot = 0,
    passed = 0,
    failed = 0,
    failedInDeclared = 0;
  for (const { t, m, failures, total } of rows) {
    passed += Math.max(0, total - failures.length);
    failed += failures.length;
    if (m.cannotJudge) cannot += 1;
    else if (failures.length === 0) green += 1;
    else if (t.declaredRed) {
      declared += 1;
      failedInDeclared += failures.length;
    } else red += 1;
    if (t.declaredRed && !m.cannotJudge && failures.length === 0) stale += 1;
  }
  return { green, red, declared, stale, cannot, passed, failed, failedInDeclared };
}

async function main(argv) {
  const opts = parseArgs(argv);

  if (opts.help) {
    console.log(
      "usage: node scripts/check-served-render.js [--target URL]... [--replace] [--wait MS]\n" +
        "                                          [--timeout MS] [--step-timeout MS] [--json] [--selftest]\n" +
        "default targets: " +
        DEFAULT_TARGETS.map((t) => `${t.id}=${t.url}`).join(", ")
    );
    return 0;
  }

  if (opts.selftest) return selftest(opts);

  let version = "unknown";
  try {
    const v = await pexec(BIN, ["--version"], { timeout: 15000, encoding: "utf8" });
    version = String(v.stdout || "").trim().split("\n")[0];
  } catch (_) {
    /* reported below as CANNOT-JUDGE by the first target */
  }

  const targets = opts.replace ? opts.targets : DEFAULT_TARGETS.concat(opts.targets);
  if (targets.length === 0) {
    console.error("check-served-render: no targets to measure (--replace with no --target)");
    return 2;
  }

  console.log(
    `served-render: ${targets.length} target(s), driver=${BIN} (${version}), ` +
      `mount=${MOUNT}, wait<=${opts.waitMs}ms, targetTimeout=${opts.targetTimeoutMs}ms`
  );

  let rows;
  try {
    rows = await runTargets(targets, opts);
  } catch (e) {
    if (e instanceof CannotJudge) {
      console.error(`CANNOT-JUDGE: ${e.message}`);
      console.error("nothing was measured - this is not a verdict about the product.");
      return 2;
    }
    throw e;
  }

  const s = summarize(rows);
  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          driver: BIN,
          version,
          targets: rows.map(({ t, m, failures, total }) => ({
            id: t.id,
            url: t.url,
            declaredRed: !!t.declaredRed,
            docStatus: m.docStatus,
            title: m.title,
            assets: m.assets.map((a) => ({ path: a.path, kind: a.kind, status: a.status })),
            rootChildren: m.dom ? m.dom.children : null,
            rootText: m.dom ? m.dom.text.slice(0, 60) : null,
            pageErrors: m.pageErrors,
            waitedMs: m.waitedMs,
            assertions: total,
            failures,
            cannotJudge: m.cannotJudge,
          })),
          summary: s,
        },
        null,
        2
      )
    );
  }

  console.log("");
  const counts =
    `${rows.length} target(s): ${s.green} GREEN, ${s.red} RED, ${s.declared} RED-KNOWN (declared), ` +
    `${s.stale} STALE-DECLARATION, ${s.cannot} CANNOT-JUDGE` +
    `  |  assertions: ${s.passed} passed, ${s.failed} failed` +
    (s.failedInDeclared ? ` (${s.failedInDeclared} of them inside declared-red targets)` : "");
  console.log(counts);

  // The LAST line repeats the counts on purpose: check-all shows one line of an OK check, and a
  // verdict with no numbers behind it is the "verdict instead of counts" defect this file answers to.
  const tail = `  [${rows.length} target(s), ${s.passed}/${s.passed + s.failed} assertions passed]`;
  if (s.cannot > 0) {
    console.log(`VERDICT: CANNOT-JUDGE - the instrument could not measure every target; this is not a green run.${tail} exit 2`);
    return 2;
  }
  if (s.red > 0) {
    const ids = rows.filter((r) => !r.t.declaredRed && r.failures.length && !r.m.cannotJudge).map((r) => r.t.id);
    console.log(`VERDICT: ${s.red} required target(s) RED -> ${ids.join(", ")}.${tail} exit 1`);
    return 1;
  }
  if (s.stale > 0) {
    console.log(`VERDICT: STALE-DECLARATION - a target declared RED measured GREEN; delete the declaration.${tail} exit 1`);
    return 1;
  }
  console.log(`VERDICT: every required target rendered; every declared-red target is still red.${tail} exit 0`);
  return 0;
}

// ---------------------------------------------------------------- selftest: prove it can redden

/*
  Three pages served from a throwaway server on 127.0.0.1, driven through the SAME code path as a
  real target. The instrument is only worth its green if each of these behaves as stated:
    /ok        mounts from a 200 script + 200 stylesheet          -> GREEN, 2 assets, 1 child
    /asset-403 names a script the server answers 403              -> RED naming that asset (the .cto.site shape)
    /no-mount  loads a 200 script that mounts nothing             -> RED on "#root has 0 child" (the mount
                                                                     assertion is load-bearing, not just the asset one)
  Exit 0 only if all three behave; exit 1 otherwise; exit 2 if the browser is unavailable.
*/
function selftestServer() {
  const pages = {
    "/ok": {
      type: "text/html",
      body:
        '<!doctype html><html><head><title>selftest ok</title><link rel="stylesheet" href="/ok.css"></head>' +
        '<body><div id="root"></div><script type="module" src="/ok.js"></script></body></html>',
    },
    "/ok.css": { type: "text/css", body: "#root{color:#111}" },
    "/ok.js": {
      type: "application/javascript",
      body:
        "const d=document.createElement('div');d.textContent='selftest mounted';" +
        "document.getElementById('root').appendChild(d);",
    },
    "/asset-403": {
      type: "text/html",
      body:
        '<!doctype html><html><head><title>selftest asset 403</title></head>' +
        '<body><div id="root"></div><script type="module" src="/blocked.js"></script></body></html>',
    },
    "/blocked.js": { type: "application/json", body: '{"error":"Forbidden"}', status: 403 },
    "/no-mount": {
      type: "text/html",
      body:
        '<!doctype html><html><head><title>selftest no mount</title></head>' +
        '<body><div id="root"></div><script type="module" src="/silent.js"></script></body></html>',
    },
    "/silent.js": { type: "application/javascript", body: "/* loads with 200 and mounts nothing */" },
  };
  const server = http.createServer((req, res) => {
    const p = (req.url || "/").split("?")[0];
    const page = pages[p];
    if (!page) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("not found");
      return;
    }
    res.writeHead(page.status || 200, { "Content-Type": page.type });
    res.end(page.body);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

async function selftest(opts) {
  const { server, port } = await selftestServer();
  const base = `http://127.0.0.1:${port}`;
  const cases = [
    { id: "ok", path: "/ok", expect: "GREEN", want: (r) => r.failures.length === 0 && r.m.assets.length === 2 && r.m.dom.children === 1 },
    {
      id: "asset-403",
      path: "/asset-403",
      expect: "RED",
      want: (r) => r.failures.some((f) => /blocked\.js/.test(f) && /403/.test(f)),
    },
    {
      id: "no-mount",
      path: "/no-mount",
      expect: "RED",
      want: (r) =>
        r.failures.some((f) => /child element\(s\)/.test(f)) &&
        !r.failures.some((f) => /asset|script \/silent/.test(f)),
    },
  ];
  let bad = 0;
  console.log(`selftest: 3 planted pages on ${base} (one browser, one session per page)`);
  try {
    for (const c of cases) {
      const t = { id: c.id, url: base + c.path };
      let m;
      try {
        m = await measure(t, opts);
      } catch (e) {
        if (e instanceof CannotJudge) {
          console.error(`CANNOT-JUDGE: ${e.message}`);
          return 2;
        }
        throw e;
      }
      const j = m.dom ? judge(m) : { failures: [], total: 0 };
      if (m.error) j.failures.unshift(m.error);
      const observed = j.failures.length === 0 ? "GREEN" : "RED";
      const ok = observed === c.expect && c.want({ m, failures: j.failures });
      if (!ok) bad += 1;
      printTarget(m, observed, j.failures);
      console.log(
        `                  selftest ${ok ? "ok " : "BAD"}: planted ${c.expect}, observed ${observed}` +
          ` (assertions ${j.total - j.failures.length}/${j.total} passed)`
      );
    }
  } finally {
    server.close();
  }
  console.log("");
  console.log(`selftest: ${cases.length - bad}/${cases.length} planted cases behaved as stated`);
  if (bad) {
    console.log("VERDICT: the instrument did NOT redden where it must - its green is worth nothing. exit 1");
    return 1;
  }
  console.log("VERDICT: the instrument reddens on an asset that is not 200 and on a page that mounts nothing. exit 0");
  return 0;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(`check-served-render: ${e && e.stack ? e.stack : e}`);
    process.exit(2);
  });
