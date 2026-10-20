#!/bin/bash
export HOME=/home/agent-lead
D=/home/team/shared/movements/2026-10-20T1607Z
team-db "SELECT id, status, assigned_to, substr(title,1,70) FROM tasks WHERE status IN ('backlog','in-progress','review')" > "$D/board-open.txt" 2>&1
team-db "SELECT status, COUNT(*) FROM tasks GROUP BY status" > "$D/board-counts.txt" 2>&1
cd /home/team/shared/probable-octo-sniffle || exit 1
gh pr list --state open --json number,title,headRefName,mergeable --limit 20 > "$D/prs-open.json" 2>&1
echo "exit=$?" > "$D/prs-open.status"
GIT_TERMINAL_PROMPT=0 git ls-remote origin refs/heads/main > "$D/remote-main.txt" 2>&1
