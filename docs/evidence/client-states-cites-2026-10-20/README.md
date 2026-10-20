# Citation check for `design-concepts/CLIENT-STATES.md` — 2026-10-20

Row `66636525` (product-designer). Read at `origin/main` = `ee4bbdf`.

| file | what it is |
|---|---|
| `verify-states-cites.py` | the checker — 46 `(path, line, must-contain)` triples, each resolved with `git show ee4bbdf:<path>` |
| `verify-states-cites.txt` | its raw output at `ee4bbdf` — **46/46 claims hold**, rc 0 |
| `negative-control.txt` | the same checker with **one** claim falsified (`server/auth.js:26` `status(401)` → `status(499)`) — **45/46, FAIL, rc 1**, printing the line it actually landed on |

**Re-run it:** `cd <this clone> && python3 docs/evidence/client-states-cites-2026-10-20/verify-states-cites.py`
The script reads through `git show`, so the working tree does not need to be at `ee4bbdf`; it does need to be
inside the repository.

**Why the control is the point.** A checker whose claims are all true proves nothing about whether it *can*
fail — a run that cannot go red is a run that would have gone green on a wrong number too. The falsified run is
what makes 46/46 mean something.

**Limits, stated.** (1) This checks that each cited line **contains the string I claim it contains**; it does not
check that the string *means* what the document says it means. (2) It covers the cites in the document's prose
and tables, not the two code blocks' inline `// :NNN` comments by their own logic (those numbers are in the
claim list). (3) Nothing here was **rendered**: the document's four (five) states are derived from code paths
read at `ee4bbdf`, not photographed against the live product — a credentialed pass there is out of bounds. The
render proof is owed by whoever builds the mechanism (§7).
