#!/usr/bin/env python3
"""Verify every file:line citation in design-concepts/CLIENT-STATES.md at 0e401cf.

RE-POINTED from ee4bbdf after PR #241 merged (the mechanism landed and moved
App.tsx line numbers by +6 / +16). Run: python3 <this file>   (from inside the repo)
"""
import subprocess, sys

REV = "0e401cf"

CLAIMS = [
    # --- App.tsx: the refusal seat, measured after #241 ---
    ("client/src/App.tsx", 5, "a refusal is not"),
    ("client/src/App.tsx", 6, "an error, the person is still signed in"),
    ("client/src/App.tsx", 8, "const REFUSAL_NOTICE ="),
    ("client/src/App.tsx", 10, "const API_BASE = window.location.port === '5173'"),
    ("client/src/App.tsx", 363, "Antum People</h2>"),
    ("client/src/App.tsx", 364, "HR Onboarding/Offboarding Intelligence Platform"),
    ("client/src/App.tsx", 443, "useState<Employee[]>([])"),
    ("client/src/App.tsx", 447, "useState<Analytics | null>(null)"),
    ("client/src/App.tsx", 552, "const handleLogout"),
    ("client/src/App.tsx", 572, "onRefusal"),
    ("client/src/App.tsx", 576, "must not outlive the request that raised it"),
    ("client/src/App.tsx", 577, "setRefusal(null); }, [activeTab, jurisdiction]"),
    ("client/src/App.tsx", 594, "const fetchData = async"),
    ("client/src/App.tsx", 599, "/api/employees?jurisdiction"),
    ("client/src/App.tsx", 612, "safeEmpData = Array.isArray(empData)"),
    ("client/src/App.tsx", 614, "setAnalytics(anaData"),
    ("client/src/App.tsx", 624, "catch (err)"),
    ("client/src/App.tsx", 625, "Error fetching data"),
    ("client/src/App.tsx", 743, "catch (err)"),
    ("client/src/App.tsx", 744, "Error fetching the case checklist"),
    ("client/src/App.tsx", 1283, "refusal &&"),
    ("client/src/App.tsx", 1284, 'role="alert"'),
    ("client/src/App.tsx", 1293, "setRefusal(null)"),
    ("client/src/App.tsx", 1321, "No data yet"),
    ("client/src/App.tsx", 1339, "No data yet"),
    ("client/src/App.tsx", 1371, "No data yet"),
    ("client/src/App.tsx", 1375, "No data yet"),
    ("client/src/App.tsx", 1408, "No data yet"),
    ("client/src/App.tsx", 1412, "No data yet"),
    ("client/src/App.tsx", 1449, "No active onboardings."),
    ("client/src/App.tsx", 1477, "No active offboardings."),
    ("client/src/App.tsx", 1573, "No tasks generated"),
    ("client/src/App.tsx", 1911, "One source for this sentence"),
    ("client/src/App.tsx", 1918, "client-side copy is the structure"),
    ("client/src/App.tsx", 1951, "pre-boarding"),
    # --- httpStatus.js: the merged mechanism ---
    ("client/src/httpStatus.js", 8, "auth.js:31"),
    ("client/src/httpStatus.js", 11, "EMPTY body"),
    ("client/src/httpStatus.js", 21, "THE RULE, stated"),
    ("client/src/httpStatus.js", 22, "ambiguous, signing out"),
    ("client/src/httpStatus.js", 24, "read from a CLONE"),
    ("client/src/httpStatus.js", 35, "export const SESSION_INVALID"),
    ("client/src/httpStatus.js", 37, "export const REFUSAL"),
    ("client/src/httpStatus.js", 42, "function actionFor"),
    ("client/src/httpStatus.js", 47, "'refusal-notice'"),
    ("client/src/httpStatus.js", 59, "export function classifyHttpStatus"),
    ("client/src/httpStatus.js", 62, "hasBody ? SESSION_INVALID : REFUSAL"),
    ("client/src/httpStatus.js", 113, "const res = await fetchImpl"),
    ("client/src/httpStatus.js", 124, "res.status !== 401 && res.status !== 403"),
    ("client/src/httpStatus.js", 133, "throw new SessionExpiredError"),
    ("client/src/httpStatus.js", 137, "onRefusal(url, res.status)"),
    ("client/src/httpStatus.js", 138, "throw new RefusalError"),
    # --- the tests: what the control covers, and what it does not ---
    ("client/src/httpStatus.test.js", 32, "Invalid or expired token"),
    ("client/src/httpStatus.test.js", 56, "Employee not found"),
    ("client/src/httpStatus.test.js", 61, "anti-vacuous control"),
    ("client/src/httpStatus.test.js", 123, "Employee not found"),
    # --- server: every 403 producer, and the two 401/403 boundaries ---
    ("server/auth.js", 26, "status(401)"),
    ("server/auth.js", 31, "status(403)"),
    ("server/index.js", 60, "originHost(origin) ==="),
    ("server/index.js", 64, "[cors] refused Origin"),
    ("server/index.js", 65, "Forbidden"),
    ("server/index.js", 166, "const refuse"),
    ("server/access.js", 19, "with no body"),
    ("server/access.js", 376, "status(403).end()"),
    ("server/access.js", 378, "status(403).end()"),
    # --- the vocabulary this document reconciles with ---
    ("design-concepts/LAYER3-IDENTITY.md", 149, "## 4."),
    ("design-concepts/LAYER3-IDENTITY.md", 170, "leave the record untouched"),
    ("design-concepts/LAYER3-IDENTITY.md", 177, "say why"),
    ("design-concepts/LAYER3-IDENTITY.md", 212, "wraps"),
    ("design-concepts/LAYER3-EMPLOYEE-OWN-VIEW.md", 198, "## 4."),
    ("design-concepts/LAYER3-EMPLOYEE-OWN-VIEW.md", 212, "never shows a red"),
    ("design-concepts/LAYER3-EMPLOYEE-OWN-VIEW.md", 213, "clear"),
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
    tag = "OK  " if ok else "FAIL"
    print(f"{tag} {path}:{n}  want={needle!r}")
    if not ok:
        print(f"          got={got.strip()[:110]!r}")
print(f"\n{len(CLAIMS) - fails}/{len(CLAIMS)} claims hold at {REV}")
sys.exit(1 if fails else 0)
