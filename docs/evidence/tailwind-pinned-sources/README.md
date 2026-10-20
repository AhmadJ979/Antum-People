# Tailwind's scanned sources are pinned to the files that carry markup (row `022ff68b`)

**The defect this closes.** `client/src/index.css` was a bare `@import "tailwindcss"`. With automatic
source detection, Tailwind v4 scans **raw text** — comments, docstrings, test names, JSON, READMEs —
not just class attributes. So prose moved the shipped stylesheet: the sentence in `src/httpStatus.js:54`
(*"must collapse."*) and the test name in `src/httpStatus.test.js:58` emitted
`.collapse{visibility:collapse}` into the served CSS, moving its bytes and its hash **for a comment**
(named by the closed row `2f39da0c`; the 30 bytes were real and are now explained on both sides).

A stylesheet byte-delta is not evidence of a styling change, and no delta is not evidence of none. This
change removes the mechanism rather than the symptom.

## The change

```
-@import "tailwindcss";
+@import "tailwindcss" source(none);
+
+@source "../index.html";
+@source "../src/**/*.tsx";
```

`source(none)` turns automatic detection off; the two entries are the files that can carry markup. The
emitted utility set now depends on markup and on nothing else, whoever writes prose where. Add a file
that carries class names to that list, or its utilities are never emitted (the guard below fails first).

## Before / after — both builds, raw tail, exit 0 (`build-tails.txt`)

| | stylesheet | bundle |
|---|---|---|
| **before** | `index-DvmxiaxC.before.css` (as built: `dist/assets/index-DvmxiaxC.css`) **35,805 B**, md5 `3709a147a167307b5f46c2ecbc3e0431` | `index-CovU_C3n.js` 277.79 kB |
| **after** | `index-BK_EwcpZ.after.css` (as built: `dist/assets/index-BK_EwcpZ.css`) **35,306 B**, md5 `cb54e6164a8e741ed807bac94577efcd` | `index-C9vf7pQB.js` 277.79 kB |

The **before** build reproduces the *served* stylesheet byte for byte (`3709a147…`, 35,805 B), so the
comparison is against what clients actually receive. The bundle line is the same size in both; the JS
**filename** moves only because the CSS filename it references moved — a comment-only or CSS-only change
can move the JS name while the bytes stay the same length, which is why the figure is quoted as bytes.

**499 bytes fewer.** Every one of them is accounted for.

## Which rules left, and why each was safe to lose (`leaf-diff.txt`)

The built stylesheet is two lines, so a line diff is useless and a nested-block diff blames every
ancestor. `leafdiff.py` compares **leaf rules** (selector + declarations, no nested braces) on
whitespace-normalized text, and prints the additions too. Result: **8 removed, 1 "added"** — and the one
addition is the same universal block minus five variables, not a new rule.

| rule that left | where its word actually occurs | why losing it is safe |
|---|---|---|
| `.collapse{visibility:collapse}` | `src/httpStatus.js:54` (docstring sentence), `src/httpStatus.test.js:58` (test name) | No markup uses the class. The only markup mention is the **different** class `border-collapse` (`App.tsx:1498`), whose rule `.border-collapse{border-collapse:collapse}` is present in **both** builds — measured. This is the 30-byte defect itself, now gone. |
| `.transform{transform:var(--tw-rotate-x,)…}` | `src/App.css:45,54` — `transform: perspective(…)` **declarations** in the hand-written stylesheet | Emitted because Tailwind read the *word* `transform` in a CSS declaration, not because any element has the class. Nothing in markup carries `transform`. |
| `@property --tw-rotate-x` · `--tw-rotate-y` · `--tw-rotate-z` · `--tw-skew-x` · `--tw-skew-y` (5) | same | These registrations exist only to back `.transform`; with it gone they are dead weight. |
| — the universal `*,:before,:after,::backdrop` block | — | Reported as "removed + added" because its text changed: it loses exactly the five rotate/skew variables above. Not a new rule. |

**Nothing the markup asks for was lost.** `coverage.py` extracts every class token from the `.tsx`
sources and `index.html`, drops `${…}` fragments, and looks each one up in the built CSS with CSS
escaping applied:

| | tokens | unique | tokens with no rule in this CSS |
|---|---|---|---|
| `class-coverage-before.txt` | 2,249 | 311 | **5** — `animate-in`, `fade-in`, `prose`, `prose-slate`, `slide-in-from-bottom-4` |
| `class-coverage-after.txt` | 2,249 | 311 | **5** — *the same five* |

The miss set is **identical**, so the narrowing removed nothing a markup element asked for. The five are
pre-existing and unrelated: `prose`/`prose-slate` need `@tailwindcss/typography` and the three
animation classes need `tailwindcss-animate`; neither plugin is installed. That is a separate open item,
recorded here rather than fixed in a hygiene change.

## The control: the narrowing takes effect (`narrowing-control.txt`)

Same shape as the closed row's control — plant a real utility word and require the rule's presence or
absence to follow. The word is **`columns-3`**, a real Tailwind utility that occurs nowhere in the tree
and in neither stylesheet, so its presence is caused by the plant and nothing else. Each branch rebuilds
and reads the CSS out of `dist/`; `narrowing-control.py` restores every file afterwards.

| branch | configuration | planted in | built CSS | `.columns-3` |
|---|---|---|---|---|
| **A — hazard** | `@import "tailwindcss"` (auto) | `src/httpStatus.test.js` (**excluded** by the pin) | `index-Nb0zHQBU.css` 35,826 B | **PRESENT** — `.columns-3{columns:3}` (+21 B) |
| **B — narrowed** | pinned | `src/httpStatus.test.js` | `index-BK_EwcpZ.css` 35,306 B | **ABSENT** — byte-identical to the unplanted build |
| **C — alive** | pinned | `src/App.tsx` (**scanned**) | `index-ovttDLAW.css` 35,327 B | **PRESENT** (+21 B) |

All three builds exit 0. **A** is what makes **B** mean something: without it, "absent" could just mean
the word was never a valid candidate. **C** is what makes **B** mean the pin, not a broken build. The
CSS of each branch is committed (`control-A-hazard.css`, `control-B-narrowed.css`, `control-C-alive.css`)
so the claim is re-derivable from the artifacts, not from this table.

An incidental second proof: `index.css`'s own comment quotes `.collapse{visibility:collapse}` verbatim,
and it is **not** a scanned source — so the narrowed build contains no `.collapse`, although the
stylesheet's own text now contains the token. The stylesheet does not scan itself.

## The residual risk, guarded rather than stated (`client/src/tailwindSources.test.js`)

The cost of pinning: a utility that exists **only** as a string in an excluded file stops being emitted,
and if runtime code builds such a class name, the style is missing at runtime with nothing failing.
Checked before narrowing, and true today: **all class names live in `.tsx`** — `className`/`class=` does
not occur in any `src/*.js`, `src/*.css` or `index.html`; and no `src/*.js` contains a class-name
literal. All dynamic class construction (`className={`… ${cond ? 'a' : 'b'}`}`) is inside `App.tsx`,
where the literal strings are still in scanned text.

Because that property can be broken by a future commit, the guard asserts three things and each can
redden alone (`guard-control.txt`, `guard-control.py`):

| assertion | planted fault | result |
|---|---|---|
| automatic detection stays off, and the declared sources still name the markup | `source(none)` removed from `index.css` | exit 1, **exactly one** failure: *"automatic source detection is off…"* |
| every class-attribute-carrying file is inside the declared sources, or is a `NON_MARKUP` entry with its reason | `// className="p-4"` appended to `httpStatus.js` | exit 1, **exactly one** failure: *"every class-carrying file is inside the declared sources…"* |
| no quoted class-name list hides outside the declared sources | `const tone = 'bg-amber-50 border-amber-200';` appended to `panelResults.js` | exit 1, **exactly one** failure: *"no class-name list hides outside the declared sources"* |

Green baseline in the same script: `# pass 26 / # fail 0`, exit 0. (The first draft of the RED 1 plant
was JSX inside a `.js` module — a syntax error that also crashed two importing test files. The evidence
above is from the **fixed, valid-JS** plant; the over-red run is what showed the plant was wrong.)

`NON_MARKUP` is an exact list, and the test fails if an entry stops being needed — the two Vite SVGs carry
`class` attributes (`iconify iconify--logos`, `parenthesis`) but are imported by nothing, and an SVG used
as an image never receives the page stylesheet, so excluding them loses nothing.

**Limits, stated plainly:** assertion 3 is a regex over quoted text — it can catch the common shape
(a helper returning a class list) and cannot prove absence. It is a gate, not a proof. And the pin is
file-level: a class name inside a *scanned* file still counts, prose or not, which is exactly why the
declared list is short and the guard watches it.

## This owes a movement — it must not be its own

`client/` is refreshed by a movement, so this change carries one. It is **not** a movement of its own and
it is **not** bundled into a docs PR: it rides the next genuinely client- or server-bearing movement,
together with the `scripts/` change merged in #266. Until that movement runs, the deployed tree keeps the
old stylesheet (`3709a147…`) and the old source set.

## Re-running any of this

```bash
cd client && npm run build                        # then read dist/assets/index-*.css
python3 docs/evidence/tailwind-pinned-sources/leafdiff.py <before.css> <after.css>
python3 docs/evidence/tailwind-pinned-sources/coverage.py AFTER <after.css>   # run from the repo root
python3 docs/evidence/tailwind-pinned-sources/narrowing-control.py            # 3 builds, restores files
python3 docs/evidence/tailwind-pinned-sources/guard-control.py                # 4 suite runs, restores files
```

The scripts assert their own preconditions (the old/new stylesheet states, that the planted word is
unique to the plant) and record the build's tail and exit code beside each figure.
