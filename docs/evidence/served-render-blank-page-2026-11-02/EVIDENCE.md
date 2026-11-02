# The blank page nothing could see — 2026-11-02

**What happened.** The owner was given `https://b974147c03228029e277d1cbe6646fe6.cto.site/` and saw a
**blank page**. Every instrument the team owns was green at that moment: `check-all` **9 OK / 0 BROKEN**,
the server suite **404 pass / 0 fail (64 suites)**, the served bundle's md5 byte-identical to
`client/dist`, `/api/auth/me` answering its 401, and the same product rendering on
`http://127.0.0.1:3000/` and on `https://b974147c03228029e277d1cbe6646fe6.ctonew.app/`.

**Why nothing caught it.** Not one of those instruments loads a rendered screen. An uptime check would
not have caught it either: the document answers **HTTP 200**. The only instrument that catches this
asks a browser a different question — *did the app mount?*

This pack records the measurement, the mechanism, and the check that now reddens on it.

- Tree judged by the check runs: `cb16b40` (= `origin/main`, after #344 merged).
- The measurements below are of the **LIVE product** (the deployed tree serving port 3000 and the two
  platform hostnames). This pack and the check change **no served path**: the delta is one new script,
  one registry entry in `scripts/check-all.py`, and this pack.

---

## 1. The measurement

`node scripts/check-served-render.js` — three targets, one browser, headless, one session each.
Raw output: [`run-default.txt`](run-default.txt).

```
served-render: 3 target(s), driver=agent-browser (agent-browser 0.27.0), mount=#root, wait<=12000ms, targetTimeout=70000ms
[GREEN]           local        http://127.0.0.1:3000/
                  doc=200  assets=2 (/assets/index-vsGFc45L.js=200, /assets/index-CdmIUBt1.css=200)  #rootchildren=1  text="Antum People HR Onboarding/Offboarding Intelligence Platform..."  pageErrors=0  waited=992ms  title="Antum People"
[GREEN]           public-app   https://b974147c03228029e277d1cbe6646fe6.ctonew.app/
                  doc=200  assets=2 (/assets/index-vsGFc45L.js=200, /assets/index-CdmIUBt1.css=200)  #rootchildren=1  text="Antum People HR Onboarding/Offboarding Intelligence Platform..."  pageErrors=0  waited=1138ms  title="Antum People"
[RED-KNOWN]       public-site  https://b974147c03228029e277d1cbe6646fe6.cto.site/
                  doc=200  assets=2 (/assets/index-vsGFc45L.js=403, /assets/index-CdmIUBt1.css=403)  #rootchildren=0  text=""  pageErrors=0  waited=12539ms  title="Antum People"
                  FAILED: public-site: script /assets/index-vsGFc45L.js answered 403 (must be 200) [request carried Origin: https://b974147c03228029e277d1cbe6646fe6.cto.site]
                  FAILED: public-site: stylesheet /assets/index-CdmIUBt1.css answered 403 (must be 200) [request carried Origin: https://b974147c03228029e277d1cbe6646fe6.cto.site]
                  FAILED: public-site: #root has 0 child element(s) (must be >= 1) - the app did not mount
                  FAILED: public-site: #root innerText is empty (must be non-empty)

3 target(s): 2 GREEN, 0 RED, 1 RED-KNOWN (declared), 0 STALE-DECLARATION, 0 CANNOT-JUDGE  |  assertions: 17 passed, 4 failed (4 of them inside declared-red targets)
VERDICT: every required target rendered; every declared-red target is still red.  [3 target(s), 17/21 assertions passed] exit 0
```

Read the numbers, not the verdict:

| target | document | script | stylesheet | `#root` children | rendered text | page errors | waited |
|---|---|---|---|---|---|---|---|
| `127.0.0.1:3000` | 200 | 200 | 200 | **1** | 88 chars | 0 | 992 ms |
| `.ctonew.app` | 200 | 200 | 200 | **1** | 88 chars | 0 | 1138 ms |
| `.cto.site` | **200** | **403** | **403** | **0** | **empty** | **0** | 12539 ms |

Three things in that table are the whole finding:

1. The document is **200** on the broken host. A status check — ours or an uptime monitor's — reads green.
2. Both assets are **403**, and the browser's network log shows the request that got the 403 carried
   `Origin: https://…cto.site`.
3. The page error count is **0**. The console is *silent*: a 403'd module script is a network failure, not
   an uncaught exception, so "the console shows no errors" is not evidence the page worked — which is
   exactly why this check reads the network log and the DOM rather than the console.

The 12.5 s `waited` on the third line is the poll deadline, printed so a zero cannot be mistaken for a
reading taken before the page painted.

---

## 2. The mechanism: the edge 403s any request that carries `Origin`

Raw output: [`origin-matrix.txt`](origin-matrix.txt); the script that produced it:
[`origin-matrix.sh`](origin-matrix.sh). The asset names are **re-derived** from the document each run
(`grep -o 'assets/index-[A-Za-z0-9]*\.js'` against the local document), never typed in.

```
host   : https://b974147c03228029e277d1cbe6646fe6.cto.site
assets : /assets/index-vsGFc45L.js  /assets/index-CdmIUBt1.css   (re-derived from the document at http://127.0.0.1:3000)

METHOD PATH                               ORIGIN       STATUS BYTES    BODY
GET    /                                  origin=no    200    809      <!doctype html><html lang="en" dir="ltr">
GET    /                                  origin=yes   403    21       {"error":"Forbidden"}
GET    /favicon.svg                       origin=no    200    9522     <svg xmlns="http://www.w3.org/2000/svg" widt
GET    /favicon.svg                       origin=yes   403    21       {"error":"Forbidden"}
GET    /api/auth/me                       origin=no    401    41       {"error":"Authentication token required"}
GET    /api/auth/me                       origin=yes   403    21       {"error":"Forbidden"}
GET    /assets/index-vsGFc45L.js          origin=no    200    290272   var e=Object.create,t=Object.defineProperty,
GET    /assets/index-vsGFc45L.js          origin=yes   403    21       {"error":"Forbidden"}
GET    /assets/index-CdmIUBt1.css         origin=no    200    37757    /*! tailwindcss v4.3.1 | MIT License | https
GET    /assets/index-CdmIUBt1.css         origin=yes   403    21       {"error":"Forbidden"}
HEAD   /                                  origin=no    200    881      HTTP/2 200 date: Mon, 02 Nov 2026 18:48:45
HEAD   /                                  origin=yes   403    983      HTTP/2 403 date: Mon, 02 Nov 2026 18:48:45
POST   /api/login                         origin=no    500    33       {"error":"Internal Server Error"}
POST   /api/login                         origin=yes   403    21       {"error":"Forbidden"}

=== our Node server sets no access-control-* headers: grep -ci 'access-control' server/index.js
0
```

**The rule is global on that hostname, not asset-specific.** With an `Origin` header naming that host,
`/`, `/favicon.svg`, `/api/auth/me`, both assets, `HEAD /` and `POST /api/login` **all** answer
**403 `{"error":"Forbidden"}`** (21 bytes). Without it they answer 200/200/401/200/200/200/500 as normal.

Two corollaries, both measured:

- **The 403 is not ours.** `grep -ci 'access-control' server/index.js` returns **0** — our Node server
  emits no CORS headers at all, so the edge is injecting them and issuing the 403. It is outside this
  repository and is not ours to fix; this pack makes it visible, it does not route around it.
- **Why the same URL reads 200 from `curl` and 403 from the browser.** The document's *navigation* request
  carries no `Origin` (that is why `/` answers 200 and the page arrives); the requests its `<script
  type="module">` and `<link rel="stylesheet">` cause **do** carry one. That is measurable on a *working*
  host too, which is how it is shown here rather than argued: on `http://127.0.0.1:3000/` the browser's
  network log records `Origin: http://127.0.0.1:3000` on the request for `/assets/index-vsGFc45L.js`, and
  that request answers 200 — so the header is the browser's normal behaviour, and the edge's rejection of
  it is the difference. On `.cto.site` the identical request answers 403 with
  `Origin: https://b974147c03228029e277d1cbe6646fe6.cto.site` on it.
  **What this pack does not claim** is the edge's internal rule. A same-origin `fetch()` of the same asset
  from that page was measured returning **200** (by the lead, before this pack); we did not re-derive why,
  and nothing here depends on it. What is recorded is the reading that matters: the browser's own network
  log shows the document's two asset requests answering **403, with `Origin` on both**, on every run here.

**Observed, out of scope, flagged rather than fixed:** `POST /api/login` with a body of `{}` answers
**500** (`server/index.js:151` — the catch-all around `auth.comparePassword(undefined, …)`), where a
malformed body would more honestly be a 400. It is not this task's subject and nothing here depends on
it; it is recorded so the 500 in the matrix is not read as part of the 403 finding.

---

## 3. The check

`scripts/check-served-render.js` (new, Node, no new dependency). It drives **`agent-browser`** headless —
already installed on this host, `0.27.0` — with one isolated session per target, so two members running
it at once cannot share a page.

For each target it records, and prints on **one line**:

- the **document status**, taken from the browser's own network log (never from `curl`);
- the status of **every same-origin script/stylesheet the document NAMES** — read from the DOM
  (`script[src]`, `link[rel~=stylesheet][href]`), so a named asset the browser never fetched reads
  `NO-REQUEST` and **fails**; it is not a pass by omission;
- whether the app **mounted**: `#root` exists, has **≥ 1 child element**, and its trimmed `innerText` is
  **non-empty** (first 60 chars printed);
- the page-error count and how long it waited for the mount.

Exit codes follow the team's convention (#266): **0** every required target rendered; **1** a required
target failed, or a declaration went stale; **2** CANNOT-JUDGE (no browser on PATH, no target measured,
the probe could not be evaluated). `check-all` prints 2 as CANNOT-JUDGE and **fails the run**.

**Why `.cto.site` is a declared-red target inside the check, not `expect="known-red"` in `check-all`.**
A check-level known-red would make a real failure of the *other two* targets print `RED-KNOWN` and pass
the run — a false green, the exact defect class this file exists to end. So the discrimination is **per
target**: a declared-red target that fails prints `RED-KNOWN` with its failures, its reason, its pointer
and the condition that ends it, and does not fail the run; a declared-red target that **passes** prints
`STALE-DECLARATION` and **exits 1** — an exception that no longer fires is a lie about the tree.
`check-all` registers the check `expect="green"`, so the local process and the working public host are
hard gates.

**Wiring** (`scripts/check-all.py`):

- `served-render` — `mode="default"`, `expect="green"` → `node scripts/check-served-render.js`. It runs
  with the other default checks, because the failure it catches is the one the owner sees. Measured at
  **16.1 s** for the three targets.
- `served-render-controls` — `mode="full"` → `--selftest`, printed in the `[skip]` block with its own
  command when `--full` is not given, so its absence is named rather than silent.

It needs the network and a browser. When either is missing it **exits 2 and fails the run** — it never
skips quietly, which is the rule it is built to satisfy.

**Measured in the suite** (raw: [`check-all-full.txt`](check-all-full.txt), [`check-all-served-render.txt`](check-all-served-render.txt)):

- `python3 scripts/check-all.py` at this tree: **10 OK / 0 BROKEN / 9 SKIP-FLAGGED, exit 0**, with
  `[OK] served-render tree=cb16b40 exit=0 16.4s`, and `[SKIP-FLAGGED] served-render-controls` printed in
  the skip block **with its own command** (`--full`). The server suite in the same run: **tests 404,
  suites 64, pass 404, fail 0** — adding the check broke nothing.
- `python3 scripts/check-all.py --only served-render`: 1 check run, 0 skipped, exit 0.
- The last line of a green run repeats the counts (`… [3 target(s), 17/21 assertions passed] exit 0`),
  because `check-all` prints only one line of an OK check and a verdict with no numbers behind it is the
  defect this instrument exists to answer.

---

## 4. The proof it can redden

A check that cannot redden proves nothing, and a red that depends on a platform edge we cannot control
proves it only once. So the file carries **`--selftest`**: three planted pages on a throwaway
`127.0.0.1` server, driven through the **same** code path as a real target. Raw output:
[`run-selftest.txt`](run-selftest.txt).

```
selftest: 3 planted pages on http://127.0.0.1:37261 (one browser, one session per page)
[GREEN]           ok           http://127.0.0.1:37261/ok
                  doc=200  assets=2 (/ok.js=200, /ok.css=200)  #rootchildren=1  text="selftest mounted"  pageErrors=0  waited=824ms  title="selftest ok"
                  selftest ok : planted GREEN, observed GREEN (assertions 7/7 passed)
[RED]             asset-403    http://127.0.0.1:37261/asset-403
                  doc=200  assets=1 (/blocked.js=403)  #rootchildren=0  text=""  pageErrors=0  waited=12450ms  title="selftest asset 403"
                  FAILED: asset-403: script /blocked.js answered 403 (must be 200) [request carried Origin: http://127.0.0.1:37261]
                  FAILED: asset-403: #root has 0 child element(s) (must be >= 1) - the app did not mount
                  FAILED: asset-403: #root innerText is empty (must be non-empty)
                  selftest ok : planted RED, observed RED (assertions 3/6 passed)
[RED]             no-mount     http://127.0.0.1:37261/no-mount
                  doc=200  assets=1 (/silent.js=200)  #rootchildren=0  text=""  pageErrors=0  waited=12066ms  title="selftest no mount"
                  FAILED: no-mount: #root has 0 child element(s) (must be >= 1) - the app did not mount
                  FAILED: no-mount: #root innerText is empty (must be non-empty)
                  selftest ok : planted RED, observed RED (assertions 4/6 passed)

selftest: 3/3 planted cases behaved as stated
VERDICT: the instrument reddens on an asset that is not 200 and on a page that mounts nothing. exit 0
```

The third plant is the one that matters: **every asset answers 200 and the page still fails**, because
the script mounts nothing. That is the assertion `#root` children and text are load-bearing for, and it
is why an asset-status check alone would not be enough.

## 5. The hard RED, on the live host

The declared-red target above is not a demonstration that the check *fails a run*; it is a demonstration
that it *measures* the failure. The same URL as a **required** target — the documented way to reproduce a
hard red — exits **1** and names every failed assertion. Raw output: [`run-red.txt`](run-red.txt).

```
served-render: 1 target(s), driver=agent-browser (agent-browser 0.27.0), mount=#root, wait<=12000ms, targetTimeout=70000ms
[RED]             target-1     https://b974147c03228029e277d1cbe6646fe6.cto.site/
                  doc=200  assets=2 (/assets/index-vsGFc45L.js=403, /assets/index-CdmIUBt1.css=403)  #rootchildren=0  text=""  pageErrors=0  waited=12509ms  title="Antum People"
                  FAILED: target-1: script /assets/index-vsGFc45L.js answered 403 (must be 200) [request carried Origin: https://b974147c03228029e277d1cbe6646fe6.cto.site]
                  FAILED: target-1: stylesheet /assets/index-CdmIUBt1.css answered 403 (must be 200) [request carried Origin: https://b974147c03228029e277d1cbe6646fe6.cto.site]
                  FAILED: target-1: #root has 0 child element(s) (must be >= 1) - the app did not mount
                  FAILED: target-1: #root innerText is empty (must be non-empty)

1 target(s): 0 GREEN, 1 RED, 0 RED-KNOWN (declared), 0 STALE-DECLARATION, 0 CANNOT-JUDGE  |  assertions: 3 passed, 4 failed
VERDICT: 1 required target(s) RED -> target-1.  [1 target(s), 3/7 assertions passed] exit 1
```

---

## 6. Reproduce

```bash
cd /home/team/shared/probable-octo-sniffle

# the three targets: local process + both public hostnames (exit 0 today)
node scripts/check-served-render.js

# the hard red: the blank hostname as a REQUIRED target (exit 1 today)
node scripts/check-served-render.js --replace --target "https://b974147c03228029e277d1cbe6646fe6.cto.site/"

# the instrument's own controls (exit 0; plants a 403 asset and a 200-that-mounts-nothing)
node scripts/check-served-render.js --selftest

# the same, through the entry point
python3 scripts/check-all.py --only served-render
python3 scripts/check-all.py --full          # includes served-render-controls

# the edge's Origin rule, end to end
bash docs/evidence/served-render-blank-page-2026-11-02/origin-matrix.sh

# other targets / other trees
node scripts/check-served-render.js --target http://127.0.0.1:3001/     # adds a required target
node scripts/check-served-render.js --replace --target <url>            # ONLY the given targets
node scripts/check-served-render.js --json                              # the same measurements as JSON
```

An unknown flag exits **2** with the flag named — a plausible-looking invocation cannot buy a green run.

---

## 7. What this check cannot see

Stated so a green run never implies more than it measured:

- **whether the rendered text is CORRECT** — it asserts non-empty, not truthful;
- anything **behind a sign-in**: it never authenticates (rule 26: a credentialed pass runs on a rig of its
  own, never the live product);
- a page that mounts and **then blanks itself** after the measurement window;
- whether the stylesheet is **applied** (status 200, not cascade);
- any target it was not given — the checked set is the three above, printed on every run;
- it is a **check, not a monitor**: nothing runs it while no member is awake.

## 8. Files

| file | what it is |
|---|---|
| `scripts/check-served-render.js` | the check, its declared-red target, and `--selftest` |
| `scripts/check-all.py` | registry entries `served-render` (default) and `served-render-controls` (`--full`) |
| `EVIDENCE.md` | this note |
| `run-default.txt` | the three-target run, raw |
| `run-red.txt` | the hard-red run against the blank hostname, raw |
| `run-selftest.txt` | the three planted controls, raw |
| `origin-matrix.txt` | the `Origin` header matrix, raw |
| `origin-matrix.sh` | the script that produced it |
| `check-all-served-render.txt` | `check-all --only served-render`, raw |
| `check-all-full.txt` | the whole `check-all` run at this tree (10 OK / 0 BROKEN, suite 404/0), raw |

---

## ANNOTATION, 2026-11-02 (later the same day) — section 2's attribution to the edge is REFUTED

**Everything this pack measured stands. Its conclusion in section 2 does not.** The 403 that blanked
`.cto.site` was not the platform edge's: it was **this repository's own CORS middleware** in
`server/index.js`, refusing the document's own `Origin`.

**How that was established.** `strace` was attached read-only to the live product and the bytes it
read from its socket were captured for a request to the owner's hostname:

    GET /assets/index-vsGFc45L.js?probe=strace1 HTTP/1.1
    Host: ip-10-110-75-104.us-west-2.prod.aws.beamlit.net
    X-Forwarded-Host: c92e15e4f97c516d8c977075708bb720.preview.bl.run
    X-Forwarded-Proto: https
    Origin: https://b974147c03228029e277d1cbe6646fe6.cto.site

The edge rewrites `Host` to its own internal name, so the `Origin` host never equals
`req.headers.host`, and the middleware fell through to its deliberate 403. The request had reached
our process all along: `server/server.log` carries the matching
`[cors] refused Origin https://...cto.site` lines, and the origin's own 403 is byte-identical to the
public one — same `Content-Length: 21`, same `ETag: W/"15-TLNzmZqKxaTuFdX/dVWWPBu44/c"`.

**Why section 2 read as the edge.** The edge *does* decorate the response: it injects
`access-control-allow-origin`, `access-control-allow-credentials: true`,
`access-control-expose-headers`, `access-control-allow-methods/headers` and
`x-cache: Error from cloudfront`. Our server sets no `access-control-*` header at all and
`credentials: false`, so those headers could not have come from us — true, and it is what was read
as "the edge is injecting them and issuing the 403". The body and its `ETag` were the discriminator,
and this pack did not compare them against the origin's own response.

**Corrected the same day:** the same-origin test now compares the `Origin` host against `Host` *and*
every entry of `X-Forwarded-Host`, and the platform's second public hostname is named in the
allowlist — the forwarded host turns out to be the edge's own preview name, **identical for both
public hostnames**, so it cannot identify the public host on its own. The declared-red target this
pack introduced for `.cto.site` was withdrawn with that fix.

**The raw transcripts in this pack are unchanged.** They record what the surface said on that tree
at that moment, and they are still accurate measurements; only the cause attributed to them is
corrected here.
