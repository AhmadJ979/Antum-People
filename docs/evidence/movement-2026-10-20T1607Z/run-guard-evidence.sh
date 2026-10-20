#!/bin/bash
# Guard-fix evidence for the 16:08:51Z movement (58acdac), in two halves.
#  1. the shipped unit test, pointed at the PRE-fix revision (2b14a94) as the defect: it must count the
#     decoys on OLD and none on NEW, and count the real loop on BOTH (the anti-vacuous control).
#  2. the live arm acceptance: the arm must SUCCEED while naming probes are alive.
set -u
export HOME=/home/agent-lead
D=/home/team/shared/movements/2026-10-20T1607Z
TREE=/home/team/shared/probable-octo-sniffle
cd "$TREE" || exit 1

echo "--- 1. the predicate, measured against the defect revision ---" | tee -a "$D/guard-evidence.out"
bash scripts/guard-role-vs-shape-test.sh --old 2b14a94 > "$D/guard-predicate-test.out" 2>&1
echo "predicate test exit=$? (expect 0)" | tee -a "$D/guard-evidence.out"

echo "--- 2. the live arm, with naming probes alive ---" | tee -a "$D/guard-evidence.out"
bash "$D/guard-acceptance2.sh" >> "$D/guard-evidence.out" 2>&1
echo "arm acceptance exit=$? (0 = armed, 2 = precondition refused)" | tee -a "$D/guard-evidence.out"
echo "final: lock names $(head -n1 $TREE/server/keep-alive.lock 2>/dev/null); site $(curl -s -o /dev/null -w '%{http_code}' --noproxy '*' --max-time 10 https://b974147c03228029e277d1cbe6646fe6.ctonew.app)" | tee -a "$D/guard-evidence.out"
