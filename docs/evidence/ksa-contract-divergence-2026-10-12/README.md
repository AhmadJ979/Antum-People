# Raw measurements — the KSA contract divergence and the template inventory

Taken 2026-10-12 on this host. `origin/main` = `a11d5c8`. Host pack at `/home/team/shared/templates`.

## Commands (re-runnable)

```bash
# inventory: md5 every file in both locations, verdict per pair
python3 - <<'PY'   # see inventory-md5.json / inventory-md5.txt for the output
# host: walk /home/team/shared/templates ; repo: git ls-tree -r origin/main templates/ + git show per blob
PY

# the KSA divergence, block by block
python3 -c "import difflib,io,subprocess; h=io.open('/home/team/shared/templates/ksa-employment-contract.md').read().splitlines(); r=subprocess.run(['git','show','origin/main:templates/ksa-employment-contract.md'],capture_output=True).stdout.decode().splitlines(); print([o for o in difflib.SequenceMatcher(None,h,r,autojunk=False).get_opcodes() if o[0]!='equal'])"

# the rendered artifact is stale against its own source
grep -o 'statutory retention\|retention period' /home/team/shared/templates/privacy-notice.html | sort | uniq -c
grep -o 'v2\.2\|v2\.3' /home/team/shared/templates/privacy-notice.html | sort | uniq -c

# the PDF could not be read here (no extractor; text is hex glyphs + ToUnicode CMap)
command -v pdftotext mutool qpdf gs; python3 -c 'import pypdf'  # all absent
```

## Key measurements

| measurement | value |
|---|---|
| host `ksa-employment-contract.md` | md5 `3518c1af4931afc7b5cd54d0689987e0`, 10662 bytes, mtime 2026-09-17 06:31 |
| repo `ksa-employment-contract.md` | md5 `1c6ad895d403e8caf75606eea8c3db05`, 10758 bytes, 223 lines |
| divergent blocks in that file | **3** (citation, the EOSB ladder, the notice clause) — see `ksa-contract-diff.txt` |
| divergent templates overall | **2 of 14 pairs** (KSA contract, privacy notice); 12 identical; 0 host-only; 0 repo-only |
| `privacy-notice.html` (both copies) | md5 `68c8478a0e5aa1a1988e60ca08fc7800`; contains `statutory retention` x2 and `v2.2` x4 while the repo `.md` reads "retention period" |
| UAE contract | md5 `f28dc42aa50e9b9ea3262af636f2d822` **in both** — proves a resolution change, not a content refresh |
| engine | `server/eosb.js` has no `notice` parameter at all — neither contract wording describes computed behaviour |
| serving path | `client/src/App.tsx:1564,1571,1579` → `GET /api/compliance/templates/:templateName/:employeeId` (`server/index.js:369`) → `server/privacy-notice.js` → repo `templates/` |

## Not verified, and said so

The three pack PDFs (`privacy-notice.pdf`, `data-processing-agreement.pdf`, `dpia-questionnaire.pdf`) could not be read on this
host: the text is hex-encoded glyphs behind a `ToUnicode` CMap and no PDF extractor is installed (`pdftotext`, `mutool`,
`qpdf`, `gs`, `pypdf`, `pdfminer`, `fitz` all absent). `zlib`-inflating the 12 content streams yields the drawing operators
(6,870 `Tj`/`TJ`) but no literal text, so **their wording is unverified**, not assumed-equal to the HTML. They share the
2026-09-18 08:31 batch mtime with the HTML and were rendered from the then-current `.md`, which still said "statutory retention" —
suggestive, not evidence. Regenerating the pack settles it.
