#!/usr/bin/env python3
"""Every class token the product writes in markup must survive in the built CSS.

This is the acceptance check for a narrowed scan: a build whose stylesheet is smaller is only safe if
nothing the MARKUP asks for disappeared. Tokens are taken from the raw .tsx/.html text (attributes and
template literals), dynamic `${...}` fragments are dropped, and each remaining token is looked for in the
built CSS with CSS escaping applied.

Reported per file, and per token: FOUND / MISSING. Marker classes (group, peer) legitimately emit no rule,
so the honest measure is not "zero misses" but "the miss set does not grow when the scan is narrowed".
"""
import re
import sys
import glob

ESC = {c: '\\' + c for c in '/.:%(),#!\'>*+[]{}&~^$=|'}


def css_selector_for(token):
    return '.' + ''.join(ESC.get(c, c) for c in token)


def tokens_in(path):
    text = open(path).read()
    out = []
    for attr in re.findall(r'(?:className|class)\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|\{`([^`]*)`\})', text):
        raw = next((a for a in attr if a), '')
        raw = re.sub(r'\$\{[^}]*\}', ' ', raw)          # drop dynamic fragments
        for tok in raw.split():
            if tok and not tok.startswith('$') and len(tok) > 1:
                out.append(tok)
    return out


def css_text(path):
    return open(path).read()


if __name__ == '__main__':
    marker = sys.argv[1]                        # label, e.g. BEFORE / AFTER
    css = css_text(sys.argv[2])
    files = sorted(glob.glob('client/src/**/*.tsx', recursive=True)) + ['client/index.html']
    all_tokens, missing = {}, {}
    for f in files:
        toks = tokens_in(f)
        all_tokens[f] = len(toks)
        miss = sorted({t for t in toks if css_selector_for(t) not in css})
        if miss:
            missing[f] = miss
    total = sum(all_tokens.values())
    uniq = len(set(t for f in files for t in tokens_in(f)))
    print(f'=== {marker} (css={sys.argv[2]}) ===')
    print(f'files scanned for markup: {len(files)} | tokens found: {total} ({uniq} unique)')
    print(f'tokens with NO rule in this CSS: {len(set(t for v in missing.values() for t in v))}')
    for f, miss in missing.items():
        print(f'  {f}: {", ".join(miss)}')
