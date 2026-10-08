# Evidence — demo-walkthrough rewrite against the surface that has the 48-hour chip

Everything here was produced on a **scratch instance of `origin/main`**, own port (4716), own
database, own throwaway credential. The live deployment was never touched: port 3000 answered **200**
before the pass and after every pass, and the rig was torn down when the pass ended (below).

## Provenance (WORKFLOW rules 12, 14 and 19)

| What | Value |
|---|---|
| Base commit | `origin/main` = `404b29d` — the merge of PR #79 (`feat/p2-3-pre-reading-package`) |
| Rig tree | `git worktree add --detach ~/scratch-rig origin/main` — the app tree the pass ran on |
| Merge result | this branch's only changes are `demo-walkthrough-script.md` and this directory (see `git diff --name-only origin/main..HEAD`), so **every file the walkthrough reads is byte-identical to the rig's** — no client or server file moves in this PR |
| Build | `npx vite build` in the rig's `client/` → exit 0 (`01-rig-and-provenance.txt`, tail of the build log) |
| Live deployment | untouched; port 3000 = 200 before and after; **no** write to the live DB, no live credential used |
| Teardown | the rig's node process was killed by its `/proc/<pid>/cwd` (pid 8406, cwd `…/scratch-rig/server`), then `git worktree remove --force`; **port 4716 listeners: 0**, live port 3000: 200, scratch DB deleted |

## What each file shows

1. **`01-rig-and-provenance.txt`** — the setup transcript: the date and `origin/main` at the time, the
   seed's own log of the three cases it created (with their offsets and states), the client build, and
   the boot checks (listener, cwd, 401 without a token, port 3000 still 200).
2. **`02-http-pass.txt`** — the read-only HTTP pass, then the base-segment readings:
   * the HR roll-up at `?jurisdiction=AE`: **3 cases** (totals `21 outstanding / 0 verified / 3 without
     consent`), each row's `flag.state`, `flag.chip`, `flag.headline`, `flag.body`, `days_to_start`,
     `hours_to_start`, `boundary_hours` + `boundary_inclusive`, and **the row line each case must print**
     under the one-distance rule (`started 1 d ago` / `15.4 h before 00:00 on the start date` / `14 d`);
   * the case list filtered **and** unfiltered (both 3 — all three seeded cases are UAE);
   * the pre-reading package per case: **9 items, 0 required acknowledged of 2, `delivery_channel: none`**,
     with the module's own delivery and reading labels quoted in full;
   * the dashboard at `?jurisdiction=AE` and unfiltered (7 vs 11 headcount — the reason the script says
     to leave the toggle alone);
   * the roster (8 UAE records: 5 active, 1 onboarding, 1 offboarding, 1 terminated);
   * the settlement document, which still carries the header **`Jurisdiction: UAE / KSA`** and the
     placeholder employer;
   * the flag watcher snapshot: `delivery: "none"`, two boundaries recorded, both marked late because
     they fell before the process started;
   * four **401** probes without a token;
   * a scan of every Layer 2 payload for `"sent"`, `emailed`, `notified`, `"delivered":true`,
     `"read":true`, `reminder sent`, `alerted` → **all absent**.
3. **`03-dom-rollup-copy.txt`** — the rendered page's own `innerText` in the collapsed state.
4. **`04-dom-rows-and-opened-row.txt`** — the row lines and chips as rendered, and the full text of an
   opened row: the employee track, the consent gate, the reminder control and its honest copy, and the
   pre-reading package strip with `Record acknowledgement` on each of its nine rows.
5. **`05-live-public-url-strings.txt`** — the anonymous fetch of the published URL and its bundle, with
   the string-count comparison against the rig's bundle, and an explicit note about what a bundle
   comparison **cannot** show (the chip wording is server-side).
6. **`06-screenshots.md`** — the four screenshots, what each shows, and the duplicate/dead-end shots
   from earlier attempts recorded rather than hidden.

## The one correction this task carries

The task description says *"the pre-reading package is not built yet (P2-3 in progress)"*. By the time
this pass ran, **P2-3 had merged**: `origin/main` was `404b29d`, the merge of PR #79
(`feat/p2-3-pre-reading-package`), and the package and its acknowledgement record were in the served
build — nine items on every case, the JD and NDA carrying a required acknowledgement, and the
`Record acknowledgement` control present. The script was therefore written against the **built**
package, and the honest limit recorded there is a different one: the package is **built but not
published**, it has **no delivery channel and no hire-facing portal**, and an acknowledgement is an
in-product record, **not** an electronic signature (an e-signature method is refused by name).

## What this evidence does not do

* It does **not** log in to the public URL. The demo credential is lead-managed (rule 10), so the public
  surface is represented here only by anonymous reads: root 200, title, and the bundle's own strings.
* It does **not** claim the live server's commit. The plan records the live deployment at `5ed731e`; I
  read the published *client* bundle, which is a different thing, and the script says so.
* It does **not** re-open the Compliance Center line `Basic Salary (UAE Rule)` — the script marks that
  one as carried from the 2026-10-06 walk, with the rendering condition cited, rather than passing it
  off as a fresh reading.
