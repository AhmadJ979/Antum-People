# The served stylesheet moved 30 bytes, and the cause is one word in a comment

**Question (row 2f39da0c):** between `ea6a531` and `7a4e00a` the only `client/` delta was
`httpStatus.js` + `httpStatus.test.js` — a comment and its test — yet the served stylesheet changed
(35,775 B -> 35,805 B) while the JS bundle did not. 30 bytes: real, served, and unexplained.

**Answer: those 30 bytes are exactly Tailwind's `collapse` utility, emitted because the word
`collapse` appears in prose.**

## The measurements

| Revision | Stylesheet | Bytes | md5 |
|---|---|---|---|
| `ea6a531` | `index-CK8SfGWm.css` | 35,775 | `8ec48273f4bd7e4f37c55e2cc6ae2f1d` |
| `7a4e00a` (served) | `index-DvmxiaxC.css` | 35,805 | `3709a147a167307b5f46c2ecbc3e0431` |

Both were reproduced here byte-exactly from a worktree (`npx vite build`; `tsc -b` is not involved in
the stylesheet). The 30-byte difference is `byte-diff.txt`, in full — nothing else differs anywhere in
the file:

    bytes ONLY in the new file: b'collapse{visibility:collapse}.'

i.e. the rule `.collapse{visibility:collapse}`.

## The mechanism, and the proof that it is the whole cause

`client/src/index.css` is `@import "tailwindcss"` and `@vitejs/plugin-tailwindcss` v4 auto-detects its
content sources: it scans the project's text files for class-shaped tokens and emits whatever it finds.
A token does not have to be a class in markup — **prose counts.** The #249 delta introduced the word:

* `client/src/httpStatus.js:54` — `* must collapse.`
* `client/src/httpStatus.test.js:58` — `'two body-carrying 403s with different meanings collapse to one branch here'`

`collapse` is a real Tailwind utility (`visibility: collapse`), so the scanner emitted it. Two carriers,
one token, one rule — the token is what matters, not the file.

**Sufficiency, measured (`build-old-tree-plus-the-word.log` — the file itself carries the commands, both
builds' emitted name/size/md5, and the comparison; it needs `git add -f`, because `.gitignore` ignores
`*.log` and `git add -A` silently skipped it the first time this pack was committed):** take the OLD tree (`ea6a531`, which
emitted 35,775 B) and append a single line — `// collapse` — to `httpStatus.js`, and nothing else. It
emits **`index-DvmxiaxC.css`, 35,805 B, md5 `3709a147a167307b5f46c2ecbc3e0431`** — the served
stylesheet, byte for byte. The word alone accounts for the whole 30 bytes.

**Necessity** is the byte-diff itself: the two stylesheets are byte-identical outside that one rule, so
there is no second cause left to find.

## What this means

1. **A stylesheet byte-delta is not evidence of a styling change, and its absence is not evidence of
   none.** Prose in any scanned file — a comment, a test name, a docstring — can add or remove a real
   utility. The team's own rule ("a claim about a tree has to be measured") needs its converse here:
   *the bytes moved* is not the same claim as *someone changed the styles.*
2. **It will recur.** Every future comment is a candidate; `index-DvmxiaxC.css` is not stable across
   revisions that touch no styling at all.
3. **What moved and what did not, measured** (`build-old-tree-plus-the-word.log`, section 4): adding that
   one comment line left the emitted JS **bytes identical** — `fd270c84cb2b34a2df5372a6e93505c8` in both
   builds — while the emitted **filename** moved (`index-B9iywLcl.js` -> `index-CRGdjEGs.js`). So a
   comment-only change moves filenames and the stylesheet, and changes no JS byte; esbuild strips the
   comment, but vite's chunk name is not a hash of the emitted bytes alone, and Tailwind's scanner reads
   the text *before* it is stripped. That is the exact shape of the 09:30 cutover this row was about.
   (This sentence replaces an earlier one here that said a comment-only change "cannot move the JS": the
   filename demonstrably moves, and the corrected claim is the measured one.)
4. **A candidate mitigation, not applied here:** Tailwind v4 can be told to ignore sources, e.g.
   `@source not "../src/**/*.test.js"`, or the source set can be narrowed. That is a `client/` change
   owing a movement, so it is the lead's to schedule, not a silent edit riding this note.
