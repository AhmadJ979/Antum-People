Movement 2026-10-22T12:46:56Z -> the host on f4314d8
=====================================================

WHAT THIS IS. The evidence of the full movement the LEAD ran on 2026-10-22, filed here verbatim from
/home/team/shared/movement-2026-10-22-1247/ by agent-senior-software-engineer. **I did not run this movement and did not re-measure the
host**: every line below is the lead's own transcript, copied byte for byte (the digests in
manifest.txt are of these delivered bytes). Rules 19 and 12: evidence is about the tree that merged,
and nothing is reported that was not read off an artifact.

THE TREE. The movement moved the host from the pre-P3-1 state to `f4314d8` (Merge PR #287),
the first movement carrying #284's record-validating preflight and #285's flock-holder hook fix.

WHAT THE LOGS MEASURE (each line is a quotation from a file in this pack)
  * `deploy-evidence.txt` — "=== cutover 2026-10-22T12:46:56+00:00 ===", mode
    full-movement, and "HEAD is now at f4314d8 Merge pull request #287".
  * `deploy-evidence.txt` / `host-tools-verify-after.log` — every host tool INSTALLED with its body
    md5 equal to the repository blob at f4314d8: `cutover-preflight.sh` body md5 fffe9c1f9a1f964d2636309ba975e30c,
    and the hook `/etc/profile.d/zz-antum-product-guard.sh` body md5 bf80c94d9c9b1d3ac5e11373619fffd1 —
    i.e. the two corrections this month had been waiting for a movement to install them, and this is it.
    The verify pass ends "=== RESULT: VERIFIED — every copy's body equals its repository blob at f4314d85cf44 ===".
  * `hook-notes-after-rearm.log` — six lines, every one "guard already running (pid 13924), nothing to do":
    a guard that is UP is read as up. That is the exact defect #285 fixed (the old reader logged
    "FAILED to start the guard" while a guard was running).
  * `failed-count-in-guard-log.txt` — the single character "0": the hook's FAILED count after the re-arm.
  * `observer-serve-pair.log` — measured off the public URL at 2026-10-22T12:47:42Z:
    "PAIR HOLDS (exit 0)"; the page names assets/index-B7rk1n5J.css (35899 B, md5 55737b9e8f16d886249d0d387653967e)
    and assets/index-Be_ijisC.js (281017 B, md5 e83b7a33cb575f9440829916db13a05e), each served
    with bytes equal to the tree's own dist.
  * `build.log` — `> tsc -b && vite build`, then vite's own lines naming the same two assets. **No
    tsc output appears because `tsc -b` prints nothing on success** — the reason the P3-1 pack's
    tsc log is empty; see that pack's ERRATUM.txt.

A DUPLICATE, NAMED: `run.log` and `deploy-evidence.txt` are byte-identical (md5 8e86aa1c3a9b1dffda1814b97102f6b1).
Both are filed because both were delivered; neither is a second measurement.

THE TRANSCRIPT'S OWN LAST LINES (copied, not summarised)
    hook source: the deploy's revision f4314d8
    unchanged /etc/profile.d/zz-antum-product-guard.sh   body md5 bf80c94d9c9b1d3ac5e11373619fffd1
  
  === RESULT: nothing to do — all 7 copies already match this source (a second run changes no byte) ===
  deployed commit: f4314d8 Merge pull request #287 from AhmadJ979/feat/probation-30-60-90
  === cutover finished 2026-10-22T12:47:18+00:00 — run-stamped evidence: /tmp/cutover-20261022-124656-evidence.txt | build: /tmp/cutover-20261022-124656-build.log | seed: /tmp/cutover-20261022-124656-seed.log ===

WHAT THIS PACK DOES NOT ESTABLISH. It is not a re-measurement: it says what the movement's own
instruments recorded at 2026-10-22T12:46:56+00:00, and what the observer measured
off the URL afterwards. A reader who needs today's state must re-run `scripts/observe-serve-pair.sh`;
the served pair is a point in time, never a rate.
