# Caller-error contract — the before-table and the guard's control (2026-11-02)

Measured on `5ee0be1` + this PR's change, on a throwaway rig: `server/index.js` spawned on a free port
with `PRODUCT_DB_PATH` under a temp dir, a throwaway `JWT_SECRET`/`ENCRYPTION_KEY`, and one signed
token per role. Nothing here touched the live deployment or the live database.

## `redden-control.txt` — the guard with the defect put back

`server/index.js` was copied to `/tmp/redproof` with the four login guard statements removed (the
`const { username, password } = req.body;` destructuring restored inside the `try`), so
`bcrypt.compare(undefined, …)` throws exactly as it did before this PR.

    # tests 6   # pass 4   # fail 2

The two failures are the guard and the login anchor. The guard's own message:

    6 caller-error probe(s) answered 5xx — the caller's mistake is being reported as ours:
    POST /api/login | no path parameters; empty object body {} -> 500 {"error":"Internal Server Error"}
    …

The guard cannot be green on the tree that carries the defect.

## `redden-restored.txt` — the same scratch copy with the fix restored

    # tests 6   # pass 5   # fail 1

**This half is a RIG report, not a tree report, and it is published as one.** The scratch copy holds
only `server/*.js` (its `node_modules` is a symlink), so `GET /api/compliance/notice` — which serves a
document from the repository — answers 500 there, and the guard correctly reddens on it. That is the
rig missing its inputs, not a defect in the fix.

**The green half of the control is the real tree**, and it is `after.txt` below plus the suite:
`node --test client-error-contract.test.js` on the repository is **6 tests / 6 pass / 0 fail**.

## `after.txt` — the full probe table on the fixed tree

    334 probes / 26 enumerated routes
    200 x33   400 x151   403 x44   404 x106   500 x0

The same 334 probes on the unfixed tree (`before.txt` in the PR body's table) were
`200 x60 · 400 x109 · 403 x44 · 404 x114 · **500 x7**`.

Reproduce both halves from the repository:

    cd server && node --test client-error-contract.test.js

The probe table is printed as test diagnostics on every run, green or red.
