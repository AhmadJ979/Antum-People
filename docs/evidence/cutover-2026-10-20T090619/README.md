# Cutover 2026-10-20T09:06:19Z — `ca681dd` → `ea6a531`, and the bundle a browser loads moves for the second time today

Filed by the **program manager**, 2026-10-20, for task `1e517b2d-292a-4b4f-b32d-df0b76a43e43` (Round 53).
**Docs + evidence only.** No application code is in this commit; no movement is owed by it.

## What the run's own log says (these files, not a summary)

`movement-241.log` is the wrapper's own copy of the run. The run: `2026-10-20T09:06:19Z → 09:07:15Z`
(**56 s**, run stamp **20261020-090619**), tree **`ca681dd` → `ea6a531`** (#243's merge result).

* **7 of 7 host tools installed/refreshed from `ea6a531`**; backups in `/home/team/shared/host-tools-backup-20261020T090619Z`;
  its **second** install run at 09:07:15 reports *nothing to do — all 7 copies already match this source*.
* **client build OK** — `dist/assets/index-B9iywLcl.js 276.20 kB`, `dist/assets/index-CK8SfGWm.css 35.77 kB`.
* **seed OK** — the demo dataset re-seeded against the product database inside the run.
* **server restarted** (stopping pid 25778); **watchdog re-armed pid 25958**.
* **The forced guard-kill warning REPEATED — instance three of 2026-10-20.** `movement-241.log` line 85 reads
  `WARNING: old watchdog still alive after 30s — forcing it down`, between the deploy marker (line 84) and the incoming
  guard's pid (line 86, `watchdog pid: 25958`). The three instances of the day are **06:51, 08:50 and 09:07**, each
  against a guard armed by the previous movement. It is filed on its own row as a defect under investigation; **this
  pack states the instance and its line numbers, not a cause**, because these logs name none.

## The bundle, before and after — measured off the public URL

| | before (08:50 cutover) | after (this movement) |
|---|---|---|
| JS | `assets/index-DyH3JYJh.js` — 274,249 B — md5 `7cb512fb81f0687fa35723ca049a939a` | **`assets/index-B9iywLcl.js` — 276,206 B — md5 `fd270c84cb2b34a2df5372a6e93505c8`** |
| CSS | `assets/index-pNSrK3wr.css` — 35,365 B — md5 `eda548202468a7e0293053981037a594` | **`assets/index-CK8SfGWm.css` — 35,775 B — md5 `8ec48273f4bd7e4f37c55e2cc6ae2f1d`** |

**Both** assets moved, because the delta that moved them is `client/` (#241, the session-vs-refusal fix — the first
`client/` delta of the day and the reason this movement exists). The morning's `assets/index-BG0peuOK.js`
(274,242 B, md5 `f65f15c109e76e86cd8b8abe7102f748`) is two supersessions back.
**Verified by `cmp`, not by hash alone:** each asset fetched off the public URL is byte-identical to the served tree's
own `client/dist/assets/` file. `live-r53.out` holds the fetch; `observer-2026-10-20T0914.txt` holds the same identity
asserted by the observer.

## What I measured, and where it is (all of it mine, dated)

* **`live-r53.out`** — 2026-10-20T09:16:11Z. `GET /` → 200, 799 B. No token → **401** on `/api/employees`, `/api/users`,
  `/api/compliance/notice`. Login → a **215-character** token whose payload reads `access_role: "hr_admin"`; the login
  body is filed **with its token replaced by `<redacted>`** (decision 13: the demo credential stays out of shared
  documents, so it is read from its own file, used, and never echoed). Bad password → **401**. With the token → **200**
  on all three. A **fabricated token → 403 `{"error":"Invalid or expired token"}`** — the dead-session shape the shipped
  client rule ends a session on. **A refusal (403, empty body) is still not producible live**: the only account is
  `hr_admin` and holds all 17 resources, so that branch rests on the module's tests.
  **This file carries its own failure:** the inline Python that was meant to print the per-case flag state died on
  `TypeError: unhashable type: 'dict'` (the `flag` field is an object, not a string). The traceback is left in place;
  the corrected extraction is filed beside it as **`pb-states-r53.txt`** — `started` (start 2026-10-19, tone rose,
  21 open), `inside_48_hours` (2026-10-21, amber, 21), `clear` (2026-11-03, slate, 22).
* **`observer-2026-10-20T0914.txt`** — `scripts/observe-serve-pair.sh` run **once** by hand, 2026-10-20T09:14:28Z:
  **`PAIR HOLDS (exit 0)`**, 2 assets derived from the served tree's build, both equal to it; **LIVENESS: the previous
  recorded run was 08:55:58Z → PASS, 18 minutes earlier**; `--status`: 3 runs recorded, **no alert file, no lock file —
  no loop is armed**. **This is a point, not a rate**; no availability figure may be derived from it. The bytes are the
  run's own stdout, extracted verbatim from my session log (no second run was made to tidy anything).
* **`observer-record-line-2026-10-20T0914.jsonl`** — the observer's own record line for that run, copied from
  `/home/team/shared/observer/runs.jsonl`.
* **`suite-summary-r53.txt` + `suite-server-ea6a531-deployed-install.txt`** — `node --test`, node v22.23.3, two scratch
  worktrees, each run **twice**: **with** the deployed install symlinked, the served tree `ea6a531` reads
  **254 / 51 / 254 / 0, rc 0** and `main` `8ec9f69` reads **255 / 51 / 255 / 0, rc 0** (the +1 is #245's test-only arm);
  **without** any install the same trees read **170 / 35 / 168 / 2** and **171 / 35 / 169 / 2, rc 1**, the two red files
  red for `Cannot find module 'jsonwebtoken'` / `'uuid'`. Client, both trees: **16 / 3 / 16 / 0**.
  **The install is part of the figure**; both readings are filed so a reader's re-run cannot look like a red tree this
  pack calls green.
* **`board-and-plan-reads-r53.txt`** — the `team-db` reads behind the round's board paragraph (the four rows' statuses
  and timestamps: one `updated_at`, 2026-10-20 09:07:43Z) and the plan's own numbering in `config` (Revision 130,
  19,973 characters, items 25/26/27).
* **`checker-r53-green.txt` / `checker-r53-controls.txt`** — `scripts/check-index-ids.py` on the edited index: **rc 0**,
  every quoted id resolving. The controls took **three attempts** and the transcript is filed as it happened: falsifying
  a 7-character git short and an 8-hex prefix inside a 64-character digest both left it **green** (outside its coverage);
  falsifying the standalone short id `fdef095a` → `fdef095b` turned it **red** (`NEITHER (typos)`, rc 1) on a copy proved
  by `cmp` to differ. The copy was a throwaway inside the repository and was removed afterwards.

## MD5s, derived from the files in this directory

| file | bytes | md5 |
|---|---|---|
| `README.md` | 6437 | `35761130be29310bc3494d44228d7ab6` |
| `board-and-plan-reads-r53.txt` | 4351 | `d0722484dd9bcdf87a8fcd3df78907df` |
| `checker-r53-controls.txt` | 1431 | `aa7584f76fb22d4f4a88fd052b439a2f` |
| `checker-r53-green.txt` | 6403 | `c35310e57e80d9ae269ac91bf1962365` |
| `cutover-20261020-090619-build.log` | 442 | `6fdcd59b2c0eddc9726ce2a3d68bebc8` |
| `cutover-20261020-090619-evidence.txt` | 7644 | `0c4fea92afc909ba6ea2d342c343d935` |
| `cutover-20261020-090619-pb-overview.json` | 14860 | `e778ab497eba2487b4c1f9a079c991be` |
| `cutover-20261020-090619-seed.log` | 1948 | `89a5d8661ad0a68009ee770d34b18600` |
| `live-r53.out` | 2862 | `96575f0e68a5d91ca0ed5eda4e46f05e` |
| `movement-241.log` | 7666 | `03fe8a8db700fb20ebedd8ac0350016b` |
| `observer-2026-10-20T0914.txt` | 2153 | `70f179d7e6bd3c4c930b4a0c1f2339cc` |
| `observer-record-line-2026-10-20T0914.jsonl` | 487 | `257076929fb178b4028f2aab86ea3a18` |
| `pb-states-r53.txt` | 542 | `a2d1efd0685f66970596ecb5d5af8cf5` |
| `suite-server-ea6a531-deployed-install.txt` | 71019 | `e2dc43fa661dcbc9ae5b11d976a6c69e` |
| `suite-summary-r53.txt` | 1739 | `6c38df795ee9b8cfc46aee080470dc59` |

**Every artifact above that came from `/tmp` was copied, not re-typeset**, and each one's md5 was compared to its
original with `cmp` before staging and again against the committed blob after the commit (the round's own read-back).

## What is NOT in this pack, stated rather than implied

* **No second run of the deploy script**, and none of the movement is mine — the tree, the bundle, the processes and the
  guard were read, not started. A second run would be different bytes.
* **No write to the live database** and no host write of any kind.
* **No credential**: the demo password is read from its own file and never appears in any artifact, and the login body's
  token is `<redacted>`.
* **No loop armed**, and the observer's single line is a dated point.
