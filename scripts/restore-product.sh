#!/bin/bash
# Antum People — restart-only recovery (a NAME, not a second copy of the steps).
#
#   bash scripts/restore-product.sh        ==  bash scripts/deploy-main.sh --restart-only
#
# WHY THIS FILE STILL EXISTS AS A THIN WRAPPER RATHER THAN BEING DELETED
#   Until 2026-10-17 this script held its own copy of deploy-main.sh's steps 4, 6 and 6b, because
#   deploy-main.sh was host state with nothing to call. Two copies of the same three steps drift, and
#   only one of them gets maintained — that cost is real and this change removes it. But the *name*
#   is load-bearing: it is what the host copy is called, what the evidence records and the plan cite,
#   and what an operator reaches for under pressure at 03:00 — including twice this week, on
#   2026-10-15 and 2026-10-17. Deleting it would make every one of those references wrong at the
#   worst possible moment. So the name survives as a wrapper of four executable lines.
#   A wrapper is only worth having if it is THINNER than what it wraps: this one carries no steps, no
#   defaults and no checks of its own — it resolves a sibling and execs it. If a better wrapper ever
#   needed more logic than that, the honest move would be to delete this file instead.
#
# WHAT IT REFUSES (inherited, not re-implemented): no deployed tree, or no bundle in client/dist,
# missing JWT_SECRET/ENCRYPTION_KEY, a listener that is not ours, and a served asset whose bytes are
# not the on-disk bundle. All of those live in deploy-main.sh --restart-only, which is the only place
# they are written down.
set -uo pipefail
SELF_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
DEPLOY_PATH="$SELF_DIR/deploy-main.sh"
[ -f "$DEPLOY_PATH" ] || DEPLOY_PATH="${ANTUM_DEPLOY_MAIN:-/home/team/shared/deploy-main.sh}"
if [ ! -f "$DEPLOY_PATH" ]; then
  echo "FAIL: cannot find deploy-main.sh beside this script ($SELF_DIR) or at $DEPLOY_PATH."
  echo "      This wrapper carries no steps of its own — install the deploy path, or run the full"
  echo "      movement from the repository: bash scripts/deploy-main.sh"
  exit 1
fi
# ASKING FOR HELP MUST NOT RESTART THE PRODUCT.
#   deploy-main.sh dispatches on $1 alone. Without this case, "restore-product.sh --help" arrives as
#   "--restart-only --help": the restart arm matches first, the help arm is never reached, and asking
#   what the tool does restarts the product. Found by reading the dispatch order — running it to find
#   out would have restarted the product. The guard goes ahead of the exec, not inside the callee,
#   because the wrapper is what the operator types.
case "${1:-}" in
  -h | --help)
    exec bash "$DEPLOY_PATH" --help
    ;;
esac
exec bash "$DEPLOY_PATH" --restart-only "$@"
