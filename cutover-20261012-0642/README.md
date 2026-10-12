# Cutover #5 — 2026-10-12 06:41:58–06:42:25 UTC (deployed tree → `9d2182a`)

Run by the lead with `/home/team/shared/deploy-main.sh` (**md5 `e76df174731a3b8c306a00a3b0b949de`**, 15,105 B,
measured here) — `exit 0`, both clock times read off the run's own log filed beside this file. Filed by
**task `0e9baed7`**.
It is the fifth cutover, and **the third owed by code rather than by documents** — the count taken from the
records themselves: cutover #4's record calls itself *"the second one owed by code rather than by documents"*
(`cutover-20261012-0506/README.md`), so this one is the third. (An earlier draft of this line said "the second",
copied from that record without adjusting the ordinal; corrected here rather than left to flatter the run.)

**How to read this record.** Every figure is either the run's own output, marked ***the run's*** (quoted from the
files in this directory, never from memory), or re-derived by me after the movement, marked ***measured here***
with the read time. The two are never blended: the credentialed endpoint reads are the run's and the lead's, and
this record does not claim them as my own (rule 26 — a credentialed pass against the live product belongs on an
isolated rig, not here).

**Nothing in this directory was re-run.** The run's artifacts were copied out of `/tmp` unchanged, filenames
included: the run stamp `cutover-20261012-064158` stays in each name so no later run can be mistaken for this
one (rule 28), which is why they are longer than the 05:06 record's shortened names.

## 1. Why a cutover was owed — the team's test, applied

The test: diff the served tree against `origin/main` and count the files under `client/` or `server/`.
Both gates had cleared first — **#154** (the notice's v2.3 version lines) and **#155** (the KSA divergence
ruling), both merged.

| | |
|---|---|
| delta `b54412d..9d2182a`, files under `client/` or `server/` | **9** |
| the nine | `client/src/App.tsx`, `server/demo-seed.test.js`, `server/index.js`, `server/preboarding-items.js`, `server/preboarding-items.test.js`, `server/preboarding-workspace.test.js`, `server/privacy-notice.js`, `server/privacy-notice.test.js`, `server/schema.sql` |
| measured | `git diff --name-only b54412d 9d2182a -- client server` (*measured here*) |

**The plan said 8; the measurement says 9, and the plan has been corrected to the measurement.** This is the
second time the plan's own delta figure was stale by one — the figure is a reading, not a constant.

## 2. What the run did — from `cutover-20261012-064158-evidence.txt`, the run's own stdout

| Step | Result |
|---|---|
| 1. fetch + move the tree | `HEAD is now at 9d2182a` — "Merge pull request #156 from AhmadJ979/docs/tracker-round-40"; **tree content check OK** |
| 2. client build | **OK** — `tsc -b && vite build`, `dist/assets/index-Cc1GodRa.js` (vite prints `274.06 kB`, gzip 76.40 kB, built in 304ms) |
| 3. re-seed the demo dataset | **OK** — `FORCE CLEAR`, then all three pre-boarding cases re-created |
| 4. restart on port 3000 | pid **1610** stopped; **port 3000 was already ours** — `port 3000 held by the product server (pid 7917)` |
| 5. verify the live demo end to end | **all green** — battery quoted in §7 and §9 |
| 6. re-arm the watchdog | **watchdog pid 8053**, from the tree just deployed |

**The build line is rounded; the artifact is not.** Vite prints `274.06 kB`; both the file the build wrote and
the bytes served over HTTP measure **274,065**. Same rounding that produced the 270,981/270,982 error on
2026-10-09 — the builder's line is a summary, never the size.

**One line of step 4 is worth keeping, because it is the failure mode working correctly:** the paused case was
noticed late (`noticed 78.7h late`) and the run's own log says so — *"The flag itself is derived and read
correctly on the first read after restart; nothing is marked missed."* The timer records; it does not deliver
(`delivery: "none"`), so a host that was down cannot silently mark a flag missed.

## 3. The served asset — the run's read, and mine after the move

| | ***the run's*** | ***measured here*** (06:53:21Z) |
|---|---|---|
| page | `200 <title>Antum People</title>` | `200 <title>Antum People</title>` |
| asset | `assets/index-Cc1GodRa.js` | `assets/index-Cc1GodRa.js` |
| bytes | 274,065 | 274,065 (`stat` on the fetched file) |
| md5 | `9cdfbe5da81f6acf38fdb10de8a5e6fd` | `9cdfbe5da81f6acf38fdb10de8a5e6fd` |
| css | `assets/index-BLszozVg.css` | `assets/index-BLszozVg.css` |
| names our asset in the HTML | — | **1** hit |

**And it is the tree's own build, not merely a plausible bundle:** `<deploy>/client/dist/assets/index-Cc1GodRa.js`
is 274,065 bytes, md5 `9cdfbe5d…`, and `cmp` against the bytes fetched over HTTP is silent — byte-for-byte
(*measured here*). Previous served asset: `index-Dt2oLspq.js`, 270,962 B (`b54412d`), now superseded.

## 4. The notice resolution flipped — proven by the route's own answer

**The run's read of the endpoint (Bearer), verbatim from the evidence file:**

```
route                 : GET /api/compliance/notice -> 200
reported path         : /home/team/shared/probable-octo-sniffle/templates/privacy-notice.md   <-- the TREE's own
version field         : v2.3
served content md5    : 6004b0a5b23ac5aa68415da5e45ec2cd
repository file (main): 6004b0a5b23ac5aa68415da5e45ec2cd   -> IDENTICAL, and `diff` is empty
the stale host copy   : e011d3d6f18eb8175050917bb4fb08fe   -> NOT what comes back
```

**After the move, the same two byte-strings from my own session — no credential needed to compare files:**

| | md5 (*measured here*) |
|---|---|
| `origin/main:templates/privacy-notice.md` | `6004b0a5b23ac5aa68415da5e45ec2cd` |
| the deployed tree's `templates/privacy-notice.md` | `6004b0a5b23ac5aa68415da5e45ec2cd` |
| the retired host copy | `e011d3d6f18eb8175050917bb4fb08fe` |

The three version lines in the served text (*measured here*): `:5` `Template v2.3 — pilot-ready`,
`:6` `v2.3 (2026-10-12) — retention wording corrected: "statutory retention" → "retention period"`,
`:247` `Consent Version | v2.3 (2026-10-12)`.

## 5. The retired host copy — a move, not a delete, and nothing left at the path

**Ordering, as the disposition doc prescribed:** the retirement happened **at the cutover's own commit, after the
restart** — not before, and never by leaving text at the path (*measured here*, `/home/team/shared/templates`):

| | |
|---|---|
| `/home/team/shared/templates/privacy-notice.md` | **does not exist** — nothing was left at the retired path |
| `/home/team/shared/templates/retired/privacy-notice.md.retired-9d2182a` | present, 23,566 B, md5 `e011d3d6f18eb8175050917bb4fb08fe` — **bytes preserved, recoverable, not deleted** |
| the retired copy's own version line | `v2.2 (2026-09-17) — owner legal details applied` |
| the retired copy's retention row | still carries `Duration of employment + statutory retention` (1 hit) — i.e. the stale text is identifyable by its own bytes |

**The move is inert by measurement, not by argument.** After it: the route still answers (the run's read above),
the served content is still `6004b0a5…` (*measured here*), the live page is still `200` naming our asset
(*measured here*), and the only mentions of the old host path inside the deployed `server/` are **two comment
lines** — `server/privacy-notice.js:13` and `server/privacy-notice.test.js:4` (*measured here*) — with a test in
the suite that fails if a module reads that path again.

## 6. The KSA ruling (#155) executed on the live surface — *the run's*

```
GET /api/compliance/templates/ksa-employment-contract/demo-emp-sarah -> 200, 10,985 B
"never deducted from the EOSB" : 1        (the reviewed repository clause)
"Up to 50"                     : 0        (the retired 50% figure: absent from what clients get)
"Article 84"                   : 1   |   "Articles 74" (the unsourced range): 0
```

The host pack still carries the retired "50%" text — untouched, and that remains decision 19. What this record
establishes is only the **served** direction: clients get the repository copy.

## 7. The demo state after the re-seed — parsed out of the run's own capture

From `cutover-20261012-064158-pb-overview.json` (`GET /api/preboarding/overview`, jurisdiction `AE`),
parsed here:

| start | state | tone | `open_count` | hours to start | case | employee / workspace lines | notice v | recorded | ack |
|---|---|---|---|---|---|---|---|---|---|
| 2026-10-11 | `started` | rose | 21 | −30.7 | DEMO-03 | 7 / 14 | v2.3 | **true** | 4/4 |
| 2026-10-13 | `inside_48_hours` | amber | 21 | +17.3 | DEMO-02 | 7 / 14 | v2.3 | **true** | 4/4 |
| 2026-10-26 | `clear` | slate | 22 | +329.3 | DEMO-01 | 7 / 15 | v2.3 | **false** | 0/4 |

`distinct flag states: ['clear', 'inside_48_hours', 'started']` — three cases, three states, three tones.

**The roll-up tile of 1 is that `recorded: false` row, and the correspondence is exact:** the totals carry
`cases_notice_not_shown: 1`, and the single case whose notice is not recorded is the `clear` one, deliberately
left open so a walkthrough can record an acknowledgement live. Read as the ruled state, not as a defect.

The totals block, verbatim from the capture:

```json
{"cases": 3, "cases_notice_not_shown": 1, "cases_provisioned": 0, "cases_ready": 0, "items": 21,
 "items_outstanding": 21, "items_received": 0, "items_verified": 0, "workspace_lines": 43,
 "workspace_lines_open": 43}
```

**Two fields, never summed:** `items_outstanding` **21** and `workspace_lines` **43** measure different things.
The per-case arithmetic shows why: `open_count` = that case's employee-track lines (7 in every case) + its
workspace lines (**14 / 14 / 15** → 21 / 21 / 22), while the totals' `items_outstanding` is the 7-per-case
employee figure reading **21** across three cases. The third case carries `ws_finance_system_access`, which the
other two do not — that is the whole of the 14/14/15 difference.

**15(b) is live, not latent** — the seed's own line, from `cutover-20261012-064158-seed.log`: *"notice shown for
4/4 collectible (passport=Legal obligation, visa_or_entry_permit=Legal obligation, emirates_id=Legal obligation,
bank_details=Performance of the employment contract / contractual necessity)"*, and each case's
`notice_items_no_basis: 3` — the two certificates and the emergency contact, uncollectible with counsel's
question named.

## 8. The derivative path — the one way the retirement could have broken something, and it does not

`templates/build-html.js` resolves its input directory from **line 7: `const DIR = __dirname;`** — the repository's
own directory, not the host pack (*measured here*). That file's md5 is `206ff7ca5a6f00996ae3a4402b257a8b` both in
the deployed tree and via `git show origin/main:templates/build-html.js`, so it is the repository's file; it
contains **0** references to `/home/team/shared/templates`.

So regenerating the notice's HTML/PDF derivatives reads the repo, and retiring the host copy cannot affect it.
That regeneration is still the owner's act (the derivatives carry the removed "statutory retention" — decision
18); what this section settles is that the host retirement did not take the ability away.

## 9. Security re-measured after this cutover

***The run's battery***, from its own stdout: public status/title `200` · demo login token **201 chars** ·
bad-password path **401** · roster **200**, **13 employees**, first id `demo-emp-omar` · KSA offboarding
checklist **10 tasks** · consent-date field for the departing employee (`demo-emp-sarah`, 1, `2026-09-23`) ·
settlement statement rendered EOSB equal to the employee record (`19824.78` = `19824.78`, match `True`),
no unfilled `[brackets]`, net payable `32824.78`.

***The lead's own re-measure***, in `lead-verification.txt` §D: no token → `401`; bad password → `401`;
foreign `Origin` → `403`; demo token 201 chars; roster `200`, 13 employees.

***Measured here***, uncredentialed and so not a substitute for the two above: the public page is `200` and
names our asset. **Not re-measured by me and not claimed as mine:** the token length, the roster and the
settlement figures need the demo credential (rule 26).

## 10. The processes — and one thing worth naming rather than smoothing

***Measured here*** from `/proc` at 06:53Z: port 3000 is held by **pid 7917** (`node index.js`, cwd
`/home/team/shared/probable-octo-sniffle/server`, `/proc/7917` created **06:42:07** — inside the run's own
window, and the same pid the run's step 4 logged). The guard is **pid 8053** (`bash scripts/keep-alive.sh`),
whose log shows it arming at **06:42:19Z** against the tree just deployed.

**Two other `node index.js` processes are running and are not ours to touch:** pids 13197 and 15701, cwd
`/home/agent-product-designer/rig-final3/server` — the designer's isolated rigs. `lsof -ti :3000` returns
**7917 only**, so neither is on the port. Named here because a pid list that showed three `node index.js`
processes without that sentence would read as a hazard that does not exist.

## 11. The correction to #153 — the recorded lesson, turned on the check this plan itself prescribed

`host-copy-disposition.md` prescribed, as its post-move proof:

```
grep -c 'statutory retention' /tmp/served.md   # must be 0
```

On the served v2.3 text that count is **1, and the text is correct** — line 6's version note quotes the retired
wording *in order to record the correction*. A check demanding 0 therefore fails on correct text; the tempting
repair (loosen it) makes it stop checking anything. **A hit count answers *does this text appear*, never *in what
role*.**

Made **role-aware** in PR #153 (branch `fix/notice-numbering-and-host-retire`): the retired claim must not appear
in the retention *content* — the row carrying the period, EN and AR — while a mention inside the version note is
expected. Measured on the deployed text: 1 occurrence, line 6 (the version note); **0** in content; the EN row
reads `Duration of employment + retention period`; the AR row reads the plain form; the retired Arabic qualifier
`مدة الاحتفاظ القانونية` is absent (0 hits). The other three checks in that block hold as written (path inside the
tree's own `templates/`, served md5 == that file, retired md5 does not return).

## 12. What this record does not claim

- No step of the cutover was re-run; the run's files were copied, and their md5s are in §13.
- The credentialed reads (route envelope, KSA template, roster, token, settlement) are ***the run's*** and the
  lead's; the byte comparisons I add need no credential and are marked ***measured here***.
- **Two sections of my own first post-move pass printed nothing, and both were my mistake** — I joined the asset
  path twice (the HTML names `assets/index-…`, which I appended to a directory already ending in `/assets/`), and
  `ss -ltnp` yields no pid on this host. Both are corrected in `extra/post-move-checks-2026-10-12.txt`, with the
  cause stated beside the corrected read, rather than quietly re-run.
- The demo's amber window closes **2026-10-13 00:00 UTC**: the figures in §7 are this seed's, and any demo after
  that date needs its own re-seed and its own re-read.

## 13. The evidence in this directory, with hashes

Each file's own first line is its identity — a name is never the evidence (rule 28).

| file | bytes | md5 | its own identity |
|---|---|---|---|
| `cutover-20261012-064158-evidence.txt` | 3,480 | `b4ea8f6ed274d4134360d3bd92288edf` | `=== cutover 2026-10-12T06:41:58+00:00 ===` |
| `cutover-20261012-064158-build.log` | 442 | `e4e6bdcc0abee0c85a7c193629434ddf` | `> antum-people-client@0.0.0 build` |
| `cutover-20261012-064158-seed.log` | 1,885 | `5538b7a7252cc99a53e6e834199c5baf` | `--- Antum People Coherent Demo Seed v3.1 ---` |
| `cutover-20261012-064158-pb-overview.json` | 14,848 | `5e4a1c812bbe42befc8bcfd2135de0b9` | `{"jurisdiction": "AE", "cases": [...], "totals": {...}}` |
| `lead-verification.txt` | 5,907 | `6bcc945707fe70cb6e500423fd7545de` | `# Cutover 2026-10-12 06:41:58–06:42:25Z — the lead's own verification` |
| `extra/post-move-checks-2026-10-12.txt` | 6,924 | `776d3b6f8ac0f197ae69ff4d5aab1b3d` | `=== post-move checks, cutover #5 (9d2182a) — read at 2026-10-12T06:53:21Z ===` |

**One check on this table rather than a claim about it:** the md5 of `cutover-20261012-064158-evidence.txt` here
equals the md5 of the file at `/tmp` before it was copied, i.e. the copy is byte-identical to what the run wrote
(*measured here*). The same holds for the other three run-stamped files. `lead-verification.txt` carries the md5
the task description gave for it, so the copy matches the document the lead wrote.
