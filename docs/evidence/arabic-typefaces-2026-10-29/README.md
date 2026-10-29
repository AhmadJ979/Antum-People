# The three decided typefaces — evidence, 2026-10-29

Owner decision (2026-10-29): **Cairo** = Arabic in the product interface; **Noto Naskh Arabic** =
legal documents and the on-screen document preview; **Noto Kufi Arabic** = the `أنتم` wordmark
(family wired; the mark itself is a later change). **Latin appearance must not change anywhere.**

Branch `feat/arabic-typefaces`, cut from `origin/main` = **`414a007`** (#338 had already merged; this
work is not based on #338's branch). Every count below was read from that tree, built in place.

## What changed

| file | what |
| --- | --- |
| `client/public/fonts/{cairo,noto-naskh-arabic,noto-kufi-arabic}/` | one WOFF2 subset per family + that family's `OFL.txt` + a `README.md` with provenance, the licence finding and the regeneration command |
| `client/src/index.css` | three `@font-face` rules, each carrying the five Arabic `unicode-range`s; `--font-sans` (Cairo first), `--font-document` (Naskh first), `--font-mark` (Kufi first) |
| `client/src/App.tsx` | the document-preview container: `font-serif` → `font-document` (one word) |
| `templates/build-html.js` | Naskh `@font-face` + first family of the rtl stack; the builder now **throws** if the font file is absent |
| `client/src/typefaces.test.js` | the guard (new) |

## Shipped bytes

| font | bytes | md5 | upstream (google/fonts `main` = `6157dfaa…`, fetched 2026-10-29) |
| --- | --- | --- | --- |
| `cairo/cairo-arabic.woff2` | 58,556 | `4b42d306847d28a53555a0a2c5b7965a` | `ofl/cairo/Cairo[slnt,wght].ttf` md5 `0e355a99…` |
| `noto-naskh-arabic/noto-naskh-arabic.woff2` | 83,740 | `b62b3a8c76006438f396f8d878f1162d` | `ofl/notonaskharabic/NotoNaskhArabic[wght].ttf` md5 `3a7ec93b…` |
| `noto-kufi-arabic/noto-kufi-arabic.woff2` | 110,092 | `5f08fbaf5a27f8ce85b56f90663c818b` | `ofl/notokufiarabic/NotoKufiArabic[wght].ttf` md5 `01fdf0ce…` |

Subsetting is permitted: **none of the three licences declares a Reserved Font Name** — the copyright
line is the whole declaration and the only occurrence of the phrase is the licence's own definition.
Full sentence-by-sentence reading is in `client/public/fonts/README.md`.

## Counts before → after, same tree, sha named

- **Client suite** (`cd client && npm test`, 9 suites both sides): **68 tests / 0 fail → 71 tests /
  0 fail** (71 = 68 + the guard's 3 tests). Both figures measured in this tree.
- **Emitted stylesheet**: before **36,900 B, md5 `6ddad6c879d0b03bf895c56547d5c031`** — byte-identical
  to the stylesheet the public URL serves today — after **37,757 B, md5 `cadbb3b6e01a4d5d232a9d3205a40497`**.
  The delta is the three `@font-face` rules, the three stack variables and the `.font-document` rule;
  the minifier compressed `U+0600-06FF` to `U+6??` (same code-point set).
- **Interface visible change: none.** The client's `src/` carries **zero Arabic characters**, so with
  no Arabic on screen nothing renders in Cairo yet. This change is the wiring, not a visible result.
- The JS bundle in `client/dist` grew for an unrelated reason: **#338 is merged but not deployed**, so
  `index-vsGFc45L.js` (290,270 B) is a build of `414a007`, not of the served tree. The only JS this
  change touches is one class name in `App.tsx`.

## The guard, and the two reddens it was proved with

The guard reports **44 checks, 0 failures** in the clean tree (its test name carries the count). Transcripts:

- `guard-run-clean.txt` — 44/44 at `414a007`, md5s printed with the revision.
- `guard-run-plant-a.txt` — the Cairo face's `unicode-range` deleted from `src/index.css`:
  **`RED interface-arabic: unicode-range on the Cairo face … Found NO unicode-range`**, and the run's
  own headline drops to 43/44. Reverted; `src/index.css` md5 back to `281d0c0a017efe38df1a73cb73b00c0f`.
- `guard-run-plant-b.txt` — the **emitted** stylesheet's Cairo `url()` pointed at
  `/fonts/cairo/absent.woff2`: **`RED emitted: url(/fonts/cairo/absent.woff2) resolves in the build …
  no such file in the built output`**. Reverted; emitted CSS md5 back to `cadbb3b6…`.
- Note on both plant transcripts: the run shows **2** failing tests, not 1. The second is the guard's
  own self-check, which copies the tree and refuses to attribute a plant while the tree it copies is
  itself red — deliberate, and the reason the "clean 0 red / plant(a) 1 red / plant(b) 1 red /
  reverted 0 red" line exists.
- The same two plants also run **automatically every time** (`typefaces self-check: clean 0 red /
  plant(a) 1 red / plant(b) 1 red / reverted 0 red, on 44 checks`), and a third control proves the
  **derive-or-refuse** rule: with no `client/dist` the guard is **7 red**, refusing with the command
  to run, never green.

## The honest limits

1. **The guard cannot see a font that fails to load in a browser.** It reads text and bytes: a face
   referenced correctly, present, WOFF2-shaped and still refused by the browser (wrong
   `Content-Type`, a corrupt table, a CSP that blocks fonts) reddens nothing here. The follow-up that
   closes it is a rig check on `document.fonts.ready` + `document.fonts.check('16px Cairo', 'أنتم')`,
   **out of scope for this change**; it is named in the guard's header and in the PR body.
2. **The print pipeline's reference is relative to `templates/`** (`../client/public/fonts/...`),
   because the builder writes its output there. If those HTML files are copied elsewhere before
   being rendered, the reference must move with them. Also: only 3 of the 7 templates have a print
   config at all — `privacy-notice`, `data-processing-agreement`, `dpia-questionnaire`. The two
   employment contracts and the settlement statement produce **no** printable output, before or after
   this change; no coverage was invented for them.
3. **The committed HTML and PDFs were not regenerated in this PR.** `node templates/build-html.js`
   does pick the change up (transcript below), but its output also carries **unrelated** drift already
   in the working tree (the notice's v2.2 → v2.3 text and the retention wording), so committing the
   regenerated HTML would smuggle a legal-text version bump into a font change. The PDFs cannot be
   regenerated here at all (they were produced by headless Chrome, `/Producer (Skia/PDF m148)`).
   The Arabic in the next regeneration will be Naskh; the PDFs on disk are still the old ones.
4. The builder's loud failure, seen by hand (`client/public/fonts/noto-naskh-arabic/*.woff2` moved
   aside, then restored):

```
$ node templates/build-html.js
Error: build-html: missing font file /home/team/shared/probable-octo-sniffle/client/public/fonts/noto-naskh-arabic/noto-naskh-arabic.woff2
  The print pipeline references the shipped subsets under client/public/fonts/ (regenerate them as described in client/public/fonts/README.md, or fix the path here).
  Refusing to build: a document built without its Arabic face would print in a system face and nothing in the file would say so.
```
