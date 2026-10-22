# The preflight's record is now checked against bytes (2026-10-22)

Row `cf69f217`. The preflight's after-state record (`ANTUM_MEASURED_TIP` plus six bundle fields) is
supplied by the operator. Until this change its **numbers were stated and never validated**: a run with
`ANTUM_MEASURED_ASSET_MD5=00000000000000000000000000000000` and everything else correct went **green**,
so a record nobody had measured could reach the after-state as a PASS. This is the last of the three
defects the 2026-10-21 movement's own pack found by trying (the other two were fixed in #277).

## What changed

In `scripts/cutover-preflight.sh`, right after the record's *shape* checks, the record's numbers are now
compared with **the bytes in the dist dir this run already reads** for the served-vs-dist check:

- the named bundle is **in** the dist dir -> its md5 and byte count must equal the record's, or the run
  **FAILs** naming both numbers;
- the named bundle is **not** in the dist dir -> a **NOTE**, not a FAIL, because a preflight run *before* a
  build legitimately states an after-state that is not built yet. The check that guards the bytes the URL
  actually serves remains the served-vs-dist one.

That asymmetry is the whole design: it adds **no failure** to a bare run whose recorded tip predates the
tree, and it reddens the moment a record names a bundle this tree *has* with numbers that are not its bytes.

## Measured (transcripts in this directory, run at the merge base `043b752`)

| run | old script (the installed host copy, unchanged bytes `8f6f5abb…`) | new script (`3202c691…`) |
|---|---|---|
| whole record, asset md5 forced to zeros | **exit 0 — the gap** | **exit 1**, one FAIL naming `md5 e6ff5da3…` on disk against `0000…` in the record |
| the same record with the right numbers | — | exit 0, two PASSes: "the record's numbers ARE the bytes this tree holds" |
| bare (the recorded default) | exit 1, 1 FAIL | exit 1, **the same 1 FAIL** + two NOTEs (`index-BG0peuOK.js` is not in the dist) |
| tip alone (half-overridden record) | exit 1, the refusal | exit 1, the same refusal |
| `ANTUM_DIST_DIR` with no build | exit 1, the served-vs-dist FAIL | exit 1, the same FAIL |

The first row is the pair that matters: **same input, old bytes green, new bytes red.** An unchanged
control script is the strongest control available here, and it is the *installed* copy — so the "before" is
the state the host is actually running, not a construction.

`bash scripts/install-host-tools-test.sh` -> see `07-installer-suite.txt` (78 passed, 0 failed);
`python3 scripts/check-all.py --no-suite` at this branch -> exit 0.

## Movement

**None owed:** the preflight is host tooling. Nothing in `server/` or `client/` loads it — the only files
naming it are under `scripts/` (`check-all.py`, `check-design-concepts-index.py`, `install-host-tools.sh`,
`install-host-tools-test.sh`, `rollback-to-9d2182a.sh`), which is a citation, not a load.

**The installed host copy stays old (`8f6f5abb…`) until the next install/movement.** That is the same
consequence #277 documented, and it is the reason this evidence pack exists rather than a claim that the
host is already fixed.

## Files

`01-…` the gap: whole record with a wrong asset md5, new script; `02-…` the same input against the
*unchanged installed copy* (exit 0 — the defect); `03-…` the correct record (exit 0, two new PASSes);
`04-…`/`05-…` the bare run, old and new, showing the FAIL count unchanged and the two NOTEs;
`06-…`/`07-…` the half-overridden record and the entry point; `08-…` the installer's suite.
`manifest.txt` lists every file here except itself.
