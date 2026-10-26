Evidence pack, row f2e68a04.

01  rig probe at 505ddd3 (before): no actor gate, no audit row, the Layer 4 flag moves
02  rig probe at aecd2ee (after):  400 / 404 / audit row / NULL score / server alive
03  the before server log: why the process ended (SQL error -> unhandled rejection)
04  the after server log
05  full suite at aecd2ee: 312 tests / 51 suites / 0 fail, exit 0
06  the new cases run against 505ddd3 (red without the fix)
07  the new cases run against aecd2ee (green)

Probe: /tmp/rig-xiv/probe.cjs, own port, own throwaway DB, own accounts; the live product
answered 200 before and after every run. Raw transcripts, copied not summarised.

MEASUREMENT NOTE: the runs in 02/05/07 were taken at aecd2ee, the commit that added the fix.
The pack was then committed on top (4358125) — that commit touches only this directory, and the two
server/ blobs are byte-identical between the two revisions (verified with git rev-parse), so the
measured code IS the code this PR proposes.
