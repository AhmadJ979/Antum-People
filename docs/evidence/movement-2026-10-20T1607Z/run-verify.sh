#!/bin/bash
# The movement's own after-state: live verification, then the suites at the DEPLOYED tree
# (a branch or scratch figure is a prediction; the deployed tree is the evidence).
set -u
export HOME=/home/agent-lead
TREE=/home/team/shared/probable-octo-sniffle
D=/home/team/shared/movements/2026-10-20T1607Z

bash "$D/verify-live.sh" > "$D/verify-live.console" 2>&1
echo "verify-live exit=$?" >> "$D/verify-live.console"

DB=$(mktemp /tmp/antum-suite-XXXXXX.db)
cd "$TREE/server" || exit 1
PRODUCT_DB_PATH="$DB" node --test > "$D/suite-server.out" 2>&1
echo "server suite exit=$?" >> "$D/suite-server.out"
grep -E '^# (tests|pass|fail|skipped)' "$D/suite-server.out" | tail -6 >> "$D/suite-server.out"

cd "$TREE/client" || exit 1
npx vitest run --reporter=basic > "$D/suite-client.out" 2>&1
echo "client suite exit=$?" >> "$D/suite-client.out"
grep -E 'Tests +[0-9]|Test Files' "$D/suite-client.out" | tail -4 >> "$D/suite-client.out"
echo "suites done $(date -u +%H:%M:%SZ)" >> "$D/verify-live.console"
rm -f "$DB"
