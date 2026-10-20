#!/bin/bash
echo "=== guard processes, with parents and start times ==="
ps -eo pid,ppid,lstart,args | grep '[k]eep-alive' 
echo
echo "=== the guard's own lock/log lines in keep-alive.sh ==="
grep -nE 'LOCK|log|LOG|trap|marker|exit' /home/team/shared/probable-octo-sniffle/scripts/keep-alive.sh | head -30
echo
echo "=== who the profile hook starts, and when ==="
grep -nE 'keep-alive|lock|pgrep|pidof' /etc/profile.d/zz-antum-product-guard.sh | head -20
echo
echo "=== guard logs on disk ==="
ls -lt /home/team/.data/ 2>/dev/null | head -8
find /home/team -maxdepth 3 -name '*keep-alive*' -o -maxdepth 3 -name '*guard*' 2>/dev/null | head -12
