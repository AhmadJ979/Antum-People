# Post-merge verification — PR #109 (row `bc89d0bd`)

Merged as **`0dd1a97`** ("Merge pull request #109 from AhmadJ979/fix/a11y-intake-labels"), branch tip `1353c01`.
Checked with `git merge-base --is-ancestor`: the branch tip **is** an ancestor of `origin/main`, so the merge is
clean and nothing was dropped.

Verified on the **merged tree**, in a clean worktree of `origin/main` (`~/verify-main`), not on the branch I
handed over — rule 19: evidence describes the tree that merges.

## 1. The merged tree builds and ships every association

```
cd client && npm run build          # tsc -b && vite build
dist/assets/index-gt1pFhU5.js   270.52 kB │ gzip: 75.36 kB
✓ built in 441ms
build exit code: 0
```

Every marker appears **exactly twice** in the emitted bundle — the `htmlFor`/`id` pair, or for the checkbox and
the form the `aria-labelledby` + `id` pair:

| marker | in bundle | marker | in bundle |
|---|---|---|---|
| `login-username` | 2 | `employee-role` | 2 |
| `login-password` | 2 | `employee-jurisdiction` | 2 |
| `intake-offer-reference` | 2 | `employee-basic-salary` | 2 |
| `intake-candidate-name` | 2 | `employee-national-id` | 2 |
| `intake-candidate-email` | 2 | `employee-start-date` | 2 |
| `intake-role` | 2 | `exit-departure-reason` | 2 |
| `intake-department` | 2 | `exit-preventable` | 2 |
| `intake-reporting-line` | 2 | `exit-new-salary` | 2 |
| `intake-jurisdiction` | 2 | `exit-feedback` | 2 |
| `intake-start-date` | 2 | `offer-intake-heading` | 2 |
| `employee-first-name` | 2 | `task-title-` | 2 |
| `employee-last-name` | 2 | `employee-email` | 2 |
| `employee-department` | 2 | | |

**24 of 24.** This closes the gap the browser could not: the four **Exit Intelligence Intake** controls are in
the shipped bundle even though that modal still has **no opener** — so they are correctly associated in the code
that ships, and still unreachable by any user. That remains its own defect, not this fix's.

## 2. The merged tree passes the server suite

```
# tests 134 · # suites 31 · # pass 134 · # fail 0 · # cancelled 0 · # skipped 0 · # todo 0
```

## 3. What this merge costs: a cutover is now owed

`origin/main` is `0dd1a97`; the **served tree is still `2028894`**, and the delta between them contains
`client/src/App.tsx` (#109) and `server/document-store.js` (#108). So the live surface is serving the
**pre-fix client** (`index-B3KoM02v.js`): **no control has an accessible name on the live surface until the next
cutover**, which re-seeds the demo as part of its run. Undeployed, not regressed — nothing on the served surface
changed or broke.

Raw capture: `post-merge-client-bundle.txt`.
