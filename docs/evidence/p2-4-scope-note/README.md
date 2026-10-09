# P2-4 defect — the HR roll-up's second copy of the flag's scope claim

**Row:** `83c22f60` · **Fix branch:** `fix/p2-4-scope-note-single-source`, tip `7e6abfb`, base `origin/main` `501d5fa`
**Verified tree:** `46f2192df242b82c232059a5122027951ecfbcc7` — the branch tip's tree hash, and identical to
`git merge-tree --write-tree origin/main fix/p2-4-scope-note-single-source`, which printed that same hash
with no conflict report.

**The evidence was taken at tip `cd5f896`** (tree `ead2fb6e93b81b6823f0854dd46c81270f3dd19f`, base `2ca2c19`).
`main` then moved twice under the open PR (#93 tracker Round 27, #94 docs — **neither touched a `client/` or
`server/` file**), so the branch was rebased and the tree hash changed with it. The rebase changed no client
byte: `git diff --stat cd5f896 7e6abfb -- client server` is **empty**, and the `client/src/App.tsx` blob is
`7d387005…` on both — so the rendered reads below still describe the client that will merge. The rig
transcripts in this directory name `cd5f896` / `ead2fb6e` because that is the state they were captured on,
and were not rewritten.

## The defect

`client/src/App.tsx:1722–1726` carried a hard-coded paragraph above the HR roll-up, telling the reader:

> "The 48-hour chip is derived from every item on a case, whatever track created it. Today that is the
> employee-track documents only, because the workspace track (P2-4) is not built yet — when it lands, its
> items join the same rule with no change here."

False since #86 merged, contradicted by the server's own `SCOPE_NOTE` (`server/preboarding-flag.js:48`,
already corrected in #86), and — the structural part — a **second version of a sentence the payload
carries**: the client's `PreboardingFlag` interface declared `scope_note` (`:161`) and never rendered it.

## The fix

One paragraph, deleted and replaced by the payload's own string:

```tsx
{checklistOverview && checklistOverview.cases.length > 0 && (
  <p className="text-[9px] text-slate-400 mb-4 -mt-2">
    {checklistOverview.cases[0]?.flag.scope_note}
  </p>
)}
```

**Is the payload reachable at that point?** Checked, not assumed: the paragraph sits above the case list,
but `checklistOverview` is already in scope there — the totals block five lines below reads the same
object. Each row's `flag` carries `scope_note`, and the server sets the same `SCOPE_NOTE` constant on
**every** flag state (the no-start-date branch `:150` and the shared object `:164`), so reading it once
from the first row is the server's single sentence, not a per-case variant. Measured on the instance
below: `distinct_scope_notes: 1` across all three cases. With no cases there is no sentence to state, so
the paragraph renders nowhere rather than the client asserting a page-level claim about a list that is
not on screen.

Nothing is composed in the client, and the string is not fetched from anywhere but the payload this panel
already reads.

## Evidence — rendered, same viewport, same read method, before and after

Two isolated scratch instances, each seeded through `scripts/seed-demo.js` on 2026-10-09 with its own
throwaway DB, port and credential. Logged in through the product's own login endpoint, session injected,
Pre-boarding tab opened, then a DOM read taken in the page with the API payload fetched **in the same
frame** so the comparison is string-equal, not visual.

| | before (`origin/main` `2ca2c19`, port 4718) | after (branch `cd5f896`, port 4717) |
|---|---|---|
| `stale_para_present` | `true` | — (absent from the whole page body) |
| `"not built yet"` anywhere in body | present | `false` |
| paragraph matching the payload | `0` | `1` |
| `rendered_equals_payload` | `false` | `true` |
| `distinct_scope_notes` in payload | `1` | `1` |
| bundle | `index-B620AFhh.js` 269.31 kB | `index-CG8sEoa6.js` 269.10 kB |

- `before-hr-rollup-sentence.png` — the stale sentence rendered in the HR roll-up.
- `after-hr-rollup-sentence.png` — the same viewport, the payload's sentence rendered instead.
- `dom-read-before.json` / `dom-read-after.json` — the two reads, including `stale_para_text` (before) and
  the byte-for-byte comparison (`identical: true`, after).
- `payload-overview-ae-*.json` — `GET /api/preboarding/checklist/overview?jurisdiction=AE` from each
  instance; the `scope_note` compared above is read out of these, not retyped.
- `rig-before-setup.txt` / `rig-after-setup.txt` — the rig transcripts, including the tree-hash check that
  the rig tree **is** the merge result. `rig-after-setup.txt` also contains my first, failed probe of a
  guessed route name; the real route is the one the client calls
  (`client/src/App.tsx:621`) and is what the payload files hold. Left in rather than cleaned up.
- `probes/` — the rig scripts and the browser probes, so the reads can be re-run.
- `build-proof.txt` — `cd client && npx tsc -b` exit **0**, `cd client && npx vite build` exit **0**, with
  the tree SHA in the header.

**Not asserted here:** the demo figures in the payloads (case 3 `started`, case 2 `inside_48_hours`, case 1
`clear`; 21/21/22 open items) are seeded relative to the day of seeding and move on re-seed. The claim this
evidence supports is only that the rendered sentence equals the payload's `scope_note`.

## Out of scope, untouched

The flag's derivation and the 48-hour boundary, the demo seed, the workspace board, and the dated
transcripts under `docs/evidence/p2-4-rendered/` — those are evidence as of the day they were taken and
were not edited.

## Note on the merged pass (`docs/evidence/p2-4-rendered/`)

That pass did not frame this paragraph (its frames are the board and the case rows), so the before-frame
above was taken fresh rather than reused.
