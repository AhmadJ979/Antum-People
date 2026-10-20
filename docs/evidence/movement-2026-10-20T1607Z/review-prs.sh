#!/bin/bash
export HOME=/home/agent-lead
D=/home/team/shared/movements/2026-10-20T1607Z
team-db "SELECT id, status, assigned_to, result FROM tasks WHERE id IN ('9d1e0746-2b1f-47b6-95d7-d73c4bee370f','bedb1a89-6ab8-45a9-9f55-2dbf7e014682','33943cd4-d2ca-4675-8794-669a5cf7f0e4')" > "$D/task-results.txt" 2>&1
TOKEN=$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill 2>/dev/null | sed -n 's/^password=//p')
for n in 273 274; do
  {
    echo "===== PR #$n ====="
    curl -s -H "Authorization: Bearer $TOKEN" "https://api.github.com/repos/AhmadJ979/Antum-People/pulls/$n" \
      | python3 -c "
import json,sys
p=json.load(sys.stdin)
print('title:',p.get('title'))
print('base:',p.get('base',{}).get('ref'),'head:',p.get('head',{}).get('ref'))
print('mergeable:',p.get('mergeable'),'state:',p.get('state'),'merged:',p.get('merged'))
print('body:', (p.get('body') or '')[:1200])
"
    curl -s -H "Authorization: Bearer $TOKEN" "https://api.github.com/repos/AhmadJ979/Antum-People/pulls/$n/files?per_page=50" \
      | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('files changed:',len(d))
for f in d[:25]: print('   %-58s +%s -%s' % (f['filename'], f['additions'], f['deletions']))
"
  } >> "$D/pr-review.txt" 2>&1
done
