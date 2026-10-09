# Board removal — the two superseded parent rows (2026-10-09)

**Task `6e6f77c1-b46c-4a3e-831d-7df3bce42e6c`** — *"[Board] Remove the two superseded parent rows (2c37f2da, 62d7142b) once db4e7b1c and aa6c9bd7 land"*, assigned to agent-program-manager. **The lead created the row and instructed the removal by assigning it** (the skill requires the lead to instruct, not the remover to decide). This directory is the record the row asked for.

## Why these two rows were removed
When the lead started the All-chip race fix and the API response-shape recommendation he created **new** rows instead of assigning the existing ones, so the board carried the same work twice: the parents sat `backlog` and unassigned while their successors were in flight. Each successor names its parent **in its own title**, so traceability never depended on the parents staying on the board — the duplication was visual and arithmetic, not informational. Removal is therefore hygiene, not loss.

## The trigger, measured (read 2026-10-09T15:13:26Z)
Both successors must be `done` before this runs. **Both are:**

| predecessor (removed below) | successor | status |
| --- | --- | --- |
| `2c37f2da-1fa1-4b1c-8117-c639c5880658` | `db4e7b1c` — All-chip race fix | `done` |
| `62d7142b-955a-433e-8f42-1c07a5d67ee3` | `aa6c9bd7` — response-shape standard, report only | `done` |

## Before state (read 2026-10-09T15:13:26Z)

Board: **backlog=12 · done=135 · in-progress=1** — row total **148**.

| id | status | assigned_to | created_by | created_at | title |
| --- | --- | --- | --- | --- | --- |
| `2c37f2da-1fa1-4b1c-8117-c639c5880658` | backlog | — | lead | 2026-10-09 12:12:54 | [L2 UI] A selected All chip can render over the previous case's narrowed board while the All re-fetch is in flight (measured, low severity) |
| `62d7142b-955a-433e-8f42-1c07a5d67ee3` | backlog | — | lead | 2026-10-07 13:43:07 | [L2 API] Two read endpoints answer in different shapes (bare array vs envelope) — decide the standard before the ATS adapter |

## The parents’ descriptions, verbatim

Preserved **before** any deletion, as the row required — a removal that keeps the text is not a loss. The same two records, machine-readable and unfenced, are in [`rows.json`](rows.json) in this directory (written from the board before the deletes, so it is the pre-removal state).

### `2c37f2da-1fa1-4b1c-8117-c639c5880658` — [L2 UI] A selected All chip can render over the previous case's narrowed board while the All re-fetch is in flight (measured, low severity)

*status backlog · assigned_to — · created_by lead · created_at 2026-10-09 12:12:54*

```
Measured on the served surface during the rendered pass (evidence in docs/evidence/p2-4-served-pass/race-samples.json on main, merged as #103). Filing it because the engineer who measured it declined to file it himself, and because it is the one rendering behaviour a prospect could actually see.

**What it is:** while the unfiltered (`All`) re-fetch for a case is in flight, the screen can show the `All (n) [SELECTED]` chip over the board as it was last rendered for a different function — i.e. a selected All chip above a narrowed board. Sampled sequence: t=57061…58933 ms, chips `All (14)[SEL] · IT (5) · Admin (3) · HR (2) · Manager (4)` with only the IT group rendered (`IT · 0/5`) and header `0 of 5 done · 5 past due`; at t=60592 ms the full group set (IT 0/5 · ADMIN 0/3 · HR 0/2 · MANAGER 0/4) and header `0 of 14 done · 7 past due` appear.

**Two limits, stated so nobody over-reads it:** the window was **widened by a client-side induced fetch delay (2.5 s)** — the product was not modified, but the natural-latency duration is therefore unmeasured; and it is **not** a data leak — the filtered read is never served as the unfiltered board, which the pass verified in both directions. The visible effect is the chip and the board disagreeing for a tick, which a slow connection would make more likely.

**Fix direction (not prescriptive):** do not render a cached narrow board under a selected `All` chip — either treat the mode switch as a loading state, or key the client cache by case+mode so a narrowed board cannot be reused for an unfiltered view. Whatever the approach, the acceptance is: with a deliberately delayed `/workspace` response, a `All`-selected chip never renders alongside a narrowed group set.

Unassigned and low severity — it sits behind the two fixes already in progress (the storage-decision header and the intake form's accessible names) and does not block a demo. It matters because it is the only rendering defect this cycle a prospect could see for themselves.
```

### `62d7142b-955a-433e-8f42-1c07a5d67ee3` — [L2 API] Two read endpoints answer in different shapes (bare array vs envelope) — decide the standard before the ATS adapter

*status backlog · assigned_to — · created_by lead · created_at 2026-10-07 13:43:07*

```
The two Layer 2 read endpoints answer in different shapes, and it produced a false negative in a real seeder during the P2-2 browser pass — reported by the engineer, documentary rather than a live defect, but it will bite the next caller.

- `GET /api/preboarding/cases` returns a **bare JSON array**.
- `GET /api/preboarding/checklist/overview` returns an **envelope**: `{cases, totals}`.

The seeder assumed the wrapped shape for both, printed "0 case(s)" while the rows were present, and cost a cycle. The same trap is waiting for the future ATS adapter (a stated reason the single case-creation path exists) and for any test that asserts on the list endpoint.

WHY IT IS WORTH A ROW RATHER THAN A SHRUG: two read endpoints on one feature, one shape each, is the small version of the defect the single-writer rule exists to prevent — a caller cannot know without reading the implementation. It is also cheap to settle now, while the only caller is our own client, and expensive later when an integration depends on the current shape.

WHAT TO DECIDE FIRST (the reason this is not just an edit): standardising means changing one endpoint's response shape, which touches the client and any test asserting on it. So the task starts with a written recommendation and the blast radius, not a commit:
1. Which shape becomes the standard — bare array or envelope — and why. (An envelope can carry totals and pagination later without breaking callers; a bare array is simpler but leaves nowhere to put metadata. State the trade-off rather than picking silently.)
2. Every caller and test that would change, named with file and line.
3. Whether a compatibility period is needed or whether the client is the only consumer and can move in the same PR.

Then implement the agreed shape, keep both endpoints consistent, and prove it: `cd server && node --test` green on the same count as main (57 across four files, plus any new test), and a raw HTTP run showing both endpoints' shapes side by side on a scratch instance.

NOT IN SCOPE: the roll-up's jurisdiction scoping (its own fix), the item model, the seed, storage, and anything in the frozen engine files.

QUEUED: backlog, unassigned. The lead assigns it in layer order — it does not gate the seed or the roll-up fix.
```

