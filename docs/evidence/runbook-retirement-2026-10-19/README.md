# The host runbook retired into the repository — 2026-10-19

The 2026-10-19 ruling: **the repo-owned procedure lives in the repository, and the host file becomes a
checklist plus a pointer.** It ends "after the movement, not before"; the movement ran 10:40:31–10:41:27Z and
is served, so this is the act that ruling was waiting for.

## What moved, and what is left

| | |
|---|---|
| the procedure | `DEPLOY.md` → **"The movement — the repo-owned procedure"** (sequence, derived preconditions, the timing rule, the evidence step) |
| the host file, before | `/home/team/shared/cutover-20261010-RUNBOOK.md` — 8241 B, md5 `11ef647de96887061c8169fd0fd563c5`, 95 lines |
| the host file, after | **the same path as it stands now: 1,926 B, 32 lines, md5 `17075470c23fdb57df44bdfe55051a62`**, mtime 2026-10-19 15:35:22Z — a host-only checklist and a one-line pointer (`repo path + the commit it was last checked at`, which is `7ed470d`, re-pointed from `e90d068` once that merge landed), plus the three commands an operator runs here |
| the retired full text | `/home/team/shared/retired/cutover-20261010-RUNBOOK-full-retired-2026-10-19.md`, **byte-identical** (8241 B, md5 `11ef647de96887061c8169fd0fd563c5`) — a dated RECORD of the 2026-10-10 run and its 10-18/10-19 amendments, not a second copy of the procedure |

**Nothing was left at the path that a reader could mistake for the procedure**, and nothing was left as a
redirect: the old file was moved aside first, then the checklist was written at the path (decision 17's
handling). The two numbers side by side: **the host file states the procedure lives in `DEPLOY.md`, and
`DEPLOY.md` carries it — one copy, and the checklist says so.**

**Measured, not computed:** the after-state above is the file read back from disk at 2026-10-19 15:35:22Z — size, lines and md5. It was written three times today, each write making it MORE true and changing its bytes: the first checklist write recorded `166e11e` as the reference, the second corrected that to `e90d068`, and the third re-pointed it to `7ed470d` once the merge existed. A reviewer measuring between the second and third saw 1,960 B / 33 lines / md5 `893081d1…`; that was an intermediate state, superseded by the row above. **A reading printed as current has to name when it was taken** — which is the defect this row had in its previous version.

## The commands the pointer names are the repository's, and they were checked as written

All three exist and parse, measured off `e90d068` (`bash -n`, 0 error lines):

```
present  /home/team/shared/probable-octo-sniffle/scripts/install-host-tools.sh   (11187 B)
present  /home/team/shared/probable-octo-sniffle/scripts/cutover-preflight.sh    (19782 B)
present  /home/team/shared/deploy-main.sh                                        (26517 B, the installed copy)
```

The instruction that keeps them honest is carried over from the retired file: **run the installer FROM a
tree, never from `/home/team/shared`** — a self-copy there would be a second, quietly stale install path.

## Held

No movement, no restart, no reset/build/seed on the deployed tree, **nothing written to the six host-tool
copies** (only the host `*.md` runbook path and the new `retired/` directory beside it), and nothing sourced
from the guard hook.
