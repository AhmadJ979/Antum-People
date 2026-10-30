#!/usr/bin/env python3
"""Search /home/team/shared (outside the repository) for a second copy of any repository document.

Two questions, because a duplicate is not always byte-identical:
  BY NAME    - does any host file carry the same basename as a repository document?
  BY CONTENT - (a) BYTE-IDENTICAL: md5 of every host file against md5 of every repository document.
               (b) THE SAME TEXT, DRIFTED: an inverted index over long lines (>=60 chars) finds host files
                   that substantially share a repository document's text even if a header or a sentence
                   was edited - the drift case md5 alone cannot see.
Prints counts for every stage, so a zero result is a measured zero, not an unmeasured one.
"""
import hashlib
import os
import sys
from collections import Counter, defaultdict

REPO = "/home/team/shared/probable-octo-sniffle"
HOST = "/home/team/shared"
# Trees that are NOT "outside the repository": the repository itself, a second checkout/worktree of it
# (mine), and dependency trees. Each exclusion is named in the output with its file count.
SKIP_ABS = {
    os.path.join(HOST, "probable-octo-sniffle"),
    os.path.join(HOST, "wt-templates"),
    os.path.join(HOST, "site", "node_modules"),
}
SKIP_NAMES = {".git", "__pycache__", "node_modules"}
TEXTY = (".md", ".txt", ".html", ".htm", ".json", ".csv", ".js", ".ts", ".tsx", ".py", ".sh", ".css", ".yaml", ".yml")
MAX_READ = 4 * 1024 * 1024
LONG = 60


def md5(p):
    h = hashlib.md5()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def lines_of(p):
    if os.path.getsize(p) > MAX_READ or not p.lower().endswith(TEXTY):
        return set()
    try:
        with open(p, "r", encoding="utf-8", errors="replace") as f:
            return {ln.strip() for ln in f if len(ln.strip()) >= LONG}
    except OSError:
        return set()


# ---------------------------------------------------------------- the repository's documents
repo_template, repo_root_md, repo_docs_md, repo_docs_other = [], [], [], []
for dirpath, dirnames, filenames in os.walk(REPO):
    dirnames[:] = [d for d in dirnames if d not in SKIP_NAMES and not d.endswith("node_modules")]
    for f in filenames:
        p = os.path.join(dirpath, f)
        rel = os.path.relpath(p, REPO)
        if rel.startswith("templates/"):
            repo_template.append(rel)
        elif rel.startswith("docs/") and rel.endswith(".md") and not rel.startswith("docs/evidence/"):
            repo_docs_md.append(rel)
        elif rel.startswith("docs/"):
            repo_docs_other.append(rel)
        elif "/" not in rel and rel.endswith(".md"):
            repo_root_md.append(rel)

repo_all = repo_template + repo_docs_md + repo_docs_other + repo_root_md
repo_md5 = {}
repo_size = {}
repo_base = defaultdict(list)
for rel in repo_all:
    p = os.path.join(REPO, rel)
    repo_md5.setdefault(md5(p), []).append(rel)
    repo_size[os.path.getsize(p)] = repo_size.get(os.path.getsize(p), 0) + 0
    repo_base[os.path.basename(rel)].append(rel)

print("=" * 100)
print("DUPLICATE SEARCH - is any repository document copied outside the repository?")
print("  repository          : %s" % REPO)
print("  searched            : %s (excluding the trees named below)" % HOST)
print("  repository documents indexed by CONTENT (md5): %d" % len(repo_all))
print("      templates/ (a served document's authoritative home)      : %d" % len(repo_template))
print("      docs/*.md (live documents, docs/evidence/ treated as history): %d" % len(repo_docs_md))
print("      docs/ other files (evidence, data, scripts)              : %d" % len(repo_docs_other))
print("      repository root *.md (live documents)                   : %d" % len(repo_root_md))

# ---------------------------------------------------------------- every file outside the repository
host_files, excluded = [], Counter()
for dirpath, dirnames, filenames in os.walk(HOST):
    keep = []
    for d in dirnames:
        p = os.path.join(dirpath, d)
        if p in SKIP_ABS or d in SKIP_NAMES:
            n = sum(len(fs) for _, _, fs in os.walk(p)) if os.path.isdir(p) else 1
            excluded[os.path.relpath(p, HOST)] += n
            continue
        keep.append(d)
    dirnames[:] = keep
    for f in filenames:
        p = os.path.join(dirpath, f)
        if p in SKIP_ABS:
            excluded[os.path.relpath(p, HOST)] += 1
            continue
        if os.path.islink(p) or not os.path.isfile(p):
            excluded["(not a plain file) " + os.path.relpath(p, HOST)] += 1
            continue
        host_files.append(p)

print()
print("  host files examined : %d" % len(host_files))
print("  trees/locations EXCLUDED, with their file counts (each is not 'outside the repository' or not a document):")
for k, v in sorted(excluded.items()):
    if v:
        print("      %-44s %d" % (k, v))

# ---------------------------------------------------------------- BY NAME
host_base = defaultdict(list)
for p in host_files:
    host_base[os.path.basename(p)].append(os.path.relpath(p, HOST))
name_hits = [(b, repo_base[b], host_base[b]) for b in sorted(set(repo_base) & set(host_base))]
print()
print("  BY NAME   : repository document basenames: %d | host basenames: %d | COLLISIONS: %d"
      % (len(repo_base), len(host_base), len(name_hits)))
for b, r, h in name_hits:
    print("      NAME HIT %s\n          repository: %s\n          host      : %s" % (b, r, h))

# ---------------------------------------------------------------- BY CONTENT (byte-identical)
print()
print("  BY CONTENT (byte-identical): hashing all %d host files..." % len(host_files))
host_md5 = {}
byte_hits = []
for p in host_files:
    try:
        m = md5(p)
    except OSError as e:
        print("      unreadable: %s (%s)" % (p, e))
        continue
    host_md5[p] = m
    if m in repo_md5:
        byte_hits.append((os.path.relpath(p, HOST), repo_md5[m], os.path.getsize(p)))
print("  hashed %d of %d host files | BYTE-IDENTICAL MATCHES: %d" % (len(host_md5), len(host_files), len(byte_hits)))
for h, r, sz in byte_hits:
    print("      BYTE HIT %s (%d B)\n          == %s" % (h, sz, r))

# ---------------------------------------------------------------- BY CONTENT (same text, drifted)
print()
print("  BY CONTENT (the same text, DRIFTED - the case md5 cannot see):")
doc_lines = {}
for rel in repo_template + repo_docs_md + repo_root_md:
    s = lines_of(os.path.join(REPO, rel))
    if s:
        doc_lines[rel] = s
index = defaultdict(list)
for p in host_files:
    for ln in lines_of(p):
        index[ln].append(p)
print("      long-line index: %d distinct lines (>=%d chars) shared-indexed from %d host files"
      % (len(index), LONG, len(host_files)))
drift_hits = 0
for rel, dlines in doc_lines.items():
    score = Counter()
    for ln in dlines:
        for p in index.get(ln, ()):
            score[p] += 1
    for p, n in score.most_common():
        frac = n / len(dlines)
        if n >= 10 and frac >= 0.25:
            drift_hits += 1
            print("      DRIFT HIT %s\n          shares %d of %d long lines (%.0f%%) with %s"
                  % (os.path.relpath(p, HOST), n, len(dlines), frac * 100, rel))
print("      documents compared by text: %d | DRIFTED DUPLICATE CANDIDATES: %d"
      % (len(doc_lines), drift_hits))

print()
total = len(name_hits) + len(byte_hits) + drift_hits
print("VERDICT: %d host files examined against %d repository documents (%d templates, %d docs/*.md, %d root *.md, "
      "%d other docs files). Name collisions %d, byte-identical %d, drifted-text %d -> %s"
      % (len(host_files), len(repo_all), len(repo_template), len(repo_docs_md), len(repo_root_md),
         len(repo_docs_other), len(name_hits), len(byte_hits), drift_hits,
         "NO DUPLICATE FOUND" if total == 0 else "%d HIT(S) - see above" % total))
sys.exit(0)
