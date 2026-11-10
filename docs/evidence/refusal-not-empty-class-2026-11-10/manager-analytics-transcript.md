# The two Strategic Intelligence sites, rendered as `manager`, before and after

The gap §5 of PR #396 named. Rendered DOM transcripts, no images, on two scratch rigs at 1280×800.
The live product (port 3000) and the deployed tree were not touched: `http://localhost:3000/` answered
`200` before and after this run.

## The rigs

| rig | tree | revision | bundle served | port | DB |
|---|---|---|---|---|---|
| before | `rig-before2` (worktree of `a1625b4`) | `a1625b40967d1497ba593cae4d1acf8b0637b14f` | `assets/index-NX5GUwrh.js` | 4821 | `/tmp/rig2-before.db` |
| after | `wt-refusal2` (branch `fix/refusal-empty-class-2026-11-08`) | `3308b9ac3ceb0b0fbd2f62078e84828b4901465d` | `assets/index-Bje3YONb.js` | 4822 | `/tmp/rig2-after.db` |

The after bundle was built from the branch head in the worktree, not in the deployed tree:
`cd client && npm run build` → `[build-provenance] revision=3308b9ac3ceb0b0fbd2f62078e84828b4901465d
dirty=false entry=assets/index-Bje3YONb.js files=12`. Each bundle name was read back from the served
document (with the rig's own gate cookie), not inferred from the build log.

## The account

`manager` is the role `analytics:read` excludes (`server/access.js:114` — hr_admin, finance,
compliance_viewer). A throwaway `mgr` account with `access_role = 'manager'` was inserted into each
rig's own DB (bcrypt 12, password `scratchpass`), and a session token was minted through each rig's
own `/api/login`. Both returned `role manager`.

The refusal is the server's, not the client's: `GET /api/analytics/dashboard` with that token answers
**`403`** on both rigs (4821 and 4822), before and after.

## Before — `a1625b4`, `manager`, Strategic Intelligence tab

`refusalNodes: []` · `hasRetentionClaim: true` · `hasTtvClaim: true` · `hasInsufficient: true`

```
Strategic Workforce Intelligence
RETENTION INSIGHT (ILLUSTRATIVE)

Retention lift has stabilized in recent cohorts.

PRODUCTIVITY GAP (ILLUSTRATIVE)

Average Time-to-Value is 0 days.

LIABILITY EXPOSURE (ILLUSTRATIVE)

An undiscounted projection of accrued EOSB entitlement, engine-computed - not a statutory or
actuarial provision, and not a basis for booking.

Retention Lift — 1-Yr Cohort

Comparing cohort retention (Illustrative Benchmark)

Time-to-Value by Department

Avg days to full productivity (Illustrative Target)

Insufficient productivity data.
EOSB Liability Forecast — by Jurisdiction & Quarter

Illustrative forecast based on UAE basic and KSA total salary rules. Each employee is projected on
their own record: one with no termination reason recorded is projected unreduced rather than as a
resignation.

UAE
KSA
```

That is a 403 read drawn as three claims about data the account may not read — the banner's
"Retention lift has stabilized in recent cohorts." and "Average Time-to-Value is 0 days." above an
empty Retention Lift, "Insufficient productivity data." where the Time-to-Value chart goes, and a
forecast grid whose only content is the jurisdiction labels.

## After — `3308b9a`, `manager`, same tab

`refusalNodes: 2` (both `data-refusal-panel="analytics"`) · `hasRetentionClaim: false` ·
`hasTtvClaim: false` · `hasInsufficient: false` · `hasBannerTitle: false`

Below the tab bar and the page chrome, the whole tab body is:

```
You can't read the dashboard figures from this account. Nothing was changed, and you are still
signed in. The dashboard figures are read by HR, finance and a compliance viewer.

You can't read the dashboard figures from this account. Nothing was changed, and you are still
signed in. The dashboard figures are read by HR, finance and a compliance viewer.
```

Two sites, two refusal sentences, no claim, no empty chart, no forecast grid. The banner and the
charts grid are both gated on `emptyArea(panelReading.analytics)`.

## What this does and does not prove

- It proves the two new sites render the refusal on a screen for the account that is refused
  `analytics:read`, and that the same screen on the pre-fix tree rendered the claims instead.
- It does **not** touch `demo` (finance) or `admin` (hr_admin), who hold `analytics:read`: for them
  the gate must not fire, and their screens are the control. Their rendered transcripts from the
  earlier pass are unchanged by this commit, which only adds the two gates.

## Reproducing

`drive-manager-analytics.sh` in this directory drives both rigs; `probe-manager-analytics.js` is the
probe it evaluates. Both read the rigs at ports 4821/4822 with their own scratch gate secret and
their own DBs. The raw probe output for each rig is beside this file as
`manager-analytics-before.json` and `manager-analytics-after.json`.
