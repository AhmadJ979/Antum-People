#!/bin/bash
# Reproduce the Origin/403 matrix against the .cto.site edge. Read-only: GET/HEAD/POST with no credentials.
H=https://b974147c03228029e277d1cbe6646fe6.cto.site
LOCAL=http://127.0.0.1:3000
JS=$(curl -s $LOCAL/ | grep -o 'assets/index-[A-Za-z0-9]*\.js' | head -1)
CSS=$(curl -s $LOCAL/ | grep -o 'assets/index-[A-Za-z0-9]*\.css' | head -1)
echo "=== origin matrix $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "host   : $H"
echo "assets : /$JS  /$CSS   (re-derived from the document at $LOCAL)"
echo
printf '%-6s %-34s %-12s %-6s %-8s %s\n' METHOD PATH ORIGIN STATUS BYTES BODY
probe() {
  local m="$1" p="$2" o="$3" out code size body
  out=$(mktemp)
  if [ "$m" = HEAD ]; then
    if [ "$o" = yes ]; then code=$(curl -s --head -o "$out" -w '%{http_code}' -H "Origin: $H" "$H$p")
    else code=$(curl -s --head -o "$out" -w '%{http_code}' "$H$p"); fi
  else
    if [ "$o" = yes ]; then code=$(curl -s -o "$out" -w '%{http_code}' -X "$m" -H "Origin: $H" -H 'Content-Type: application/json' -d '{}' "$H$p")
    else code=$(curl -s -o "$out" -w '%{http_code}' -X "$m" -H 'Content-Type: application/json' -d '{}' "$H$p"); fi
  fi
  size=$(wc -c < "$out")
  body=$(head -c 44 "$out" | tr -d '\r\n')
  printf '%-6s %-34s %-12s %-6s %-8s %s\n' "$m" "$p" "origin=$o" "$code" "$size" "$body"
  rm -f "$out"
}
for p in / /favicon.svg /api/auth/me "/$JS" "/$CSS"; do probe GET "$p" no; probe GET "$p" yes; done
probe HEAD / no; probe HEAD / yes
probe POST /api/login no; probe POST /api/login yes
echo
echo "=== our Node server sets no access-control-* headers: grep -ci 'access-control' server/index.js"
grep -ci 'access-control' /home/team/shared/probable-octo-sniffle/server/index.js
