#!/usr/bin/env python3
"""Compare the .md twin and the .txt send-ready copy as WORD STREAMS.

The .md decorates with `##` headings, `**` emphasis and `` ` `` code spans; nothing else may
differ. We strip only that decoration and compare the token lists, so a word, a number or a
punctuation mark that differs shows up as a differing token with its position.

Both copies are read from THIS script's own directory - the repository copy at
counsel/uae-2026-11/ - so the check judges the tree it is checked out in and works from any
worktree or clone. A missing copy is exit 2 (REFUSED: nothing compared), never a pass.
"""
import os
import re
import sys
import difflib

HERE = os.path.dirname(os.path.abspath(__file__))
MD = os.path.join(HERE, "uae-counsel-confirmation-request.md")
TXT = os.path.join(HERE, "uae-counsel-confirmation-request--send-ready.txt")


def tokens(path, markdown):
    text = open(path, encoding="utf-8").read()
    if markdown:
        text = re.sub(r"(?m)^#+\s*", "", text)   # heading markers (md only)
    # Both copies carry `**` emphasis (md only) and backticks (BOTH: the .txt quotes
    # `file:line` literally), so the decoration set is stripped from both sides.
    text = text.replace("**", "").replace("`", "")
    return text.split()


def main():
    for p in (MD, TXT):
        if not os.path.isfile(p):
            print("REFUSED: a copy of the letter is missing - NOTHING WAS COMPARED")
            print("  missing: %s" % p)
            print("  the two copies must sit beside this script (counsel/uae-2026-11/).")
            return 2
    a = tokens(MD, True)
    b = tokens(TXT, False)
    print("md  tokens (decoration stripped): %d" % len(a))
    print("txt tokens:                      %d" % len(b))
    if a == b:
        print("WORD STREAMS IDENTICAL: yes (0 differing tokens)")
        return 0
    print("WORD STREAMS IDENTICAL: NO")
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    n = 0
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            continue
        n += 1
        print("  %-8s md[%d:%d]=%r  txt[%d:%d]=%r" % (tag, i1, i2, a[i1:i2], j1, j2, b[j1:j2]))
    print("differing regions: %d" % n)
    return 1


if __name__ == "__main__":
    sys.exit(main())
