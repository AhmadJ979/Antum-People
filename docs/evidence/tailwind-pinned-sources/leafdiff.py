#!/usr/bin/env python3
"""Compare two built Tailwind stylesheets at the LEAF-RULE level.

Why not a line diff: the built stylesheet is two lines. Why not nested-block comparison: a change inside
a rule makes every ancestor look changed. So: normalize whitespace (the CSS minifier formats differently
for different rule sets, which is formatting, not styling), then take every `selector{declarations}` with
no nested braces - the leaf rules the browser applies - and diff those multisets.

Whitespace normalization is safe for the comparison and is stated in the output: we compare two builds of
the same pipeline and care about WHICH declarations exist, not how the minifier spaced them.
"""
import re
import sys
from collections import Counter

LEAF = re.compile(r'([^{}]+)\{([^{}]*)\}')


def leaves(css):
    flat = re.sub(r'\s+', '', css)
    return [(sel.strip(), body.strip()) for sel, body in LEAF.findall(flat)]


a_path, b_path = sys.argv[1], sys.argv[2]
a_css = open(a_path).read()
b_css = open(b_path).read()
A, B = leaves(a_css), leaves(b_css)
ca, cb = Counter(A), Counter(B)
removed = sorted((ca - cb).elements())
added = sorted((cb - ca).elements())

print(f'A = {a_path}  ({len(a_css)} B, {len(A)} leaf rules)')
print(f'B = {b_path}  ({len(b_css)} B, {len(B)} leaf rules)')
print(f'REMOVED {len(removed)} leaf rule(s) | ADDED {len(added)} leaf rule(s)')
print('(compared on whitespace-normalized text: which declarations exist, not how they were spaced)\n')

print('--- ADDED (a pure narrowing has none) ---')
for sel, body in added or [('', '(none)')]:
    print(f'  {sel} {{ {body} }}')
print()
print('--- REMOVED ---')
for sel, body in removed or [('', '(none)')]:
    print(f'  {sel} {{ {body} }}')

if removed:
    print('\n--- the declarations that left, in full ---')
    for sel, body in removed:
        print(f'  {sel}: {body}')
