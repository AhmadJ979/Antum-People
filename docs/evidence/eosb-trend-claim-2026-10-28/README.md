# The EOSB trend sentence: a claim the series behind it cannot support

**Task:** the third instance of the class fixed in #312 and #315 — a string the product shows asserting
something its source cannot establish. This one is generated in the **client** and served to a buyer.

## 1. The claim, and where it is really read from

Served bundle `client/dist/assets/index-CNpLMWLD.js`, fetched over the public URL:
283703 B, md5 `62f0fae0baf2b71f7607d86f6834dab1`. Source: `client/src/App.tsx:1889`, the
**LIABILITY EXPOSURE (ILLUSTRATIVE)** card in the Executive Summary Banner, inside
`{activeTab === 'analytics' && (`, rendered from the nav button **"Strategic Intelligence"**.

**It renders, and it renders to a buyer — measured on a screen, not inferred from the source**
(`screen-before-dom.txt`, `strategic-intelligence-before.png`). The standing rule is that a claim about
a screen comes from a screen; this one was taken on an isolated rig whose bundle is byte-identical to
the served bundle (rule 26), signed in with the rig's own throwaway credential.

## 2. Why the claim is unsupportable

The sentence compared point `[2]` of `eosbLiabilitySeries` with point `[0]` and hard-coded the year:

> "EOSB liability forecast shows a {rise|steady} trend into 2027."

- The series is **four hard-coded calendar quarter-ends** (`server/index.js:773`, `forecastQuarterEnds`):
  Q3 2026 `2026-09-30` · Q4 2026 `2026-12-31` · Q1 2027 `2027-03-31` · Q2 2027 `2027-06-30`. Today
  (2026-10-28) the first is 28 days **past** and the last is 8 months ahead, so it is a calendar series,
  not "the next 12 months".
- Every point is computed with **every employee projected as a resignation and no departure ever
  modelled** (`eosb-liability-forecast-spec.md` §2.3).
- Four points under those assumptions cannot establish a trend, and the comparison the sentence makes is
  Q1 2027 vs Q3 2026 — six months, labelled with a year.

Measured on the rig (`rig-readings.txt`), unfiltered: 167,164 · 180,728 · 230,424 · 265,666.

## 3. What replaced it

The wording is the forecast spec's own honest label (§7 "What this number is not"), not a new claim:

> An undiscounted projection of accrued EOSB entitlement, engine-computed - not a statutory or actuary
> provision, and not a basis for booking.

It states what the number is and what it is not, and asserts **no movement at all**. The old wording is
kept in a dated comment beside it — historical by construction, and the guard strips comments before
asserting so the quote cannot read as a live claim.

**Not touched, deliberately:** the series, the quarter-ends, the projection rule, the chart, and the
basis question (resignation vs full entitlement) — all P4-3's build. This change asserts less; it does
not make the number better.

## 4. The guard, and the proof it is load-bearing

`client/src/eosbTrendClaim.test.js` (run: `cd client && npm test` — the client suite is **not** inside
`check-all`'s suite gate, which is `cd server && node --test`; the same is true of the three client
tests that already exist).

| run | tree | result |
|---|---|---|
| green | fixed branch | `36 / 4 / 36 / 0` exit 0 (`guard-green.log`) |
| falsification A | honest label **kept**, old sentence pasted back as a rendered paragraph | `not ok 2` — "no rendered string claims a trend…"; `35 pass / 1 fail`, exit 1 (`guard-falsified-mutation-A.log`) |
| falsification B | the whole card reverted to its original text (md5 `2e18aa8e…`, byte-identical to the pre-fix file) | `not ok 2` **and** `not ok 3`; `34 pass / 2 fail`, exit 1 (`guard-falsified-mutation-B.log`) |
| restored | fixed branch | `36 / 4 / 36 / 0`, App.tsx md5 back to `8fb5e22263b990fb4289b72b5a5ea406` |

A is the isolating run (a full revert trips the presence assertion first and would prove the wrong
assertion). B shows the presence assertion is load-bearing too. After B the file was restored
byte-exactly and its md5 re-read.

## 5. Bundle identity, before → after

| | asset | bytes | md5 |
|---|---|---|---|
| before (served) | `assets/index-CNpLMWLD.js` | 283703 | `62f0fae0baf2b71f7607d86f6834dab1` |
| after (built) | `assets/index-C7z2ZG3I.js` | 283688 | `2d1a032cb986e75168f4f83244b69dc8` |
| stylesheet, both | `assets/index-CSQHlfh4.css` | 35932 | `2cdb30957b86cca3e6c9df949a0c2c40` |

`grep -c "trend into 2027"` on the new module: **0**; on the served module: **1**. The CSS is unmoved —
measured, because Tailwind v4 scans raw prose and this change adds prose to a scanned file.

**A movement is owed** (a `client/` delta, and the served asset name changes). It is the lead's to run.

## 6. How to re-run everything

```
cd client && npm run build            # exit 0, dist emitted  (client-build-after.log)
cd client && npm test                 # 36/4/36/0
bash <rig>/setup-before.sh            # rig: own worktree, own DB, own port, own credential
curl -s -o /tmp/served.js -w '%{http_code} %{size_download}\n' <public-url>/assets/index-<hash>.js
md5sum /tmp/served.js                 # must equal the deployed dist's asset
```

## 7. Filed VOID, not deleted

`screen-after-VOID.txt`: the after-the-change screen pass reached the right rig and named the right
bundle but never got past the login screen, so its zero-hit banner reading proves nothing. Kept as a
record of what was attempted and what would have to be re-run.

## 8. Sibling found on the same screen (NOT fixed here — the lead's call)

The same banner card beside it reads **"Retention lift has increased in recent cohorts."** from
`retentionLiftSeries[last].lift > 0` — one cohort's positive lift, stated as a trend across
"recent cohorts", while the chart under it shows `H1 2023` at `lift -33` (`?jurisdiction=AE` payload,
`rig-readings.txt`). Same class, different data, and its own analysis. Out of this task's scope; filed
here so it is not lost.
