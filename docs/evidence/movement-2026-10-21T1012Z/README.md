# Movement — the host re-established after the machine replacement (2026-10-21T10:12Z)

Row `e1c27ae2`. The host this product serves from had been replaced: **the product was offline**, the
guard's lock named a dead PID, and the login-shell hook was gone. This movement re-established it from
the current tip, and this pack is its evidence.

**This pack is not the guard's acceptance.** The guard's acceptance is a separate run (row `57f2f3b8`,
queued to another member) — the movement that installs a fix cannot be its own acceptance test. What is
here is what the movement itself measured, and the state it left behind.

**No movement is owed by this PR**: it is markdown-only, and a `docs/` delta loads from no served path.
The movement it records already happened on the host and is recorded in `02-movement-run-stamped-evidence.txt`.

## The measured before-state (10:11Z, before anything was touched)

| Check | Reading |
|---|---|
| port 3000 | held by the platform's site dev server (`node .../site/node_modules/.bin/vite dev`, pid 534) |
| the product's own contract on 3000 | `/api/employees` -> **404** — no product behind the port |
| the public URL | HTTP 200 with `<title>My site</title>`, **naming no `assets/index-*.js`** — the placeholder, not the product |
| guard lock | names **27964**, `/proc/27964` gone — a corpse |
| login-shell hook | `/etc/profile.d/` holds **no** antum file |
| deployed tree | `58acdac` against `origin/main` = `7000a70`; `client/dist` intact (`e6ff5da3…`, `cb54e616…`) |
| installed host tools | `cutover-preflight.sh` still the pre-#277 body |

`06-host-probe-before-the-movement.txt` holds the raw reading; `05-preconditions-and-pre-movement-host-state.txt`
holds the deploy script's own preconditions (content gate, credential file, `bcryptjs`, `JWT_SECRET` and
`ENCRYPTION_KEY` present, origin remote, and the remote tip asked of the remote rather than read from a
local ref) plus the rollback copy of the bytes then on disk
(`/home/team/shared/rollback-58acdac-dist-20261021-101156`, md5s in `17-pre-movement-rollback-copy-md5s.txt`).

**An instrument note worth keeping:** `ss` does not exist on this host. Readings taken with it print an
empty result, which reads exactly like "nothing is listening" — that is how the site dev server holding
3000 went unseen in earlier notes. Every reading in this pack uses `lsof` and `/proc`.

## The movement (10:12:04Z -> 10:12:30Z)

`bash /home/team/shared/deploy-main.sh` (host copy `82ad3db161eb1c34`; its **body** md5 `2cddb29515ee4ce9d1ba8310088dc4e5`
is the merged `scripts/deploy-main.sh` blob — the size difference from the repo file is the provenance header).
Full transcript: `02-movement-run-stamped-evidence.txt` (the script's own run-stamped record) and
`18-movement-console-capture.txt` (my capture of the same stream; the two are **not** byte-identical — the
capture carries a `nohup` preamble — so both are kept and neither is claimed to be the other).

- **1.** fetch + reset to `FETCH_HEAD` -> `7000a70`, content gate OK.
- **1b.** host tooling refreshed **from the tree we moved to**: 7 of 7 copies installed from `7000a70abcd0`,
  including the merged `cutover-preflight.sh` (body md5 `158e4a9e16b94afec953f47e3e536004` = the `7000a70`
  blob) and the hook (body md5 `728bf2cce72b8c6f9a3cf257f3dfc070`).
- **2.** client build OK: `dist/assets/index-C9vf7pQB.js 277.79 kB`, `dist/assets/index-BK_EwcpZ.css 35.30 kB`
  (`03-client-build.log`). **The rebuild reproduced the served bytes byte-for-byte** — the same two names
  and sizes the URL was serving before the replacement.
- **3.** demo re-seed OK (`04-demo-reseed.log`).
- **4.** the placeholder pid 534 was stopped and the product server (pid 15458) claimed port 3000.
- **5.** live verification: public `200 <title>Antum People</title>`, login token 215 chars, bad password
  401, roster 13 employees, pre-boarding 3 cases / 21 items with the three expected flag states, KSA
  offboarding 10 tasks ending in "Final Settlement Payment", settlement rendered `19824.78` == the record.
- **6.** the guard re-armed from the deployed tree; deploy marker written and removed around the window.
- **6b.** the login-shell hook installed from the deploy copy's own revision (`7000a70`), read from `$0`.

## The after-state, measured (10:13Z)

| Check | Reading | Where |
|---|---|---|
| deployed tip | `7000a70abcd08f5932f69ef29be3086df1b30d9b`, tree clean | `07-…` |
| port 3000 | `node index.js`, cwd the deployed tree's `server/`; `/api/employees` -> **401** | `07-…` |
| public URL | HTTP 200 `<title>Antum People</title>`, naming `assets/index-C9vf7pQB.js` | `07-…` |
| served bytes vs dist | `index-C9vf7pQB.js` served md5 `e6ff5da3fd614ddcfe2c0beaa68164f4` = dist, 277,790 B; `index-BK_EwcpZ.css` served `cb54e6164a8e741ed807bac94577efcd` = dist, 35,306 B | `07-…` |
| the guard | lock names **15702**, alive, `bash scripts/keep-alive.sh`, cwd the deployed tree; **the only lock holder**; **exactly ONE role-loop** by argv position (not by `pgrep -f`) | `07-…` |
| the hook | installed, 7,522 B, body md5 `728bf2cce72b8c6f9a3cf257f3dfc070`, reads `deploy-in-progress` 3 times | `07-…` |
| the entry point | `python3 scripts/check-all.py --no-suite` -> **exit 0**, OK 4 / RED-KNOWN 1 (`doc-citations`) / SKIP-FLAGGED 7 | `09-…` |
| the guard role-vs-shape test, now that a live loop exists | under `--full`: **exit 0** — "BOTH count the real loop (pid 15702) — the true positive survives (anti-vacuous)" | `08-…` |

The last row closes a gap this row's earlier delivery had to report as CANNOT-JUDGE: the same instrument,
on the same tree, could not judge when no loop was armed. With the guard armed it judges green, and the
anti-vacuous control is what makes that green mean something.

## The merged preflight, on the repaired host

- **bare -> exit 1**, for exactly one legitimate reason: the recorded measurement (`d0422f4`,
  `index-BG0peuOK.js`) is **172 commits** behind the shipped tip and `client/` has changed, so the package
  refuses to state an after-state and names the conscious override (`10-…`). Every host check in that run
  PASSes: served bytes ARE this tree's dist file, the listener on 3000 is ours, the guard alive by lock and
  `/proc`, the hook PAIRED with the deploy that writes the marker, both retired routes absent from the
  shipped router with the live route as positive control.
- **with the whole record this host measured -> PASS, exit 0** (`11-…`): tip `7000a70abcd0`, asset
  `277790 B e6ff5da3…`, css `35306 B cb54e616…`. The run says in its own words that the record was
  supplied by this run, so its numbers stand or fall with that measurement and not with the gate.
- **control: `ANTUM_DIST_DIR` pointing at a directory with no build -> FAIL, exit 1** (`12-…`) — the
  served-vs-dist check reddens, and the listener it protects against is the foreign one.
- **control: a half-overridden record (tip alone) -> refused, exit 1** (`13-…`): "0/6 bundle field(s)
  supplied, missing: ASSET ASSET_BYTES ASSET_MD5 CSS CSS_BYTES CSS_MD5 — a tip is not a measurement".

### Two artefacts filed as wrong on purpose

Both are kept and named here rather than quietly dropped, per the standing practice for a pack's own
mistakes:

- `14-WRONG-ON-PURPOSE-ancestor-tip-control-did-NOT-redden.txt` — a control I chose badly. I forced the
  record's tip to `58acdac` expecting a refusal and got **exit 0**, correctly: `58acdac` is an ancestor of
  the shipped tip with `client/` unchanged, which the preflight is designed to accept (the bundle is still
  the one the record states). A badly chosen control is not a reddening control.
- `15-WRONG-ON-PURPOSE-record-md5-forced-wrong-did-NOT-redden.txt` — a real residual gap, found by trying.
  With `ANTUM_MEASURED_ASSET_MD5=0000…` and everything else correct, the run **passes**: the supplied
  record's numbers are **stated, never validated** against the bytes on disk. The check that guards the
  bytes (`12-…`) compares files, not the record's own md5, so a wrong number in the record reaches the
  after-state as a green. The harness has both values and could assert
  `md5(dist/<MEASURED_ASSET>) == MEASURED_ASSET_MD5`. **Flagged for a follow-up row; not fixed here**, and
  the movement's own record above is the measured one, cross-checked against the served bytes.

## What was left behind, in one paragraph

The product is serving the public URL from the deployed tree at `7000a70`; exactly one guard is armed
(lock pid 15702, sole holder); the login-shell hook is installed and paired with `7000a70`; the host tools
are installed from `7000a70` (backups in `/home/team/shared/host-tools-backup-20261021T101204Z`); a
rollback copy of the pre-movement bytes is at `/home/team/shared/rollback-58acdac-dist-20261021-101156`;
and the deploy marker is removed. **One user-visible consequence, measured after the movement:** the
platform's site dev server was evicted from port 3000 and came back on **3001** (pid 15480, answering
200), while the product holds 3000 — and the platform's site URLs resolve to 3000, so the site's public
URLs now serve the product. Decision 2's contention, observed rather than predicted. `df` on `/home`:
2.2 GB free (46%), unchanged.

## Reproducing any line here

Every reading above is a command in one of the transcripts, and each transcript names the script it ran
with its size and hash. The two that matter most:
`cd /home/team/shared/probable-octo-sniffle && python3 scripts/check-all.py --no-suite` (entry point) and
`bash /home/team/shared/cutover-preflight.sh` with the whole record supplied (preflight).

## Files

The manifest lists every file in this directory except `manifest.txt` itself — that one printed rule.
