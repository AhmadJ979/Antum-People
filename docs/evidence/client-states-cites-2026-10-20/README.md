# Evidence for `design-concepts/CLIENT-STATES.md` — 2026-10-20

Row `66636525` (product-designer). **Four measurements and one refutation, because this document was re-cut
once and the tree moved three times under it.**

## The two trees of the document

| revision | blob | md5 | state |
|---|---|---|---|
| as **merged** — PR #244, `8ec9f69` | `567bfd49a63b00ded44cf7bc22ea3953ce534b08` | `e8234aafab2c22f92896c4b2191d721f` | **was on `main`** from PR #244 until PR #246 merged (`1f471ef`); carries the refuted sentences |
| this revision | `60d7d064a68b54fdf20c80c4a28525cb96b4194d` | `c1aedfa4016aab718df2d097575ccd36` | measured at `0e401cf`, corrected at `8ec9f69`; §5a and §5c added after the lead measured the pair-rejection at `ea6a531` and I re-verified it there and at `8ec9f69`; **merged as PR #246, `1f471ef`, 2026-10-20T09:21:41Z** |

This file states the second row's hashes because **a file cannot carry the hash of the bytes a reader is
currently holding** — the value above was taken from the frozen blob *before* this README was written, and
nothing in the document was edited afterwards.

## What happened, in order

1. The draft was cut from `ee4bbdf` and asserted the client had no 403 handling at all. **PR #241**
   (`client/session-vs-refusal`) merged as `0e401cf` while the draft was being written and shipped that
   handling, so the draft's central premise was refuted mid-write. Generation 1 is kept: it is the measurement
   that establishes the premise had moved.
2. The document was rewritten from scratch at `0e401cf`. Generation 2 checks its 72 claims.
3. `main` moved to `70cdd91` (PR #245, the `users.employee_id` index control), then to `8ec9f69`
   (PR #242, round 52's cutover evidence). Measured, not assumed: **neither touches a file cited here**, and
   the same 72-claim checker re-run at each holds **72/72** with its control reddening at **71/72**.
4. **The lead reported a fifth state at the served tree `ea6a531`** — a screen partly allowed rendering empty
   because one refused sibling rejects a two-item `Promise.all`. **Verified by me, not restated:** the mechanism
   is at `App.tsx:594`/`:598` and `:997`/`:1000` at `ea6a531` **and** `8ec9f69`. Specified in §5a; the notice's
   wording (the lead's second point) is set in §5c.
5. **The draft itself merged as PR #244 at `8ec9f69`**, one second before its withdrawal could land. `main`
   therefore **carried** the refuted sentences from that merge until this correction landed as **PR #246**
   (`1f471ef`, 2026-10-20T09:21:41Z). **That merge is the end of the window; the sentence is past tense here for
   the reason the whole directory exists** — a claim about a tree is true of a revision, and `main` moved.

## The files

| file | what it is |
|---|---|
| `verify-states-cites-ee4bbdf.py` | **generation 1** — the checker for the draft's 46 claims, resolved with `git show ee4bbdf:<path>` |
| `verify-states-cites-ee4bbdf.txt` | its output at `ee4bbdf` — **46/46**, rc 0 |
| `negative-control-ee4bbdf.py` | generation 1's control — one claim falsified (`server/auth.js:26` `status(401)` → `status(499)`) |
| `negative-control-ee4bbdf.txt` | its output — **45/46**, FAIL, rc 1 |
| `verify-cites-0e401cf.py` | **generation 2** — the checker for this revision's 72 claims, resolved with `git show 0e401cf:<path>` |
| `verify-cites-0e401cf.txt` | its output at `0e401cf` — **72/72**, rc 0 |
| `negative-control-0e401cf.py` | generation 2's control — one claim falsified (`server/index.js:65` `Forbidden` → `Teapot`), aimed at the §4 finding this document is *about* |
| `negative-control-0e401cf.txt` | its output — **71/72**, FAIL, rc 1 |
| `verify-cites-70cdd91.txt` | **re-check 1** — generation 2 with `REV` replaced, **72/72**, rc 0 |
| `negative-control-70cdd91.txt` | its control, `REV` replaced — **71/72**, FAIL, rc 1 |
| `verify-cites-8ec9f69.txt` | **re-check 2** — generation 2 with `REV` replaced, **72/72**, rc 0 |
| `negative-control-8ec9f69.txt` | its control, `REV` replaced — **71/72**, FAIL, rc 1 |
| `verify-merged-claim.py` | **the refutation** — re-runs the *merged document's own* counting method at the revision it used and at the revision it is served from |
| `verify-merged-claim-8ec9f69.txt` | its output — **the sentence HELD at `ee4bbdf` and is FALSE at `8ec9f69`**, rc 0 |

**The four re-check logs are logs, not scripts, on purpose.** A copy of a 72-claim list per revision would be
four more things to keep in step. Each header states the exact `sed` that reproduces it and nothing else.

**The refutation, in one line.** The merged text concludes *"The client contains no 403 handling at all"* and
*"There is no `403` branch anywhere"* from `git grep -c '403' -- client/`, which returned one hit — an SVG path
coordinate. Re-run at `8ec9f69`: **four files, three of them source** (`App.tsx` ×2, `httpStatus.js` ×12,
`httpStatus.test.js` ×11). The count was right when taken; the tree it described is not the tree `main` has.
That is why the script exists as a runnable artifact and not as a paragraph.

**The control reddened on a bug in itself, once.** `verify-merged-claim.py` first classified every hit as
*not source*, because it split `git grep`'s `<rev>:<path>:<count>` on the first colon and got the revision
back. Its own verdict line caught it — `0 in source, 4 not` is impossible — and the bug is recorded in the
function's docstring. A check that cannot redden proves nothing; this one reddened on itself before it was
allowed to pass.

**Generation 1's control script was rebuilt, and it reproduces its own filed log.** The v1 pack filed the
control's *output* with no script. It has been recreated from `verify-states-cites-ee4bbdf.py` by falsifying
the same single claim, and its output matches `negative-control-ee4bbdf.txt` **line for line** — the only
difference being the header and `rc=1` trailer written by hand around the original run (`diff`: `0a1,2` and
`49a52,53`; zero differences inside the 46 claim lines).

**Three v1-named copies were retired, not deleted blind.** The merged pack filed `verify-states-cites.py`,
`verify-states-cites.txt` and `negative-control.txt`. Each is **byte-identical** to the corresponding
`-ee4bbdf` artifact above (md5 `f30edcee…`, `a9f083eb…`, `349f153c…` — verified before removal), so retiring
them loses no bytes and removes a second copy of one run.

**md5 of each artifact** (the fourteen files above; this README carries no hash of itself, because writing one
into itself changes it):

```
ff2be42038eca3ef3ad1eebb369310e4  negative-control-ee4bbdf.py
349f153c321ff9cb0cf3c396df1d9b7f  negative-control-ee4bbdf.txt
f30edcee0e8369a073983ae0b755b4bf  verify-states-cites-ee4bbdf.py
a9f083eb9b554ae4b4e2e14d6f64b431  verify-states-cites-ee4bbdf.txt
e9aab1e01239d3de8ab8273f438258ae  verify-cites-0e401cf.py
f77c387087a45fd67570682249103809  verify-cites-0e401cf.txt
e9760d0716caeee1185d6dcea8483bc7  negative-control-0e401cf.py
4d15141f90859d6d909929df4362f93d  negative-control-0e401cf.txt
9c3c0cb9c481c021d2cf076ad9c5bcfd  verify-cites-70cdd91.txt
f1029df7eb01b45afb79df39908c9491  negative-control-70cdd91.txt
60865b24f810812e141d99191a1e8970  verify-cites-8ec9f69.txt
33e81cae844db89e89dc344e791720d3  negative-control-8ec9f69.txt
4411f719ee0eec3363ffb661d55ba3eb  verify-merged-claim.py
2de3596fb997a7f8076bd7f3be3f78d3  verify-merged-claim-8ec9f69.txt
```

**Re-run any of it:** `cd <this clone> && python3 docs/evidence/client-states-cites-2026-10-20/<script>`
The scripts read through `git show`, so the working tree does not need to be at the revision; it does need to
be inside the repository, with that revision fetched.

## Limits, stated

1. Each cite check tests that the cited line **contains the string I claim it contains**; it does not test that
   the string *means* what the document says it means. **This is the exact failure this whole directory is
   about**: the merged text's counts were accurate and its conclusion was false. A check that only compares
   line numbers cannot catch that class, which is why the refutation is a *separate* script that reproduces a
   conclusion from its own method.
2. It covers the cites in the document's prose and tables. Numbers inside the two code blocks are in the claim
   list by their own entries, so a renumbering inside a block is caught.
3. **Nothing here was rendered.** The document's four states (and the fifth event it names, §5) are derived
   from code paths, not photographed against the live product — a credentialed pass there is out of bounds for
   this row. The render proof is owed by whoever builds the fix (§3, §9).
4. Each control falsifies **one** claim. It proves the checker reddens; it does not prove every individual
   claim is load-bearing, and a claim whose string appears twice in a file would pass either way.
5. A re-check proves the claims hold at a revision the document does not name in its body; it does **not**
   re-derive the document's *readings* of those lines (§4's rule: a check must test the role a string plays).
6. The refutation script pins `REV_NEW` to `8ec9f69`. After any later merge, re-point it — a stale `REV_NEW`
   would keep asserting falsity about a tree nobody serves, which is the same defect one level up.
