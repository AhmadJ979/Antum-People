#!/usr/bin/env bash
# Rig for the P2-4 filter-scope fix: one instance built from the branch tip, on its own port/DB.
set -u
export HOME=/home/agent-senior-software-engineer
RIG=$HOME/rig-filter
DATA=$HOME/rig
B=$HOME/rig/b
PORT=4719
TIP=$(git -C "$HOME/antum-people" rev-parse --short HEAD)

mkdir -p "$DATA" "$B"
cd "$HOME/antum-people"
git worktree remove --force "$RIG" 2>/dev/null
git worktree add --detach "$RIG" HEAD 2>&1 | tail -1
ln -sfn "$HOME/antum-people/server/node_modules" "$RIG/server/node_modules"
ln -sfn "$HOME/antum-people/client/node_modules" "$RIG/client/node_modules"

echo "=== branch tip $TIP | merge-tree(origin/main, branch): $(git -C "$HOME/antum-people" merge-tree --write-tree origin/main HEAD)"
echo "=== rig tree hash: $(git -C "$RIG" rev-parse HEAD^{tree})"
echo "=== the two changed loci:"
sed -n '687p;716,718p' "$RIG/client/src/App.tsx"
grep -n "fn === 'All'" -A 1 "$RIG/client/src/App.tsx" | head -6

cat > "$B/stash_boards.js" <<'EOF'
(function(){
  var t=localStorage.getItem('antum_token');
  var h={Authorization:'Bearer '+t};
  window.__boards=null;
  return fetch('/api/preboarding/cases',{headers:h}).then(function(r){return r.json();}).then(function(cs){
    var list=(cs&&cs.cases)?cs.cases:(Array.isArray(cs)?cs:[]);
    return Promise.all(list.filter(function(c){return c.jurisdiction==='AE';}).map(function(c){
      return fetch('/api/preboarding/cases/'+c.id+'/workspace',{headers:h}).then(function(r){return r.json();}).then(function(all){
        return fetch('/api/preboarding/cases/'+c.id+'/workspace?function=IT',{headers:h}).then(function(r){return r.json();}).then(function(it){
          window.__boards=window.__boards||{};
          window.__boards[c.offer_reference]={all:all,IT:it};
        });
      });
    }));
  }).then(function(){return 'stashed';});
})()
EOF

cat > "$B/read_board.js" <<'EOF'
(function(){
  var norm=function(s){return String(s==null?'':s).replace(/\s+/g,' ').trim();};
  var out={};
  var btns=Array.prototype.slice.call(document.querySelectorAll('button'));
  var chips=btns.filter(function(b){return /^(All|IT|Admin|HR|Manager) \(\d+\)$/.test(norm(b.textContent));});
  out.chips=chips.map(function(b){return norm(b.textContent)+(/bg-slate-900/.test(String(b.className))?' [SELECTED]':'');});
  var hdr=Array.prototype.slice.call(document.querySelectorAll('div,span')).filter(function(el){return /^Workspace track/.test(norm(el.textContent)) && norm(el.textContent).length<120;});
  out.panel_header=hdr.length?norm(hdr[0].textContent):null;
  out.workspace_row=Array.prototype.slice.call(document.querySelectorAll('span,div')).filter(function(el){return /^Workspace:/.test(norm(el.textContent)) && norm(el.textContent).length<80;}).map(function(el){return norm(el.textContent);});
  out.line_meta_blocks=Array.prototype.slice.call(document.querySelectorAll('div,span')).filter(function(el){return /due D-/.test(norm(el.textContent));}).length;
  var refs=norm(document.body.textContent).match(/OFR-\d{4}-DEMO-\d+/g);
  out.refs_on_page=refs?Array.from(new Set(refs)):[];
  var b=window.__boards;
  out.payload_stashed=Boolean(b);
  if(b){out.payload_summary=Object.keys(b).map(function(ref){
    var m=b[ref], f=function(x){return x?{totals:x.totals,mode:x.view.mode,is_access_control:x.view.is_access_control,functions:x.available_functions.map(function(q){return q.function+':'+q.open;}),func_open_sum:x.available_functions.reduce(function(s,q){return s+q.open;},0)}:null;};
    return {ref:ref, all:f(m.all), IT:f(m.IT)};
  });}
  return out;
})()
EOF

cat > "$B/click_caseA.js" <<'EOF'
(function(){
  var ref='OFR-2026-DEMO-03';
  var t=Array.prototype.slice.call(document.querySelectorAll('button')).filter(function(b){return String(b.textContent).indexOf(ref)>=0;})[0];
  if(!t) return 'no row for '+ref;
  t.click(); return 'clicked row '+ref;
})()
EOF

cat > "$B/click_caseB.js" <<'EOF'
(function(){
  var ref='OFR-2026-DEMO-02';
  var t=Array.prototype.slice.call(document.querySelectorAll('button')).filter(function(b){return String(b.textContent).indexOf(ref)>=0;})[0];
  if(!t) return 'no row for '+ref;
  t.click(); return 'clicked row '+ref;
})()
EOF

cat > "$B/click_chip_it.js" <<'EOF'
(function(){
  var t=Array.prototype.slice.call(document.querySelectorAll('button')).filter(function(b){return /^IT \(\d+\)$/.test(String(b.textContent).replace(/\s+/g,' ').trim());})[0];
  if(!t) return 'no IT chip';
  t.click(); return 'clicked IT chip';
})()
EOF

cat > "$B/scroll_board.js" <<'EOF'
(function(){
  var t=Array.prototype.slice.call(document.querySelectorAll('div,span')).filter(function(el){return /due D-/.test(String(el.textContent));})[0];
  if(!t) return 'no board rows on screen';
  t.scrollIntoView({block:'start'}); return 'scrolled to board';
})()
EOF

echo "=== build client:"
( cd "$RIG/client" && npm run build ) 2>&1 | tail -4

export JWT_SECRET=$(head -c 32 /dev/urandom | base64 | tr -d '\n')
export ENCRYPTION_KEY=$(head -c 32 /dev/urandom | base64 | tr -d '\n' | cut -c1-32)
echo "=== seed:"
( cd "$RIG" && DEMO_SEED=true PRODUCT_DB_PATH="$DATA/filter.db" node scripts/seed-demo.js ) 2>&1 | tail -2
SCRATCH_PASS=filter-rig-$(head -c 4 /dev/urandom | od -An -tx1 | tr -d ' \n')
printf '%s' "$SCRATCH_PASS" > "$DATA/scratch-pass-filter.txt"
( cd "$RIG/server" && PRODUCT_DB_PATH="$DATA/filter.db" SCRATCH_PASS="$SCRATCH_PASS" node -e '
const db=require("./db"), bcrypt=require("bcryptjs");
const h=bcrypt.hashSync(process.env.SCRATCH_PASS,12);
db.query("INSERT OR REPLACE INTO users (id,username,password_hash,role,created_at) VALUES ("+db.escapeString("scratch-admin")+","+db.escapeString("scratch")+","+db.escapeString(h)+","+db.escapeString("admin")+","+db.escapeString("2026-10-02 00:00:00")+")").then(()=>console.log("scratch user ok"))' )

echo "live port3000: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/)"
cd "$RIG/server" && PORT=$PORT PRODUCT_DB_PATH="$DATA/filter.db" nohup node index.js > "$DATA/filter.log" 2>&1 &
sleep 3
for p in $(lsof -nP -iTCP:$PORT -sTCP:LISTEN -t); do echo "  pid $p cwd $(readlink /proc/$p/cwd)"; done
TOKEN=$(curl -s -X POST http://localhost:$PORT/api/login -H 'Content-Type: application/json' \
  -d "{\"username\":\"scratch\",\"password\":\"$SCRATCH_PASS\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("token","NO_TOKEN"))')
printf '%s' "$TOKEN" > "$DATA/token-filter.txt"
echo "token: ${#TOKEN} chars | no-token probe: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:$PORT/api/employees)"
echo "=== payload sums straight from the API (case, all-mode sum vs all-mode total vs IT-mode total):"
for REF in OFR-2026-DEMO-01 OFR-2026-DEMO-02 OFR-2026-DEMO-03; do
  ID=$(curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:$PORT/api/preboarding/cases" | python3 -c "
import sys,json
d=json.load(sys.stdin); cs=d['cases'] if isinstance(d,dict) and 'cases' in d else d
print([c['id'] for c in cs if c['offer_reference']=='$REF'][0])")
  echo "--- $REF"
  curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:$PORT/api/preboarding/cases/$ID/workspace" > "$DATA/board-all-$REF.json"
  curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:$PORT/api/preboarding/cases/$ID/workspace?function=IT" > "$DATA/board-IT-$REF.json"
  python3 - "$DATA/board-all-$REF.json" "$DATA/board-IT-$REF.json" <<'PY'
import json,sys
a=json.load(open(sys.argv[1])); i=json.load(open(sys.argv[2]))
fa=a['available_functions']
print("   all : mode",a['view']['mode'],"| totals",a['totals'],"| sum(fn.open)",sum(f['open'] for f in fa),"| fns",[f['function']+':'+str(f['open']) for f in fa])
print("   IT  : mode",i['view']['mode'],"| totals",i['totals'],"| sum(fn.open)",sum(f['open'] for f in i['available_functions']),"| fns",[f['function']+':'+str(f['open']) for f in i['available_functions']])
print("   is_access_control:",a['view']['is_access_control'],i['view']['is_access_control'])
PY
done
echo "=== rig ready"
