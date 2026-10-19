#!/bin/bash
# observe-serve-pair.sh — the observer for decision 5 (a): does the PUBLIC URL serve OUR product?
#
# WHY THIS EXISTS. Seven times this product has been replaced by, or gone dark behind, the platform's
# placeholder — and every time a PERSON noticed, never a check. The placeholder answers `200` with
# `<title>My site</title>` and names none of our assets, so a status-only check calls it healthy. This
# script asserts the pair the recovery asserts, positively, from OUTSIDE the product:
#
#   1. `GET /` on the public URL returns 200 — necessary, never sufficient;
#   2. the served HTML NAMES every asset the served tree's build emitted (read out of the returned
#      document, never typed into this script);
#   3. fetching each of those assets off the URL and hashing it gives the md5 the served tree's own
#      artifact has — so a page naming a stale or foreign bundle FAILS.
#
# DERIVE-OR-REFUSE. The expected asset names, byte counts and md5s are derived at run time from
# `<tree>/client/dist/` — the artifact the host serves from — and the run prints where they came from.
# If they cannot be derived the script REFUSES (exit 3) rather than comparing against a remembered
# number: a literal is exactly what drifts the moment a movement ships a new bundle. Two env overrides
# exist so a literal CAN be pinned (`ANTUM_OBSERVE_EXPECT_ASSET`, `ANTUM_OBSERVE_EXPECT_MD5`), and when a
# pinned value disagrees with the derived one the run FAILS naming both — a literal that cannot redden is
# a number nobody checks.
#
# READ-ONLY AGAINST THE PRODUCT: it queries the URL and writes to its own record directory. No restart,
# no marker, no guard interaction, nothing written under the deployed tree's `client/` or `server/`.
#
# WHO RUNS IT, AND WHEN — stated, not implied (measured on this host 2026-10-19: PID 1 is `/bin/sh`, there
# is no systemd bus to talk to, no `crontab` binary, and `/etc/cron.d` is executed by nothing; DEPLOY.md's
# own note says this host supports neither systemd nor crontab). **There is no scheduler on this host, and
# this business has no off-host one, so this script does not invent one.** It runs:
#   * at every movement, from DEPLOY.md's post-movement step — where the hand-done "confirm the served
#     package off the URL" used to be (that step now IS this assertion);
#   * when an operator arms the loop — `bash observe-serve-pair.sh --loop 600` — which is the best
#     mechanism that exists here, and a much weaker one than a scheduler: it is a process on the host it
#     observes. A REPLACEMENT WIPES `/etc` AND `/home` SURVIVES, but the process dies, and the hook that
#     could re-arm it is exactly the thing a replacement takes. The loop does not survive a replacement,
#     and NOTHING NOTICES ITS DEATH — so every run prints the age of the previous run, and the gap is
#     visible to the next run (see LIVENESS below);
#   * when a person runs it — `bash observe-serve-pair.sh` — which is the only mechanism that works while
#     the loop is dead.
# BLIND SPOT, plainly: this observer cannot see the window in which the product is gone if it is itself
# gone, and nothing on this host pushes a message to a human. What it leaves instead is a dated record and
# a loud marker file where a person looks (see THE RECORD).
#
# USAGE
#   bash observe-serve-pair.sh                     one run; exit 0 = the pair holds
#   bash observe-serve-pair.sh --loop <seconds>    run every <seconds> (one loop per host; lock = pid)
#   bash observe-serve-pair.sh --status            the record's own state: last run, its age, the alert
#   bash observe-serve-pair.sh --help
#
# OVERRIDES (WORKFLOW rule 14 — every host value is an override so this can be exercised off-host):
#   ANTUM_OBSERVE_URL     the public URL to observe (default: the platform URL below)
#   ANTUM_OBSERVE_TREE    the deployed tree whose build is served (default /home/team/shared/probable-octo-sniffle)
#   ANTUM_OBSERVE_DIR     where the record, the alert and the loop lock live (default /home/team/shared/observer)
#   ANTUM_OBSERVE_LOG     the run record (default <dir>/runs.jsonl)
#   ANTUM_OBSERVE_KEEP    how many runs the record keeps (default 2000; older lines are dropped, oldest first)
#   ANTUM_OBSERVE_TIMEOUT curl's per-request timeout, seconds (default 20)
#   ANTUM_OBSERVE_EXPECT_ASSET / ANTUM_OBSERVE_EXPECT_MD5   pin a literal (a disagreement FAILS, naming both)
#
# EXIT CODES: 0 the pair holds · 1 the pair does NOT hold · 2 usage error · 3 could not derive (refused)
#
# TESTED BY: scripts/observe-serve-pair-test.sh — green against a fixture that is the pair, red against a
# placeholder and against foreign asset bytes, and the refusal, the record, the alert and the read-only
# promise each exercised. A check that cannot redden proves nothing.
set -uo pipefail

DEFAULT_URL="https://b974147c03228029e277d1cbe6646fe6.ctonew.app"
URL="${ANTUM_OBSERVE_URL:-$DEFAULT_URL}"
TREE="${ANTUM_OBSERVE_TREE:-/home/team/shared/probable-octo-sniffle}"
DIR="${ANTUM_OBSERVE_DIR:-/home/team/shared/observer}"
LOG="${ANTUM_OBSERVE_LOG:-$DIR/runs.jsonl}"
KEEP="${ANTUM_OBSERVE_KEEP:-2000}"
TIMEOUT="${ANTUM_OBSERVE_TIMEOUT:-20}"
PIN_ASSET="${ANTUM_OBSERVE_EXPECT_ASSET:-}"
PIN_MD5="${ANTUM_OBSERVE_EXPECT_MD5:-}"
LOCK="$DIR/observer-loop.lock"
ALERT="$DIR/PAIR-BROKEN.txt"
RESTORED="$DIR/restored.log"
MODE=once
INTERVAL=0

while [ $# -gt 0 ]; do
  case "$1" in
    --loop) [ -n "${2:-}" ] || { echo "FAIL: --loop needs a number of seconds"; exit 2; }; MODE=loop; INTERVAL="$2"; shift ;;
    --status) MODE=status ;;
    --url) [ -n "${2:-}" ] || { echo "FAIL: --url needs a URL"; exit 2; }; URL="$2"; shift ;;
    --tree) [ -n "${2:-}" ] || { echo "FAIL: --tree needs a directory"; exit 2; }; TREE="$2"; shift ;;
    -h|--help) sed -n '2,60p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1 (use --loop <sec>, --status, --url <u>, --tree <d>, or --help)"; exit 2 ;;
  esac
  shift
done
URL="${URL%/}"

now() { date -u +%Y-%m-%dT%H:%M:%SZ; }
say() { printf '%s\n' "$*"; }

mkdir -p "$DIR" 2>/dev/null
TMP=$(mktemp -d "${TMPDIR:-/tmp}/observe-serve-pair.XXXXXX") || { echo "FAIL: no scratch space"; exit 2; }
trap 'rm -rf "$TMP"' EXIT

# --------------------------------------------------------------------------------------------
# --status: the record's own state, so "is the observer alive?" is answerable without probing the URL.
# A check whose own death is silent is the same defect one level up — this is what makes the death
# visible to whoever looks next.
if [ "$MODE" = status ]; then
  say "=== observe-serve-pair --status $(now) ==="
  say "  record: $LOG"
  if [ ! -s "$LOG" ]; then
    say "  NO RECORD YET — the observer has never written a run to this record."
    say "  that is not the same as the product being fine: it means nothing has been observed here."
    exit 0
  fi
  LAST=$(tail -1 "$LOG")
  LTS=$(printf '%s' "$LAST" | sed -n 's/.*"ts":"\([^"]*\)".*/\1/p')
  LV=$(printf '%s' "$LAST" | sed -n 's/.*"verdict":"\([^"]*\)".*/\1/p')
  say "  runs recorded: $(wc -l < "$LOG") (keeping the most recent $KEEP)"
  say "  last run:      $LTS → $LV"
  if [ -n "$LTS" ]; then
    LEP=$(date -u -d "$LTS" +%s 2>/dev/null); NEP=$(date -u +%s)
    if [ -n "$LEP" ]; then say "  age:           $(( (NEP - LEP) / 60 )) min ago"; fi
  fi
  if [ -f "$ALERT" ]; then
    say "  ALERT FILE PRESENT — $ALERT (the pair did not hold at the last failing run):"
    sed 's/^/    /' "$ALERT"
  else
    say "  no alert file: $ALERT (the last recorded run held, or none has failed)"
  fi
  if [ -f "$LOCK" ]; then
    LP=$(head -1 "$LOCK" 2>/dev/null)
    if [ -n "$LP" ] && kill -0 "$LP" 2>/dev/null; then
      say "  loop:          armed, pid $LP (kill by THIS pid, never pkill -f)"
    else
      say "  loop:          the lock names pid ${LP:-?}, which is not running — the loop is DEAD (a stale lock)"
    fi
  else
    say "  loop:          no lock file — no loop is armed; only a movement step or a person runs this now"
  fi
  exit 0
fi

# --------------------------------------------------------------------------------------------
# ONE LOOP PER HOST. The lock holds the pid; a second loop refuses to start, and the loop is killed by
# that pid — never by a pattern match, which would match the killer's own command line.
if [ "$MODE" = loop ]; then
  if [ -f "$LOCK" ]; then
    LP=$(head -1 "$LOCK" 2>/dev/null)
    if [ -n "$LP" ] && kill -0 "$LP" 2>/dev/null; then
      echo "REFUSED: a loop is already armed — pid $LP holds $LOCK (kill by that pid, never pkill -f)"
      exit 2
    fi
    echo "note: the lock named pid ${LP:-?}, which is not running (a stale lock) — arming anyway"
  fi
  printf '%s\n' "$$" > "$LOCK"
  trap 'rm -rf "$TMP"; [ "$(head -1 "$LOCK" 2>/dev/null)" = "$$" ] && rm -f "$LOCK"' EXIT
fi

derive() { # fills DERIVED (name|bytes|md5 per line) or refuses
  local index="$TREE/client/dist/index.html" d
  if [ ! -s "$index" ]; then
    say "REFUSED: cannot derive the expected asset — no built index at $index"
    say "  the served tree's build is the artifact the URL must be serving; without it there is nothing to"
    say "  compare against, and this script will not compare against a remembered number (derive-or-refuse)."
    return 3
  fi
  d=$(grep -oE 'assets/[A-Za-z0-9._-]+\.(js|css)' "$index" | sort -u)
  if [ -z "$d" ]; then
    say "REFUSED: $index names no 'assets/…' bundle — nothing to derive an expectation from."
    return 3
  fi
  local n f bytes md5
  DERIVED=""
  while IFS= read -r n; do
    f="$TREE/client/dist/$n"
    if [ ! -s "$f" ]; then
      say "REFUSED: $index names $n but $f does not exist — the tree's build is incomplete."
      return 3
    fi
    bytes=$(stat -c %s "$f"); md5=$(md5sum < "$f" | cut -d' ' -f1)
    DERIVED="${DERIVED}${n}|${bytes}|${md5}
"
  done <<< "$d"
  JS_ASSET=$(printf '%s\n' "$d" | grep '\.js$' | head -1)
  if [ -z "$JS_ASSET" ]; then
    say "REFUSED: $index names no .js bundle (only: $(printf '%s' "$d" | tr '\n' ' '))"
    return 3
  fi
  return 0
}

# --------------------------------------------------------------------------------------------
# one run: measure, print, record, alert
run_once() {
  local started ts dur rc=0
  started=$(date -u +%s)
  echo "=== observe-serve-pair $(now) ==="
  echo "  script: $0 | $(stat -c %s "$0" 2>/dev/null) B | sha256 $(sha256sum "$0" 2>/dev/null | cut -c1-16)"
  echo "  url:    $URL"
  echo "  tree:   $TREE"

  # -- liveness, read BEFORE this run is appended: the gap is the observer's own death made visible
  local prev_ts="" prev_v="" gap=""
  if [ -s "$LOG" ]; then
    local last; last=$(tail -1 "$LOG")
    prev_ts=$(printf '%s' "$last" | sed -n 's/.*"ts":"\([^"]*\)".*/\1/p')
    prev_v=$(printf '%s' "$last" | sed -n 's/.*"verdict":"\([^"]*\)".*/\1/p')
    if [ -n "$prev_ts" ]; then
      local pe ne; pe=$(date -u -d "$prev_ts" +%s 2>/dev/null); ne=$(date -u +%s)
      [ -n "$pe" ] && gap=$(( (ne - pe) / 60 ))
    fi
  fi
  echo "  LIVENESS: ${prev_ts:-<no earlier run in this record>}${prev_ts:+ → $prev_v}${gap:+ · ${gap} min since the last recorded run}"
  [ -n "$prev_ts" ] || echo "            the observer has not recorded a run here before; a gap before this line was NOT observed"
  if [ -n "$gap" ] && [ "$INTERVAL" -gt 0 ] && [ "$gap" -gt $(( (INTERVAL * 2) / 60 + 1 )) ]; then
    echo "            GAP: ${gap} min with no record against a ${INTERVAL}s interval — the loop was not running"
    echo "            (a replacement kills it and the /etc hook that could re-arm it; nothing else notices)"
  fi

  # -- derive the expectations; refuse rather than remember
  DERIVED=""
  if ! derive; then
    rc=3
    echo
    echo "REFUSED (exit 3) — nothing was compared. ${URL} was NOT measured by this run."
    record "$(now)" "REFUSED" "" "" "" "" "" "" "" ""
    return 3
  fi
  local dcount; dcount=$(printf '%s' "$DERIVED" | grep -c .)
  echo "  derived: $dcount asset(s) from $TREE/client/dist (the artifact this tree serves)"
  printf '%s' "$DERIVED" | while IFS='|' read -r n b m; do [ -n "$n" ] && echo "            $n  $b B  md5 $m"; done
  echo "            tree HEAD: $(git -C "$TREE" rev-parse --short HEAD 2>/dev/null || echo 'not a git tree')"

  # -- a pinned literal must agree with the artifact, or it is a number nobody checks
  local pinfail=""
  if [ -n "$PIN_ASSET" ] && [ "$PIN_ASSET" != "$JS_ASSET" ]; then
    pinfail="pinned asset ($PIN_ASSET) != the served tree's artifact ($JS_ASSET)"
  fi
  local dm; dm=$(printf '%s' "$DERIVED" | grep -F "$JS_ASSET|" | head -1 | cut -d'|' -f3)
  if [ -n "$PIN_MD5" ] && [ "$PIN_MD5" != "$dm" ]; then
    pinfail="${pinfail:+$pinfail; }pinned md5 ($PIN_MD5) != the served tree's artifact md5 ($dm)"
  fi
  if [ -n "$pinfail" ]; then
    echo
    echo "PAIR BROKEN (exit 1) — $pinfail"
    echo "  a pinned literal is a dated measurement; when it disagrees with the artifact, the artifact is right and the literal has drifted."
    record "$(now)" "BROKEN" "" "" "" "$JS_ASSET" "$dm" "" "" "pin: $pinfail"
    alert "$pinfail"
    return 1
  fi

  # -- 1. the page
  local code title found
  code=$(curl -sS -o "$TMP/page.html" -w '%{http_code}' --max-time "$TIMEOUT" "$URL/" 2>"$TMP/curlerr") || true
  if [ ! -s "$TMP/page.html" ] && [ "${code:-0}" = "000" ]; then
    echo
    echo "PAIR BROKEN (exit 1) — GET $URL/ could not be reached ($(head -1 "$TMP/curlerr" 2>/dev/null))"
    record "$(now)" "BROKEN" "$code" "" "" "$JS_ASSET" "$dm" "" "" "unreachable"
    alert "the URL could not be reached: $(head -1 "$TMP/curlerr" 2>/dev/null)"
    return 1
  fi
  title=$(sed -n 's/.*<title>\(.*\)<\/title>.*/\1/p' "$TMP/page.html" | head -1)
  found=$(grep -oE 'assets/[A-Za-z0-9._-]+\.(js|css)' "$TMP/page.html" | sort -u | tr '\n' ' ')
  echo "  measured: GET / → $code | title: ${title:-<none>} | page bytes: $(stat -c %s "$TMP/page.html")"
  echo "            the page names: ${found:-<nothing>}"
  if [ "$code" != "200" ]; then
    echo
    echo "PAIR BROKEN (exit 1) — GET / returned $code, not 200"
    record "$(now)" "BROKEN" "$code" "$title" "$found" "$JS_ASSET" "$dm" "" "" "status"
    alert "GET / returned $code (title: ${title:-none})"
    return 1
  fi
  local missing=""
  while IFS='|' read -r n b m; do
    [ -n "$n" ] || continue
    case " $found " in *" $n "*) ;; *) missing="$missing $n";; esac
  done <<< "$DERIVED"
  if [ -n "$missing" ]; then
    echo
    echo "PAIR BROKEN (exit 1) — the served page does not name:${missing}"
    echo "  it names: ${found:-<nothing>} (title: ${title:-<none>})"
    echo "  a placeholder answers 200 too — this is that shape."
    record "$(now)" "BROKEN" "$code" "$title" "$found" "$JS_ASSET" "$dm" "" "" "page names none of ours:${missing}"
    alert "the page at $URL/ (title: ${title:-none}) does not name our asset(s):${missing}"
    return 1
  fi

  # -- 2. the bytes behind each name
  local fetched_bytes="" fetched_md5="" first_asset="$JS_ASSET" first_md5="$dm"
  while IFS='|' read -r n b m; do
    [ -n "$n" ] || continue
    local acode abytes amd5
    acode=$(curl -sS -o "$TMP/asset.bin" -w '%{http_code}' --max-time "$TIMEOUT" "$URL/$n" 2>/dev/null) || true
    abytes=$(stat -c %s "$TMP/asset.bin" 2>/dev/null || echo 0)
    amd5=$(md5sum < "$TMP/asset.bin" 2>/dev/null | cut -d' ' -f1)
    echo "            $n → $acode, $abytes B, md5 $amd5"
    echo "            expected:            $b B, md5 $m"
    if [ "$n" = "$JS_ASSET" ]; then first_asset="$n"; first_md5="$amd5"; fetched_bytes="$abytes"; fetched_md5="$amd5"; fi
    if [ "$acode" != "200" ] || [ "$abytes" != "$b" ] || [ "$amd5" != "$m" ]; then
      assets_ok=0
      echo
      echo "PAIR BROKEN (exit 1) — $n served off the URL does not match the served tree's artifact"
      echo "  status $acode, served $abytes B md5 $amd5 vs expected $b B md5 $m"
      record "$(now)" "BROKEN" "$code" "$title" "$found" "$n" "$m" "$abytes" "$amd5" "asset bytes/md5 differ"
      alert "$n served off $URL does not match the artifact: served $abytes B md5 $amd5, expected $b B md5 $m"
      return 1
    fi
  done <<< "$DERIVED"

  dur=$(( $(date -u +%s) - started ))
  echo
  echo "PAIR HOLDS (exit 0) — the page at $URL names our asset(s) and the bytes match the served tree's artifact"
  echo "  measured off the URL: $first_asset $fetched_bytes B md5 $fetched_md5"
  record "$(now)" "PASS" "$code" "$title" "$found" "$first_asset" "$dm" "$fetched_bytes" "$fetched_md5" "" "$dur"
  if [ -f "$ALERT" ]; then
    local since; since=$(sed -n 's/^first broken \([^ ]*\) .*/\1/p' "$ALERT" | head -1)
    printf '%s\n' "$(now) restored: $URL serves the pair again (first broken ${since:-unknown}) — the window is bounded by the recorded runs, not exact" >> "$RESTORED"
    mv -f "$ALERT" "$DIR/PAIR-BROKEN-resolved-$(date -u +%Y%m%dT%H%M%SZ).txt" 2>/dev/null
    echo "  the alert file was cleared and moved aside: $DIR/PAIR-BROKEN-resolved-*.txt (the window: ${since:-unknown} → $(now))"
  fi
  return 0
}

record() { # ts verdict status title found asset expected_md5 bytes md5 note [duration]
  local ts="$1" v="$2" st="$3" ti="$4" fo="$5" as="$6" em="$7" fb="$8" fm="$9" note="${10}" dur="${11:-}"
  # A title or a note can carry a quote or a newline — the record is JSON, so the fields are sanitised
  # rather than trusted: a record that does not parse is a record nobody can read.
  ti=$(printf '%s' "$ti" | tr -d '"\\\n'); fo=$(printf '%s' "$fo" | tr -d '"\\\n')
  note=$(printf '%s' "$note" | tr -d '"\\\n')
  mkdir -p "$DIR" 2>/dev/null
  printf '{"ts":"%s","verdict":"%s","url":"%s","status":"%s","title":"%s","page_assets":"%s","asset":"%s","expected_md5":"%s","fetched_bytes":"%s","fetched_md5":"%s","tree":"%s","tree_head":"%s","note":"%s","duration_s":"%s","interval_s":"%s"}
' "$ts" "$v" "$URL" "$st" "$ti" "$fo" "$as" "$em" "$fb" "$fm" "$TREE" "$(git -C "$TREE" rev-parse --short HEAD 2>/dev/null || echo none)" "$note" "$dur" "$INTERVAL" >> "$LOG"
  if [ "$KEEP" -gt 0 ] && [ "$(wc -l < "$LOG")" -gt "$KEEP" ]; then
    tail -n "$KEEP" "$LOG" > "$TMP/log.keep" && mv -f "$TMP/log.keep" "$LOG"
  fi
}

alert() { # $1 = what failed; keeps the FIRST failure time so a window can be measured
  mkdir -p "$DIR" 2>/dev/null
  if [ -f "$ALERT" ]; then
    printf '  also failing %s: %s\n' "$(now)" "$1" >> "$ALERT"
  else
    { printf 'first broken %s — the public URL does not serve our product as of this run.\n' "$(now)"
      printf 'failing: %s\n' "$1"
      printf 'record:  %s (verdict BROKEN, with the numbers this run measured)\n' "$LOG"
      printf 'what to run: bash observe-serve-pair.sh (one run) or --status (is the observer alive?)\n'
      printf 'recovery:    bash /home/team/shared/restore-product.sh\n'
      printf 'nothing pushes this to a person — read it here, or run --status. The observer cannot notify: it has no channel off this host.\n'; } > "$ALERT"
  fi
  echo "  ALERT WRITTEN: $ALERT"
}

if [ "$MODE" = loop ]; then
  echo "=== observe-serve-pair --loop ${INTERVAL}s $(now) ==="
  echo "  pid $$ (kill by the pid in $LOCK, never pkill -f) · record $LOG · keeping $KEEP runs"
  echo "  NOT A SCHEDULER: this is a process on the host it observes. A replacement kills it and the /etc"
  echo "  hook that could re-arm it; nothing notices its death except the age this script prints each run."
  echo
  while :; do
    run_once; RC=$?
    [ -f "$LOCK" ] || { echo "the lock is gone — another process took it; stopping"; exit "$RC"; }
    sleep "$INTERVAL"
  done
else
  run_once; RC=$?
  exit "$RC"
fi
