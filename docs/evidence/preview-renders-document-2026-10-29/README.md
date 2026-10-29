# The document preview renders the document — before/after on an isolated rig

**2026-10-29 · branch `fix/preview-renders-the-served-document`, base `d2631d6` · client-only change.**
A deployment movement is owed once this merges; it was NOT run from here, and the live product on
port 3000 was left alone (`live3000=200` before and after).

## The defect, and the two builds it was measured between

The preview built its body as `<pre>{renderedTemplate.content}</pre>` around a `prose prose-slate`
wrapper that emitted no CSS (`@tailwindcss/typography` is not a dependency of this client). A reader
who clicked **Settlement Statement** was therefore shown the *markup* of the served document.

| | commit | bundle | bytes | md5 |
|---|---|---|---|---|
| before | `d2631d61f3785e3eaaf4e254783a4ad61462f6e8` (`origin/main`) | `assets/index-C7z2ZG3I.js` | 283,688 | `2d1a032cb986e75168f4f83244b69dc8` |
| before css | same | `assets/index-CSQHlfh4.css` | 35,932 | `2cdb30957b86cca3e6c9df949a0c2c40` |
| after | branch head (see the PR) | `assets/index-CP1ZKxf8.js` | 288,360 | `8c68368e4aabd2754114d9677b3c102d` |
| after css | same | `assets/index-oig5HhTF.css` | 36,900 | `6ddad6c879d0b03bf895c56547d5c031` |

Both halves were built with the repo's gate, `cd client && npm run build` (`tsc -b && vite build`),
from trees cut at the commit named — the "before" build ran in a pristine detached worktree at
`origin/main`. It reproduced the **deployed** bundle name and md5 (`index-C7z2ZG3I.js`,
`2d1a032c…`), which is the check that the before-shot really is the shipped client and not a
neighbour of it.

## The rig

`/home/agent-lead/rig`, a detached worktree at `d2631d6`, its own database
`/home/agent-lead/rig/rig.db` (seeded demo: 14 employees), its own throwaway credential `scratch`
(never the demo credential), port **4761**. The server printed its own scratch banner:

```
[port] SCRATCH INSTANCE on port 4761 with database /home/agent-lead/rig/rig.db. The public URL
reaches port 3000; nothing outside this host can reach this one.
```

The rig's DB was proved to be its own, not the live one: `SELECT COUNT(*) FROM users WHERE
username='scratch'` = **1** (`SCRATCH_USER_ROWS=[{"n":1}]`), `EMPLOYEES=[{"n":14}]`.

Subject: **`demo-emp-yusuf` (Yusuf Hassan, terminated, AE)** — Employee Directory → the row →
`Settlement Statement`.

## What the two shots are of, and the DOM reading taken in the same breath as each

Each shot carries its own bundle name on the image (a black strip naming the rig, the asset and which
side of the pair it is), because rule 25 wants a screenshot to state the page it came from.

| | served asset | `<pre>` | `[dir=auto]` | `<h1>` | raw `# Document not issued` | raw `**NOT ISSUED.**` |
|---|---|---|---|---|---|---|
| before | `index-C7z2ZG3I.js` | **1** | 0 | none | **true** | **true** |
| after | `index-CP1ZKxf8.js` | **0** | **1** | `Document not issued / …` | **false** | **false** |

The served content is the SAME refusal on both sides — the route answered `issued: false` with 10
`missing_fields`, and the body it sent (`# Document not issued / …`, `**NOT ISSUED.**`, the missing
list) is filed beside this note as `served-content-final-settlement-statement.txt`
(md5 `f40951ce0033989bd0e356611984409e`, 944 bytes), captured from the same rig.

Shots (all four in this directory, md5 of the PNG as committed):

| file | md5 | what it shows |
|---|---|---|
| `settlement-preview-before.png` | `f7e6cfb6fed61fbf3d1e01d73ebc9c34` | the shipped client printing the refusal's markup in monospace |
| `settlement-preview-after.png` | `0ce2ae01bda7e711be2a87bce9617c12` | the branch rendering the same refusal as a document |
| `privacy-notice-preview-before.png` | `ffd500e2bfdc5c38f5bb77278851ddcd` | same defect on the Privacy Notice button |
| `privacy-notice-preview-after.png` | `8bfdbc374110bbb94c5867364c446c06` | same fix, same button |

Two browser sessions were used, one per bundle — the page was never reused across the swap.

**One reading of the live data worth recording:** all three documents the preview offers refuse on
today's records (`Privacy Notice` and `Labor Contract` render the same "Document not issued" body).
So no *issued* document — and therefore no rendered bilingual table — can be photographed from this
demo at all. The table/inline/bilingual rendering is proved instead by the committed suite, which
renders the **real template bytes** through the same view with `react-dom/server` and compares the
rendered text against the served text with the markers removed (`client/src/markdown.test.js`, 13 of
the 57 client tests).

## The pinned figure

`client/src/money.js` pins `en-AE`. The control runs the real module in a child process with
`LC_ALL=ar_EG.UTF-8`:

```
control (ar-EG): pinned=1,234,567.50 unpinned=١٬٢٣٤٬٥٦٧٫٥٠ arabicDigits=true
```

## What this does not prove

- No Arabic strings, no language state and no layout mirroring were added. `dir="auto"` on the
  preview container and on table cells is a declaration of direction for text we serve; it is **not**
  evidence that an RTL layout works.
- The sidebar, the tables outside the preview, the forms and the other two modals are still LTR.
- The served legal Arabic is untouched.
