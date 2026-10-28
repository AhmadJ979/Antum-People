# The watcher notes: a cadence by design, never a detection latency (2026-10-28)

Two modules that serve a note to HR closed it with the same sentence about their own ticking, and
both asserted a **detection latency** the process cannot establish. This is the fourth instance of
the same defect family (#312 → #315 → #319/#320 → this) and the ruling to fix it was the lead's; this
directory is the evidence for the change, not an argument for it.

## The two strings, before

| module | where it is served | served text (before) |
|---|---|---|
| `server/probation-escalation.js:231-234` | stored into `probation_escalations.note`, returned by `GET /api/probation/escalations` (`server/index.js:1325-1342`) | "…The deadline fell after this escalation watcher started, **so it was seen within 5 minute(s) of the next tick.**" |
| `server/preboarding-flag-scheduler.js:122-123` | the per-record `note`, served through `flagWatcher.status()` at `GET /api/preboarding/flag-watch` (`server/index.js:1113-1119`) | "This case reached the 48-hour mark after this watcher started, **so it was seen within 5 minute(s) of the next tick.**" |

The FIRST clause of each is honest: the deadline/boundary-versus-start comparison is something the
process observes (`server/interval-watcher.js` decides `late` against `startedAt`, and `lateByHours`
is arithmetic). The closing clause is not: it names a latency, and this process cannot see whether
its own ticks ran on schedule. On this host a suspended guest, a stall or a lost span is exactly how
a tick goes missing — the failure mode the whole family exists for. A reader takes it as a promise
about how fast a person would have been told.

## The two strings, after — quoted from the running code

Both printed by `/tmp/print_notes.js`-equivalent passes through the real modules at the **production
default interval** (`interval_ms: 300000`), not-late polarity:

```
Milestone 1 of note-hire’s probation passed its deadline of 2026-10-28 with no submitted
evaluation. The deadline fell after this escalation watcher started; it was first seen
2026-10-29T12:00:00.000Z. The watcher reads for what has come due every 5 minute(s) by design;
it cannot see whether its own ticks ran on schedule, so that interval is the intended cadence,
not a measured detection time.
```

```
This case reached the 48-hour mark after this watcher started; it was first seen
2026-10-31T00:00:01.000Z. The watcher reads for what has come due every 5 minute(s) by design;
it cannot see whether its own ticks ran on schedule, so that interval is the intended cadence,
not a measured detection time.
```

The shared closing sentence — the one thing both notes say about their own ticking — is written
**once**, in `server/interval-watcher.js` (`cadenceClause(intervalMs)`), the module that owns the
interval. Both watchers import it, so correcting one cannot leave the other asserting the old
sentence. The recorded instants stay where they were: the deadline/boundary and the instant this
process first saw it, the same values the record already carries as `detected_at`.

## The guard

`server/watcher-note-detection-claim.test.js` — one file, both strings, bidirectional:

1. reads the note the escalation watcher actually writes and the note the flag watcher actually
   serves (and asserts the served payload carries the judged string), for the not-late polarity;
2. asserts each note states the deadline/boundary and the instant it recorded as first seen;
3. asserts each note carries `cadenceClause()` **at its own interval**, that the clause is
   parameterised (two intervals produce two different sentences — the anti-vacuity control), and that
   neither note carries the other's clause;
4. asserts the limitation is named (`cannot see whether its own ticks ran on schedule`, `intended
   cadence, not a measured detection time`);
5. asserts neither note carries a latency shape, in either polarity;
6. sweeps every non-test module in `server/` for the latency shapes outside its comments (comments
   stripped by a small quote-aware reader; a flattening step rejoins a sentence split across
   concatenated source lines, which is how the flag module spelled it);
7. asserts the two modules still quote the removed clause **on a comment line**, so the record of
   what was removed survives and a quote in code cannot masquerade as history.

## Falsification

`falsify-guard.py` in this directory, run from the repository root:

```
python3 docs/evidence/watcher-note-detection-claim-2026-10-28/falsify-guard.py <STAMP>
```

Each mutation is applied to the **original** text (never on top of the previous mutation, or a run
would carry two mutations and could not say which the guard noticed), runs the guard under its
documented command, writes the raw log here, then restores the file. The last three lines of the run
print the restored md5 next to the md5 taken before the run.

| run | green | A probation old clause back | B flag old clause back | C limitation dropped |
|---|---|---|---|---|
| tests / pass / fail | **6 / 6 / 0**, exit 0 | 6 / 4 / **2**, exit 1 | 6 / 4 / **2**, exit 1 | 6 / 4 / **2**, exit 1 |
| failed subtests | — | 1 (escalation note) + 5 (sweep) | 2 (flag note) + 5 (sweep) | 1 + 2 (the shared clause reddens **both** notes) |
| log | `guard-green-0858Z.txt` | `guard-falsified-probation-old-clause-back-0858Z.txt` | `guard-falsified-flag-old-clause-back-0858Z.txt` | `guard-falsified-limitation-dropped-0858Z.txt` |

Mutations A and B **append** the removed clause and leave the corrected cadence clause in place, so
every presence assertion still passes and only the absence check (and the sweep) can catch them —
this is what makes the absence check load-bearing rather than incidental. Mutation C deletes what the
sentence cannot see while keeping the cadence, since a cadence stated without the limit is the same
claim in softer words.

Mutated md5s: `server/probation-escalation.js` `084b0a57b30965f155741fb7d1315c4a` ·
`server/preboarding-flag-scheduler.js` `bcd113f19758c021cc8a105823cdef73` ·
`server/interval-watcher.js` `09975bbec67193d0962c6c75339f6507`.
Restored md5s, byte-identical to the pre-run md5s:
`probation-escalation.js` `0a1b3ec1e058033ecd6ec39d305746e7` ·
`preboarding-flag-scheduler.js` `7576d655a98caf372d96aaaaa4964a3c` ·
`interval-watcher.js` `994dd8ac3569c09651fc51febdc11e14`.

## The suite, on this branch

`server-suite-branch-0859Z.txt` — `cd server && npm test`, exit 0:
**350 tests / 55 suites / 350 pass / 0 fail / 0 cancelled / 0 skipped** (before this branch: 344 / 54;
this guard adds 6 tests and 1 suite, and `preboarding-flag.test.js`'s assertion on the removed clause
was re-pointed at the new one).

## What this does not prove, and what it owes

- **No screen is involved.** `GET /api/probation/escalations` and `GET /api/preboarding/flag-watch`
  are reachable from no click (`server/reachability-register.js`: CALLERLESS, owner decision 21). An
  API reading is not a rendered claim, and this change makes none.
- **Not banned, deliberately:** the `CATCH_UP_RULE` strings' "recorded on the next tick" /
  "escalated on the next tick". Those say what the loop does with an item that comes due while it is
  up — a statement about a code path, not a promise about when a person was told.
- **One movement is owed.** A served payload string is served text: the client bundle bytes do **not**
  move (no `client/` file and no `server/index.js` line is touched), so the delta is server-side only
  and still owes a movement. The lead runs it.
