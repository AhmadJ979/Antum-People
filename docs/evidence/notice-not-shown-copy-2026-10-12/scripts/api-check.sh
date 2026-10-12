#!/usr/bin/env bash
# Machine-scored check of the acknowledgement rename on the rig (port 4716).
export HOME=/home/agent-product-designer
EV=$HOME/rig-evidence
P=4716
PASS=$(cat "$EV/scratch-pass.txt")
python3 - "$P" "$PASS" <<'PY' | tee "$EV/api-check.txt"
import json, sys, urllib.request

port, pw = sys.argv[1], sys.argv[2]
B = f"http://localhost:{port}"

def call(path, body=None, token=None):
    req = urllib.request.Request(B + path, method="POST" if body else "GET")
    if body:
        req.add_header("Content-Type", "application/json")
        req.data = json.dumps(body).encode()
    if token:
        req.add_header("Authorization", "Bearer " + token)
    with urllib.request.urlopen(req) as r:
        return json.load(r)

tok = call("/api/login", {"username": "scratch", "password": pw})["token"]
print(f"login ok; token chars: {len(tok)}  (written to token.txt)")

ov = call("/api/preboarding/checklist/overview?jurisdiction=AE", token=tok)
t = ov["totals"]
print("totals keys:", list(t.keys()))
print("cases:", t["cases"], "· items_outstanding:", t["items_outstanding"],
      "· items_verified:", t["items_verified"], "· cases_ready:", t["cases_ready"])
print("cases_notice_not_shown:", t.get("cases_notice_not_shown", "<ABSENT>"))
print("retired field cases_without_consent present?", "cases_without_consent" in t)
print("distinct flag states:", sorted({c["flag"]["state"] for c in ov["cases"]}))

# The roll-up tile's own number, read from the payload the tile reads.
print()
print("=== the gate's own strings, from one case detail (per-item notice record):")
cid = ov["cases"][0]["case_id"]
d = call(f"/api/preboarding/cases/{cid}", token=tok)
n = d.get("notice") or {}
print("notice version served:", n.get("version"))
print("bases per item:", json.dumps(n.get("bases", {}), ensure_ascii=False))
print("acknowledgements:", json.dumps(n.get("acknowledgements", []), ensure_ascii=False)[:600])
print("notice_items_collectible:", d.get("notice_items_collectible"),
      "· notice_items_no_basis:", d.get("notice_items_no_basis"))
PY
echo "exit=$?"
