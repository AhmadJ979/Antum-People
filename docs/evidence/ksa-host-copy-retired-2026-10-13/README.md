# The KSA host copy — retired 2026-10-13

*Owner **decision 19**, executed under the procedure that §8 of `ksa-contract-divergence-ruling.md` already prescribed:
**retire it as the notice was** — bytes moved aside, nothing left at the path. That document now carries the note
(§10); this file is the raw record of the movement and of the measurements it ran on. Nothing here is a live claim
about the product.*

## 1. What moved

| | before | after |
|---|---|---|
| */home/team/shared/templates/ksa-employment-contract.md* (the path, named — it holds nothing now, so this is not a citation) | present — 10,662 B, md5 `3518c1af4931afc7b5cd54d0689987e0`, mtime 2026-09-17T06:31:32Z | **nothing at the path** — no pointer, no stub, no redirect |
| `/home/team/shared/templates/retired/` | one file — `privacy-notice.md.retired-9d2182a` (23,566 B) | that file, plus `/home/team/shared/templates/retired/ksa-employment-contract.md.retired-9d2182a` — 10,662 B, md5 `3518c1af4931afc7b5cd54d0689987e0`, mtime preserved |
| `/home/team/shared/templates/` | 12 files + `retired/` | 11 files + `retired/` |

The kept bytes are md5-identical to the bytes that stood at the path, and the retired filename is the one §8's
procedure prescribed. **The sha in that filename names the served tree** — `9d2182a`, the tree pid 1255 executes
(`readlink /proc/1255/cwd` → `/home/team/shared/probable-octo-sniffle/server`; `cmdline` → `node index.js`) — the same
tree the notice's retired copy names, so both files in `retired/` name one cutover.

Raw, after the move:

```
old path: No such file or directory
templates:
total 736
-rw-rw-r-- 1 root root  16545 2026-09-17T06:31:52Z breach-notification-letters.md
-rw-rw-r-- 1 root root   9936 2026-09-18T08:31:21Z build-html.js
-rw-rw-r-- 1 root root  24626 2026-09-18T08:31:21Z data-processing-agreement.html
-rw-rw-r-- 1 root root  19191 2026-09-18T08:31:21Z data-processing-agreement.md
-rw-rw-r-- 1 root root 158561 2026-09-18T08:31:21Z data-processing-agreement.pdf
-rw-rw-r-- 1 root root  18501 2026-09-18T08:31:21Z dpia-questionnaire.html
-rw-rw-r-- 1 root root  11214 2026-09-18T08:31:21Z dpia-questionnaire.md
-rw-rw-r-- 1 root root 208147 2026-09-18T08:31:21Z dpia-questionnaire.pdf
-rw-rw-r-- 1 root root   3018 2026-09-17T06:31:32Z final-settlement-statement.md
-rw-rw-r-- 1 root root  31446 2026-09-18T08:31:21Z privacy-notice.html
-rw-rw-r-- 1 root root 217970 2026-09-18T08:31:21Z privacy-notice.pdf
drwxr-sr-x 2 root root    109 2026-10-13T07:26:08Z retired
-rw-rw-r-- 1 root root  10824 2026-09-17T06:31:32Z uae-employment-contract.md

templates/retired:
total 36
-rw-rw-r-- 1 root root 10662 2026-09-17T06:31:32Z ksa-employment-contract.md.retired-9d2182a
-rw-rw-r-- 1 root root 23566 2026-09-18T08:31:21Z privacy-notice.md.retired-9d2182a
3518c1af4931afc7b5cd54d0689987e0  templates/retired/ksa-employment-contract.md.retired-9d2182a
```

## 2. The product cannot be affected — measured on the tree that is running

Every line below was read from the **served** tree, not from `main`; checking `main` alone would say nothing about what
is serving.

| measurement | result |
|---|---|
| the running process | pid 1255, `node index.js`, cwd `/home/team/shared/probable-octo-sniffle/server` |
| that tree's head | `9d2182a` |
| its KSA template | md5 `1c6ad895d403e8caf75606eea8c3db05`, 10,758 B, 223 lines — **identical to `origin/main`'s copy** |
| its resolution module (`server/privacy-notice.js`) | `const REPO_TEMPLATES_DIR = path.join(__dirname, '..', 'templates')` — every template path is built **inside the repository**; its docblock: *the host-shared directory is not consulted at all. A host copy that still exists is a duplicate, never a source* |
| its guard test (`server/privacy-notice.test.js`) | fails if any module under `server/` starts reading the host-shared directory again |
| any served `server/` module reading the host directory | **none** — `grep -rn '/home/team/shared' server/*.js` returns two comments and nothing executable |

**So no cutover is owed, and this is a custody move: the bytes a client downloads do not change.** The retirement is
invisible to the running product.

## 3. The citation sweep — what moved and what was deliberately left

Instrument: `pack-citation-resolver.py` (the re-implementation of the 2026-10-12 sweep's rules, `--file` mode added
for a single-file control run). Corpus = every `.md`/`.txt` in the pack outside the deployed tree, `skills/` and
`site/`.

| | before the move | after the move | after the dated note |
|---|---|---|---|
| pack documents in the corpus | 119 | **118** — the retired file is no longer a `.md` in the pack | 118 |
| citations | 964 | 964 | **966** (+2, both resolving) |
| resolving at the path written | 600 | 599 | 601 |
| canonical misses (unambiguous — the list the instrument prints) | 45 | **45** | **45** |

**One string in the whole corpus names the live host path, and it is the one above** (re-checked token by token: it
appears once, at the pointer's `:17`).

**The one string that changed state:** `/home/team/shared/ksa-contract-divergence-ruling.md:17` names
*/home/team/shared/templates/ksa-employment-contract.md*. Before the move it resolved; now the path holds nothing, and
the token matches a file **by basename only, ambiguously** (the repository copy and the served tree's copy carry that
name). It is **left exactly as written and declared, not re-pointed**: the paragraph it sits in is the record of the
state before the ruling, the appended note directly below says so in words, and it is **a historical quotation in a
dated record** — the class the 2026-10-12 sweep's ruling declared on 2026-10-13. The alternative — italicising a dated
record's markup so a resolver's count reads better — is the retro-fit that ruling refused.

Every other string that names this template is the **bare** form `templates/ksa-employment-contract.md`, which means
the repository and resolves — **8 citations, all at the path written**: `ksa-contract-divergence-ruling.md:43` (in the
pointer's appended note),
`ksa-report-refresh.md:99`, `ksa-report-refresh.md:136`, `notice-compensation-corrections.md:297`,
`ksa-option-b-verification.md:302`, `ksa-option-b-verification.md:317`,
`statutory-class-verification-20261006.md:68`, `tracker-round-40/README.md:93`. (Other documents mention the same
string in plain text rather than backticks — `notice-compensation-corrections.md:85`, `ksa-option-b-verification.md:31`
and `:260`, `statutory-class-verification-20261006.md:59` — and the instrument does not count a non-backticked
mention.)

Two citations the ruling document had left as **future targets** now resolve, because the file they name exists:
`ksa-contract-divergence-ruling.md:197` and `:229` both name
`/home/team/shared/templates/retired/ksa-employment-contract.md.retired-9d2182a`. Nothing was edited to make that
happen — the retirement landed on the path the procedure had already written down, which is the loop closing on the
document that prescribed it.

The appended block's own citations: **2**, both resolving
(`/home/team/shared/templates/retired/ksa-employment-contract.md.retired-9d2182a` and the bare
`templates/ksa-employment-contract.md`).

## 4. What was not touched

| file | md5 |
|---|---|
| `templates/ksa-employment-contract.md` (repository copy — what the product serves) | `1c6ad895d403e8caf75606eea8c3db05` |
| `templates/privacy-notice.md` (the notice, v2.3) | `6004b0a5b23ac5aa68415da5e45ec2cd` |
| `/home/team/shared/pdpl-counsel-request--send-ready.txt` (the frozen letter) | `62a0051dc08d622db180716f6eeb3a29` |
| `/home/team/shared/pdpl-counsel-request.md` (the frozen memo) | `b6fa19e824d7010db6890a79abb352ab` |

The KSA switch's header visibility is a **separate** decision (owner decision 8) and is not touched here.

## 5. The documents the movement wrote

| document | before | after |
|---|---|---|
| `/home/team/shared/ksa-contract-divergence-ruling.md` (pack pointer) | md5 `7b86896eba4846f1d355ea265f34f629`, 1,806 B, 24 lines | md5 `13e1cacdf69c3f82d953a594c5fc5b8b`, 3,641 B, 48 lines |
| `ksa-contract-divergence-ruling.md` (repository, this PR) | md5 `1baf0edee751c827eb960a57cdaf7550`, 26,692 B, 296 lines | md5 `aacbcb89a636ef93217f80836c168025`, 29,205 B, 326 lines |

Both are **appends**: in each, every pre-existing line is byte-identical (checked by `bytes.startswith(old)`, not by
eye). Neither dated record's own text or citations were rewritten.

## 6. How to re-run it

| script | what it does |
|---|---|
| `/home/team/shared/scripts/retire-ksa-host-copy.py` | `--check` prints the state; default performs the move, refusing if it has already run, if the destination exists, or if the source's bytes differ from the ruling's |
| `/home/team/shared/scripts/append-ksa-retirement-note.py` | `--pack` / `--repo` appends the dated note to the pointer or the ruling, refusing a second append and proving the prefix |
| `/home/team/shared/scripts/pack-citation-resolver.py` | the sweep; `--file PATH` for the single-document control run |
