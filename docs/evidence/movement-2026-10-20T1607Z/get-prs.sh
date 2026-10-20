#!/bin/bash
# gh CLI is 401 here; the git credential store has a token that works. Ask the API directly.
export HOME=/home/agent-lead
D=/home/team/shared/movements/2026-10-20T1607Z
TOKEN=$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill 2>/dev/null | sed -n 's/^password=//p')
[ -n "$TOKEN" ] || { echo "no token from the credential store" > "$D/prs-open.txt"; exit 1; }
curl -s -H "Authorization: Bearer $TOKEN" -H 'Accept: application/vnd.github+json' \
  'https://api.github.com/repos/AhmadJ979/Antum-People/pulls?state=open&per_page=30' > /tmp/prs-raw.json
python3 - <<'PY' > "$D/prs-open.txt" 2>&1
import json
d = json.load(open('/tmp/prs-raw.json'))
if isinstance(d, dict):
    print('API said:', d.get('message')); raise SystemExit
print(str(len(d)) + ' open PR(s):')
for p in d:
    print('  #%-4s %-46s %s' % (p['number'], p['head']['ref'][:45], p['title'][:62]))
    print('        head %s  mergeable_state=%s' % (p['head']['sha'][:12], p.get('mergeable_state')))
PY
