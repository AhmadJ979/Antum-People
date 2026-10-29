# The three decided typefaces

Owner decision, 2026-10-29: **Cairo** for Arabic in the product interface, **Noto Naskh Arabic** for
legal documents and the on-screen document preview, **Noto Kufi Arabic** for the `أنتم` wordmark.
The Arabic form of the *product* name is **not** decided and no file here assumes one.

Each family has its own directory, holding the served font file and that family's `OFL.txt` in the
same directory, because the SIL Open Font License requires the licence to travel with the font.

```
cairo/cairo-arabic.woff2                       58,556 B   md5 4b42d306847d28a53555a0a2c5b7965a
noto-naskh-arabic/noto-naskh-arabic.woff2      83,740 B   md5 b62b3a8c76006438f396f8d878f1162d
noto-kufi-arabic/noto-kufi-arabic.woff2       110,092 B   md5 5f08fbaf5a27f8ce85b56f90663c818b
```

`client/public/` is copied verbatim into the build by Vite (the same mechanism that ships
`favicon.svg` and `icons.svg`), so these files are served at `/fonts/<family>/<file>.woff2`.

## Provenance

Upstream project: **google/fonts** (<https://github.com/google/fonts>), branch `main` at commit
`6157dfaa640ca5738b4d1a7070fe389c3036d7fc`, fetched 2026-10-29. Source files and their md5s, which
the fetched bytes matched byte-for-byte:

| family | upstream path | source md5 |
| --- | --- | --- |
| Cairo | `ofl/cairo/Cairo[slnt,wght].ttf` (599,548 B, variable `wght` 200–1000, `slnt` −11–11) | `0e355a997fd3fdc3a2a5d13ba68a6fd0` |
| Noto Naskh Arabic | `ofl/notonaskharabic/NotoNaskhArabic[wght].ttf` (307,592 B, variable `wght` 400–700) | `3a7ec93ba2306756b72cc0ef938c78bc` |
| Noto Kufi Arabic | `ofl/notokufiarabic/NotoKufiArabic[wght].ttf` (434,204 B, variable `wght` 100–900) | `01fdf0ce8b52148fdcac032eaa49ecf9` |

## What was done to the bytes, and why it is allowed

The fonts are **subsets**: only the Arabic Unicode ranges were kept (U+0600–06FF, U+0750–077F,
U+08A0–08FF, U+FB50–FDFF, U+FE70–FEFF) and the file was converted to WOFF2. Everything else — Latin,
punctuation, the OpenType shaping features Arabic actually needs — is gone or untouched as follows:
`init`, `medi`, `fina`, `rlig`, `ccmp`, `locl`, `dlig` and (where upstream has them) `liga`, `pnum`,
`tnum` are **retained**, and the variable axes are kept, so `font-weight` still resolves to a real
instance rather than to a synthesised emboldening.

**Reserved Font Name check — the licence question, answered from the licence text itself.** For all
three families the shipped `OFL.txt` declares **no** Reserved Font Name. The copyright line is the
whole of the declaration, and it carries no such clause:

```
cairo/OFL.txt              Copyright 2009 The Cairo Project Authors (https://github.com/Gue3bara/Cairo)
noto-naskh-arabic/OFL.txt  Copyright 2022 The Noto Project Authors (https://github.com/notofonts/arabic)
noto-kufi-arabic/OFL.txt   Copyright 2022 The Noto Project Authors (https://github.com/notofonts/arabic)
```

The only occurrence of the phrase "Reserved Font Name" in each file is the licence's own definition
("Reserved Font Name" refers to any names specified as such after the copyright statement(s).) — a
definition, not a reservation. Because no name is reserved, a modified version may keep the family
name, so subsetting is permitted and these files keep the names `Cairo`, `Noto Naskh Arabic` and
`Noto Kufi Arabic` in their `name` tables.

## How to regenerate

`pyftsubset` comes from `fonttools` with the `brotli` extra (needed for WOFF2):

```
python3 -m venv /tmp/ftvenv && /tmp/ftvenv/bin/pip install fonttools brotli
U='U+0600-06FF,U+0750-077F,U+08A0-08FF,U+FB50-FDFF,U+FE70-FEFF'
/tmp/ftvenv/bin/pyftsubset Cairo.ttf           --unicodes="$U" --layout-features='*' --flavor=woff2 \
  --output-file=cairo/cairo-arabic.woff2
/tmp/ftvenv/bin/pyftsubset NotoNaskhArabic.ttf --unicodes="$U" --layout-features='*' --flavor=woff2 \
  --output-file=noto-naskh-arabic/noto-naskh-arabic.woff2
/tmp/ftvenv/bin/pyftsubset NotoKufiArabic.ttf  --unicodes="$U" --layout-features='*' --flavor=woff2 \
  --output-file=noto-kufi-arabic/noto-kufi-arabic.woff2
```

The ranges above are exactly the ranges the `@font-face` rules in `src/index.css` and
`templates/build-html.js` declare, so a face never claims a character it cannot draw and never
claims one it has no glyph for. `client/src/typefaces.test.js` reads both sides and fails if they
drift apart.
