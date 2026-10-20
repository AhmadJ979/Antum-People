#!/usr/bin/env python3
"""Verify every file:line citation in design-concepts/CLIENT-STATES.md against ee4bbdf.

Prints OK/FAIL per claim and a summary. A FAIL means the doc's number is wrong,
or the substring I expect is not on that line.
"""
import subprocess, sys

REV = "ee4bbdf"

CLAIMS = [
    # (path, line, must-contain)
    ("client/src/App.tsx", 546, "const handleLogout"),
    ("client/src/App.tsx", 578, "const fetchData = async"),
    ("client/src/App.tsx", 583, "/api/employees"),
    ("client/src/App.tsx", 584, "/api/analytics/dashboard"),
    ("client/src/App.tsx", 587, "401"),
    ("client/src/App.tsx", 592, "empRes.json()"),
    ("client/src/App.tsx", 593, "anaRes.json()"),
    ("client/src/App.tsx", 596, "safeEmpData = Array.isArray(empData)"),
    ("client/src/App.tsx", 598, "setAnalytics(anaData"),
    ("client/src/App.tsx", 608, "catch (err)"),
    ("client/src/App.tsx", 609, "Error fetching data"),
    ("client/src/App.tsx", 719, "res.ok"),
    ("client/src/App.tsx", 720, "could not be read (HTTP"),
    ("client/src/App.tsx", 727, "catch (err)"),
    ("client/src/App.tsx", 728, "Error fetching the case checklist"),
    ("client/src/App.tsx", 1286, "No data yet"),
    ("client/src/App.tsx", 1304, "No data yet"),
    ("client/src/App.tsx", 1336, "No data yet"),
    ("client/src/App.tsx", 1340, "No data yet"),
    ("client/src/App.tsx", 1373, "No data yet"),
    ("client/src/App.tsx", 1377, "No data yet"),
    ("client/src/App.tsx", 1414, "No active onboardings."),
    ("client/src/App.tsx", 1442, "No active offboardings."),
    ("client/src/App.tsx", 1538, "No tasks generated"),
    ("client/src/App.tsx", 1916, "pre-boarding"),
    ("client/src/App.tsx", 357, "Antum People"),
    ("client/src/App.tsx", 358, "HR Onboarding/Offboarding Intelligence Platform"),
    ("client/src/App.tsx", 1876, "One source for this sentence"),
    ("client/src/App.tsx", 1883, "client-side copy is the structure that produced the drift"),
    ("client/src/App.tsx", 2348, "checklistNotice"),
    ("server/auth.js", 26, "status(499)"),
    ("server/auth.js", 31, "status(403)"),
    ("server/index.js", 60, "originHost(origin) ==="),
    ("server/index.js", 65, "Forbidden"),
    ("server/index.js", 166, "const refuse"),
    ("server/access.js", 19, "with no body"),
    ("server/access.js", 376, "status(403).end()"),
    ("server/access.js", 378, "status(403).end()"),
    ("design-concepts/LAYER3-IDENTITY.md", 149, "## 4."),
    ("design-concepts/LAYER3-IDENTITY.md", 177, "say why"),
    ("design-concepts/LAYER3-IDENTITY.md", 212, "wraps"),
    ("design-concepts/LAYER3-EMPLOYEE-OWN-VIEW.md", 193, "Counsel question numbers"),
    ("design-concepts/LAYER3-EMPLOYEE-OWN-VIEW.md", 198, "## 4."),
    ("design-concepts/LAYER3-EMPLOYEE-OWN-VIEW.md", 206, "A. Linked, nothing pending"),
    ("design-concepts/LAYER3-EMPLOYEE-OWN-VIEW.md", 208, "C. Not linked yet"),
    ("design-concepts/LAYER3-EMPLOYEE-OWN-VIEW.md", 215, "is not, when the four documents"),
]

cache = {}
def lines(path):
    if path not in cache:
        out = subprocess.run(["git", "show", f"{REV}:{path}"],
                             capture_output=True, text=True, check=True).stdout
        cache[path] = out.split("\n")
    return cache[path]

fails = 0
for path, n, needle in CLAIMS:
    L = lines(path)
    got = L[n - 1] if 1 <= n <= len(L) else "<out of range>"
    ok = needle in got
    if not ok:
        fails += 1
    print(f"{'OK  ' if ok else 'FAIL'} {path}:{n}  want={needle!r}")
    if not ok:
        print(f"          got={got.strip()[:110]!r}")
print(f"\n{len(CLAIMS) - fails}/{len(CLAIMS)} claims hold at {REV}")
sys.exit(1 if fails else 0)
