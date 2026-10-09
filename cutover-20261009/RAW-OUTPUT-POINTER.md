# Where this run's raw output actually is, and what happened to the paths the record cites

The record beside this file cites its raw run output at `/tmp/cutover-evidence.txt`, `/tmp/cutover-seed.log`
and `/tmp/cutover-build.log` on the host. **Those paths no longer hold this run's bytes and never will
again.** `deploy-main.sh` wrote to fixed paths, the **13:46 cutover overwrote all three**, and a restart
would clear them anyway. The genuine survivor of this run is `/tmp/cutover-run.log`, and the same bytes are
committed beside this record as **`cutover-run-20261009T104559Z.log`** (md5 `91070fd6240979f685500de67da8f581`).

**Correction to this file's own earlier version, which is the reason to distrust it:** it named three files
- `cutover-evidence.txt`, `cutover-build.log`, `cutover-seed.log`, all now removed from this directory - as
*this* run's output. They were the **13:46** run's, byte for byte (md5 `841f7b7d5badbe7f25b30c3f626dde2a`,
`614589f4b6be2e4e589607caf40aac1f`, `6abc88f2f5752fb5d10d7303e4c6edfa`, identical to the three files under
`cutover-20261009-1346/`, and the first opens with the 13:46 header). The withdrawal is recorded in full, with
the measurements, in `README.md` beside this file.
