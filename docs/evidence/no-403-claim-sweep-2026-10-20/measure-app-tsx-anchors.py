#!/usr/bin/env python3
"""Measure every client-source anchor the LAYER3-IDENTITY design cites, at two revisions.

    python3 measure-app-tsx-anchors.py <old-rev> <new-rev>
Prints, per anchor, the line at each revision, and whether a client/server diff separates them.
This is how the file's stale citations were found: its own header excused them with
"git diff --name-only <old> origin/main -- client server is empty".
"""
import subprocess, re, sys
old, new = sys.argv[1], sys.argv[2]
def A(rev): return subprocess.run(["git","show",f"{rev}:client/src/App.tsx"],capture_output=True,text=True).stdout.split("\n")
a0, a1 = A(old), A(new)
print(f"App.tsx: {old}={len(a0)} lines   {new}={len(a1)} lines   delta=+{len(a1)-len(a0)}")
d = subprocess.run(["git","diff","--name-only",old,new,"--","client","server"],capture_output=True,text=True).stdout.strip()
print(f"git diff --name-only {old} {new} -- client server:\n{d if d else '(empty)'}")
ANCHORS = {
 "sidebar comment":            r"\{/\* Sidebar \*/\}",
 "Sign Out button":            r'title="Sign Out"',
 "identity card, name line":   r"\|\| 'Admin User'",
 "identity card, role line":   r"\|\| 'Administrator'",
 "recorded-by print #1":       r"recorded by \{",
 "recorded-by print #2":       r"` \u00b7 show",
 "checklistNotice state":      r"const \[checklistNotice",
 "checklistNotice banner":     r"checklistNotice &&",
 "login heading":              r"Antum People</h2>",
 "login form":                 r"<form onSubmit=\{handleSubmit\}",
 "dismiss button (ml-3)":      r"ml-3",
 "error icon (mr-2)":          r"mr-2",
 "space-x-3 (brand row)":      r"space-x-3",
}
def hit(lines, pat):
    return [(i+1, lines[i].strip()[:70]) for i in range(len(lines)) if re.search(pat, lines[i])][:2]
print(f"\n{'anchor':30} {old:>10}   {new:>10}")
for name, pat in ANCHORS.items():
    h0, h1 = hit(a0, pat), hit(a1, pat)
    print(f"{name:30} {str([n for n,_ in h0]):>10}   {str([n for n,_ in h1]):>10}")
