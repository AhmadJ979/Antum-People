# Off-host availability check for the public URL

*Added 2026-10-28. Workflow: [`.github/workflows/uptime.yml`](../.github/workflows/uptime.yml).*
*This is the GitHub-Actions shape of owner decision 5's fallback. The uptime-service shape (UptimeRobot
keyword monitors, §1 of `decision-5-monitor-spec-and-canary-2026-10-26.md`) is not available: it needs the
owner's account and `UPTIME_API_KEY`, which do not exist. No secret other than the workflow's own
`GITHUB_TOKEN` is used, and none may be added — nothing behind the login gate belongs in a public repo.*

## What it is

A probe of the public URL that runs **on a GitHub-hosted runner**, every 5 minutes. Off-host is the whole
point: on 2026-10-28 a boot left the platform's site preview holding port 3000, so the public URL answered
**HTTP 200 with a placeholder page** (`<title>My site</title>`) for minutes. Nothing off this host noticed;
a member found it by luck. A check that lives on the host dies with the thing it observes and **nothing
notices its death** — that is a record, not a monitor.

Triggers:

| trigger | what it is for |
| --- | --- |
| `schedule: '*/5 * * * *'` | the check itself — GitHub's shortest supported interval |
| `workflow_dispatch` (optional `url`) | a hand-run, e.g. pointing the probe somewhere else on purpose |
| `push` on `paths: ['.github/workflows/uptime.yml']` | a commit touching this file produces a run — the **only** way to produce a pre-merge canary, because `workflow_dispatch` exists only on the default branch |

Nothing else triggers it: ordinary pushes, merges and other files produce no run.

## The three assertions — all required, and **HTTP 200 alone is NOT a pass**

| # | assertion | why it is there |
| --- | --- | --- |
| A | HTTP status is **200** | a 5xx, a 000 (no answer) or a 404 is a failure |
| B | the body contains **`<title>Antum People</title>`** | the platform's placeholder answers **200** with `<title>My site</title>` — this is the exact false green the check exists to prevent |
| C | the body names an asset matching **`assets/index-[A-Za-z0-9_-]+\.js`** | the placeholder names no bundle (it serves `/src/…` from a dev server). The **pattern** is asserted, never a hash: a fixed hash would redden on every client build that ships a new bundle |

A failing run never leaves the reader guessing: each attempt prints the **HTTP status seen**, the **title
seen** (or `no <title>`) and the **asset reference seen** (or `none`), then names **which assertion failed**.
The same table goes to the run's summary page.

**Robustness, so that one blip does not page anyone:** each attempt has a 15 s timeout, there are 3 attempts
spaced 20 s, and the run only fails after all three. The probe's own worst case is 3 × (15 s + 20 s) = **105 s**;
the job also carries `timeout-minutes: 10` as a backstop, so a hang **ends as a FAILED run** instead of sitting
until the runner's 6-hour ceiling. A long pause is deliberately **not** absorbed by the retries — those alerts
are the reading we want.

## Alerting: one issue, then the same issue

- **On failure** the workflow opens **one** issue on this repository, labelled `uptime-alert` (the job creates
  the label if it is missing), titled `[uptime] FAIL <UTC time> — <the failing assertion>`.
- **If an `uptime-alert` issue is already open** — matched by label **or** by the `[uptime]` title prefix, so a
  missing label cannot defeat it — the workflow **comments** on it instead of opening another. A 40-minute
  outage at a 5-minute cadence is therefore **one issue with up to eight comments**, not eight issues.
- **The body states only what was observed**: URL checked, HTTP status, page title, asset reference, the failing
  assertion, the attempt count, the run URL, and the alert's UTC time. **It never asserts a cause** — not "the
  server is down", not "the app crashed", not "the site is broken". The check observed a response; it cannot
  observe a cause, and a string asserting a cause the process cannot observe is a defect in this repository.
- **The operator's first move is in the issue**, because that is where it will actually be met: read
  `/home/team/shared/host-boot-ledger.txt` (a boot has `boot_id` changed *and* uptime reset; a freeze leaves
  `boot_id` unchanged), then the guard's log at
  `/home/team/shared/probable-octo-sniffle/server/keep-alive.out` (after a boot it has **no exit line** — a
  boot gives it nothing to log, and the product and guard are re-armed only by a login), then the port holder
  via `lsof -t …/server/keep-alive.lock`, **before touching anything**.
- **On the next green run** the workflow comments that the check is green again, with the fresh observations
  and the run URL, and closes the issue. A green run with no open issue does nothing.

**The recipient is part of the control: a control the operator cannot reach is a false green.** These alerts
arrive as GitHub issues on this repository, so whoever is expected to act must actually read repository
notifications. If nobody does, the check is green by construction. This is why the canaries below were run
against the live alert path rather than reasoned about.

## What this check does NOT see — stated here, not in a footnote

1. **Which process holds port 3000.** That is host-only (`lsof` / `/proc`); it is not readable off-host at all.
2. **Anything behind the login gate.** The roster, the records, the seed's figures. A product answering 200 with
   our HTML over a broken database **passes every assertion here**. That residue stays a member's check, and no
   credential may be put in a public repo to close it.
3. **The guard, the tree, or the served bundle's bytes.** The on-host observer derives the expected md5 from the
   deployed tree's artifact; this check only proves the URL answers with **our page** and nothing more.
4. **The difference between a paused guest and a product that is not answering.** Off-host both arrive as *no
   answer inside the timeout* — the signals are identical, so nothing here can tell them apart and this check
   never claims to. **An alert is a prompt to look, not a verdict**, and the ledger read is what distinguishes
   them. Guest time on this host is lost in long stretches (measured 2026-10-26: ~122 min lost while the wall
   advanced 143 min), so **expect runs of alerts**, and do not lengthen the interval to quieten them: that only
   lengthens real detection. The alert's timestamp is a **lower bound** on when the trouble began.

## Detection is best-effort, ~5–15 min — not a guarantee

- 5 minutes is GitHub's shortest supported `schedule` interval.
- **Scheduled runs can be delayed under load, and queued jobs can be dropped.** A dropped run turns nothing red:
  the check simply did not run that cycle, and no artifact records the omission.
- A **planned movement** stops the product on 3000 for 19–26 s, which can fall inside a sample. Expect the
  alert and read the movement's own log as the explanation; three failed attempts absorb the short cases only.
- No availability percentage is derivable from any of this, and none is claimed. What is recorded is the
  contrast: before this check existed, detection was member-driven and measured in hours between sessions
  (19.6 h / 20.2 h / 24.6 h / 25.4 h), and the two real outages were each caught in ~1–2 min **by luck**.

## The trap that stops it silently: 60 days without repository activity

**GitHub disables `schedule` triggers on a repository after 60 days without repository activity.** The check's
own issue comments **do not count as activity**, and neither do its runs — so a quiet repository silently loses
this check. It does not turn red; **it stops**, and a stopped check looks exactly like a passing one.

One of these must therefore be habitual:

1. **a periodic commit** at least once every 60 days (a dated line in this document or a heartbeat file is
   enough); or
2. **a manual re-enable** in the repository's Actions tab at the same cadence.

Until one of them is, treat this check as **unarmed after 60 quiet days**. The same reminder is the first
comment in the workflow file, where the next editor will meet it.

## Maintenance and the canary recipe

- The production URL lives in **one place**: `UPTIME_URL_DEFAULT` in the workflow's `env`. Change it there.
- **Canary recipe — do this before trusting a green**, using the workflow's own `push` trigger (a canary cannot
  be dispatched before merge, because `workflow_dispatch` exists only on the default branch):

  1. set `UPTIME_URL_DEFAULT` to a URL that answers **200 with the wrong page** (`https://example.com/`) and push
     a commit touching the workflow file → the run must **FAIL on assertion B** and open exactly one issue;
  2. set it to a URL that **never answers** (`http://192.0.2.1/`, TEST-NET-1, reserved by RFC 5737) and push →
     the run must **FAIL on assertion A within the timeout budget**, not hang; two failures in a row must leave
     **one** open issue, not two;
  3. put the production URL back and push → the run must **PASS on all three assertions**, comment on that issue
     and close it.

  Each step is one commit that changes one line, and each run URL belongs in the PR body as evidence.

## Evidence — canaries actually run


Three runs on 2026-10-28, all produced by this workflow on the branch `feat/off-host-uptime-check`, each by the
`push` on this file's own path. The URL probed is printed by the run itself (`probing: <url>`), which is what
shows the run came from the workflow rather than from a hand-run check.

| canary | commit | URL probed | run | outcome | which assertion |
| --- | --- | --- | --- | --- | --- |
| W — wrong page, status 200 | `57e1235` | `https://example.com/` | [run 40684447620](https://github.com/AhmadJ979/Antum-People/actions/runs/40684447620) | **FAILED**, 3/3 attempts | **B** — `title seen: <title>Example Domain</title>`, `asset seen: none`, status `200` |
| H — no response (the freeze's shape) | `f2d09fe` | `http://192.0.2.1/` (TEST-NET-1, RFC 5737) | [run 40684839404](https://github.com/AhmadJ979/Antum-People/actions/runs/40684839404) | **FAILED**, job 89 s (budget 105 s) | **A** — `no HTTP response (curl exit 28: Connection timed out after 15002 milliseconds)`, `title seen: no <title>` |
| GREEN — the production URL | `59942d8` | the live site | [run 40685299643](https://github.com/AhmadJ979/Antum-People/actions/runs/40685299643) | **PASSED** after 1 attempt | all three — `200`, `<title>Antum People</title>`, `assets/index-C7z2ZG3I.js` |
| (extra) the first attempt, before the fix below | `15592da` | `https://example.com/` | [run 40684215940](https://github.com/AhmadJ979/Antum-People/actions/runs/40684215940) | FAILED in 2 s | **none** — the script aborted on GitHub's `bash -e`; the alert issue said so instead of inventing an assertion (fixed in `57e1235`) |

**The alert path is proved, not assumed.** Run `40684215940` **opened issue #323** and the `uptime-alert` label
was created by that run (it did not exist before). The two later failing runs **commented on #323 instead of
opening a second issue**, and the green run **commented on it and closed it** — one issue for four failing
checks, which is the whole point of the dedup rule. [Issue #323](https://github.com/AhmadJ979/Antum-People/issues/323).

**One defect this found before anyone trusted a green:** GitHub executes `run:` blocks as **`bash -e {0}`**, so
`found_asset="$(grep -Eo … | head -n1)"` exited the script the moment `grep` matched nothing — errexit, not a
failed assertion. `set +e` now heads every run block (with that reason in a comment) and the two greps carry
`|| true`.
