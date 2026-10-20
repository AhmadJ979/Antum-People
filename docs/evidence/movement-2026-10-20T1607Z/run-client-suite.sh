#!/bin/bash
# The client suite, run the repository's own way. Kept beside the wrong run rather than replacing it:
# my first attempt used `npx vitest run --reporter=basic`, and this repo has no vitest at all
# (client/package.json: "test": "node --test src/*.test.js"). npx then installed vitest@5.0.5 from the
# registry and died on the reporter - a rig with the wrong dependencies entirely, which is the same
# class the plan already records ("a rig without its dependencies is a rig report, not a tree report").
set -u
export HOME=/home/agent-lead
TREE=/home/team/shared/probable-octo-sniffle
D=/home/team/shared/movements/2026-10-20T1607Z
mv -f "$D/suite-client.out" "$D/suite-client-WRONG-vitest.out" 2>/dev/null
cd "$TREE/client" || exit 1
npm test > "$D/suite-client.out" 2>&1
echo "client suite (npm test) exit=$?" >> "$D/suite-client.out"
grep -E '^# (tests|pass|fail|skipped)' "$D/suite-client.out" | tail -6 >> "$D/suite-client.out"
