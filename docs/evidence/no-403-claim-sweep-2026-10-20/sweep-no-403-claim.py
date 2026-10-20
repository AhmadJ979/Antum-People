#!/usr/bin/env python3
"""Sweep EVERY tracked .md for the claim class: "the client has no 403 handling".

Run against any revision:   python3 sweep-no-403-claim.py <rev>      (default HEAD)
Prints, in order: the denominator (files scanned / files mentioning 403), every
claim-class hit with file:line and the sentence around it, and a second pass for the
SAME claim phrased WITHOUT the digits ("no refusal branch", "unhandled refusal", ...).
A hit is not a defect: a quotation of the refuted sentence inside narration about it is
a record, not a live claim. The sweep names the site; a reader decides the role.
"""
import subprocess, re, sys, io

rev = sys.argv[1] if len(sys.argv) > 1 else "HEAD"

def show(p):
    return subprocess.run(["git", "show", f"{rev}:{p}"], capture_output=True, text=True).stdout

files = [f for f in subprocess.run(["git", "ls-tree", "-r", "--name-only", rev],
         capture_output=True, text=True).stdout.split("\n") if f.endswith(".md")]
print(f"=== SWEEP for the claim class 'the client has no 403 handling' at {rev}")
print(f"tracked .md scanned: {len(files)}")

bodies = {f: show(f) for f in files}
ment = [f for f, s in bodies.items() if "403" in s]
print(f"of those, mentioning '403' at all: {len(ment)}")
for f in ment:
    i = bodies[f].find("403"); ln = bodies[f].count("\n", 0, i) + 1
    a = bodies[f].rfind("\n", 0, i) + 1; b = bodies[f].find("\n", i)
    print(f"    {f}:{ln}  {re.sub(r'\s+',' ',bodies[f][a:b if b>0 else len(bodies[f])])[:120]}")

# whitespace-tolerant: a sentence that wraps is still one sentence
PATS = {
    "no-403-handling":  r"no\s+`?403`?\s+handling",
    "403-nowhere":      r"`?403`?\s+nowhere",
    "no-403-branch":    r"no\s+`?403`?\s+branch",
    "handles-only-401": r"(?:handles?|handle)\s+`?401`?[^.]{0,40}(?:only|nothing\s+else)",
    "401-nothing-else": r"401\s+and\s+nothing\s+else",
    "only-401":         r"only\s+`?401`?",
    "403-unhandled":    r"403[^.]{0,30}unhandled|unhandled[^.]{0,30}403",
    "403-not-handled":  r"403[^.]{0,30}not\s+(?:be\s+)?handled",
    "no-handling-403":  r"no\s+handling\s+for\s+(?:a\s+)?403",
}
# same claim, no digits
PATS_NODIGIT = {
    "no-refusal-branch":  r"no\s+refusal\s+branch",
    "refusal-unhandled":  r"(?:refusal|refusals)[^.]{0,25}unhandled|unhandled[^.]{0,25}refusal",
    "refusal-not-handled": r"refusal[^.]{0,30}not\s+handled",
    "cannot-tell-refusal": r"cannot\s+tell\s+a\s+refusal",
    "only-handles-401":   r"only\s+handles?\s+401|handles?\s+401\s+alone|401\s+handling\s+only",
}

def pass_(label, pats):
    hits = []
    for f, s in bodies.items():
        for name, p in pats.items():
            for m in re.finditer(p, s, re.I):
                ln = s.count("\n", 0, m.start()) + 1
                hits.append((f, ln, name, re.sub(r"\s+", " ", s[max(0, m.start()-100):m.end()+150])))
    print(f"\n=== {label}: {len(hits)} hit(s)")
    for f, ln, name, seg in sorted(hits):
        print(f"  {f}:{ln}  [{name}]\n      ...{seg}...")
    return hits

h1 = pass_("PASS 1 — the claim WITH the digits", PATS)
h2 = pass_("PASS 2 — the same claim phrased WITHOUT the digits", PATS_NODIGIT)

# the class's stale cousin: a citation into the client pinned at a revision that has moved
print("\n=== PASS 3 — `App.tsx:<n>` citations in the two design docs that carry this claim:")
for f in ["design-concepts/README.md", "design-concepts/LAYER3-IDENTITY.md", "design-concepts/CLIENT-STATES.md"]:
    s = bodies.get(f)
    if s is None: continue
    for m in re.finditer(r"`?App\.tsx`?[::]\s*(\d+)", s):
        n = int(m.group(1)); ln = s.count("\n", 0, m.start()) + 1
        actual = show("client/src/App.tsx").split("\n")
        cur = actual[n-1] if n-1 < len(actual) else "<past EOF>"
        print(f"  {f}:{ln} cites App.tsx:{n} -> at {rev} that line is: {re.sub(r'\s+',' ',cur)[:100]}")
print(f"\n=== END. claim-class hits: {len(h1)} with digits, {len(h2)} without.")
