#!/usr/bin/env python3
"""Check the spec's quoted figures against the raw transcripts that carry them.

THE POINT OF THIS CHECKER, learned the hard way in this pack's own first run: a claim must be read OUT
OF THE DOCUMENT IT JUDGES. The first version of this file compared hard-coded literals against the
transcripts, so it stayed GREEN on a spec whose figures had been falsified — it was checking the pack
against itself, not the document against the pack. Every check below now parses the figure out of
`probation-correction-path-spec.md` and compares it with the same figure parsed out of the transcript the
spec names. Falsify the spec and the check reddens; that is what makes the green meaningful.

Run: python3 docs/evidence/probation-correction-decision-2026-10-26/check-pack.py <repo-root>
"""
import sys, os, re

root = sys.argv[1] if len(sys.argv) > 1 else '.'
PACK = os.path.join(root, 'docs/evidence/probation-correction-decision-2026-10-26')
SPEC_PATH = os.path.join(root, 'probation-correction-path-spec.md')
spec = open(SPEC_PATH, encoding='utf-8').read()
raw = {n: open(os.path.join(PACK, n), encoding='utf-8').read()
       for n in sorted(os.listdir(PACK)) if n != 'README.md' and n.endswith('.txt')}
F = raw
fails, checks = 0, 0


def out(name, ok, detail=''):
    global fails, checks
    checks += 1
    if not ok:
        fails += 1
    print(('PASS  ' if ok else 'FAIL  ') + name + (('   <- ' + detail) if (detail and not ok) else ''))


def from_spec(pattern, group=1, label=''):
    m = re.search(pattern, spec, re.S)
    if not m:
        out('the spec still states ' + (label or pattern[:48]), False, 'pattern not found in the spec')
        return None
    return m.group(group)


def from_pack(file, pattern, group=1):
    m = re.search(pattern, F[file], re.S)
    return m.group(group) if m else None


# ---- figures the spec quotes, each read out of the spec and compared to its transcript ----
out('the tree the spec names is the tree 00 measured',
    from_spec(r'\*\*`(0afe5ac[0-9a-f]+)`\*\*') == from_pack('00-tree-and-instance.txt', r'tree HEAD: ([0-9a-f]{40})'),
    'spec=%s pack=%s' % (from_spec(r'`(0afe5ac[0-9a-f]+)`'), from_pack('00-tree-and-instance.txt', r'tree HEAD: ([0-9a-f]{40})')))

s = (from_spec(r'A second submission for one milestone\s*\|\s*\*\*(\d+)\*\*,\s*(\d+) B', 1, 'the 409 status'),
     from_spec(r'A second submission for one milestone\s*\|\s*\*\*(\d+)\*\*,\s*(\d+) B', 2, 'the 409 size'))
p = (from_pack('02-evaluation-surface-at-0afe5ac.txt', r'same milestone, different content\) -> (\d+)'),
     from_pack('02-evaluation-surface-at-0afe5ac.txt', r'same milestone, different content\) -> \d+, (\d+) B'))
out('the 409 status and size the spec quotes are the ones measured', s == p, 'spec=%s measured=%s' % (s, p))

out('the spec says the 409 payload has no evaluation_id, and the transcript agrees',
    'no `evaluation_id` in the payload' in spec
    and 'evaluation_id' not in F['02-evaluation-surface-at-0afe5ac.txt'].split('=== 5.')[1].split('=== 6.')[0])

s = (from_spec(r'with a valid `hr_admin` token \*\*(\d+), (\d+) B\*\*', 1, 'the correction 403 status'),
     from_spec(r'with a valid `hr_admin` token \*\*(\d+), (\d+) B\*\*', 2, 'the correction 403 size'))
p = (from_pack('02-evaluation-surface-at-0afe5ac.txt', r'with a valid hr_admin token -> (\d+)'),
     from_pack('02-evaluation-surface-at-0afe5ac.txt', r'with a valid hr_admin token -> \d+, (\d+) B'))
out('the correction attempt the spec quotes is the one measured', s == p, 'spec=%s measured=%s' % (s, p))

out('the control the spec describes is in the transcript',
    'is not a route census' in spec
    and 'definitely-not-a-route-xyz with a valid hr_admin token -> 403, 0 B' in F['02-evaluation-surface-at-0afe5ac.txt']
    and '(a route that DOES exist, same method+token) -> 200' in F['02-evaluation-surface-at-0afe5ac.txt'])

s = from_spec(r'window has \*\*ended\*\*[^|]*\|\s*submission refused \*\*(\d+)\*\*', 1, 'the ended-window status')
p = from_pack('02-evaluation-surface-at-0afe5ac.txt', r'\(window ended [\d-]+\) -> (\d+)')
out('the ended-window refusal the spec quotes is the one measured', s == p, 'spec=%s measured=%s' % (s, p))

s = from_spec(r'not yet due\*\*[^|]*\|\s*submission \*\*accepted, (\d+)\*\*', 1, 'the not-yet-due status')
p = from_pack('02-evaluation-surface-at-0afe5ac.txt', r'milestone 2 \(not yet due\) -> (\d+)')
out('the not-yet-due acceptance the spec quotes is the one measured', s == p, 'spec=%s measured=%s' % (s, p))

out('the escalation-keeps-its-row claim matches the transcript',
    'id` and `detected_at` identical' in spec
    and 'same escalation row as before the submission? id true, detected_at true' in F['02-evaluation-surface-at-0afe5ac.txt']
    and 'derived **false → true**' in spec)

s = (from_spec(r'\*\*(\d+) of (\d+)\*\* employees carry one', 1, 'the manager_id count'),
     from_spec(r'\*\*(\d+) of (\d+)\*\* employees carry one', 2, 'the roster size'),
     from_spec(r'(\d+) carry a probation window', 1, 'the window count'))
p = (from_pack('01-seeded-probation-surface.txt', r'manager_id: \[\{"n":(\d+)'),
     None,
     from_pack('01-seeded-probation-surface.txt', r'probation_end_date: \[\{"n":(\d+)'))
p = (p[0], from_pack('01-seeded-probation-surface.txt', r'SELECT COUNT\(\*\) AS n FROM employees\)"[^\n]*\n?'),
     p[2])
# the roster size: sum of the status rows 7+3+2+2
roster = sum(int(x) for x in re.findall(r'"status":"\w+","n":(\d+)', F['01-seeded-probation-surface.txt']))
out('the manager_id count, the roster size and the window count the spec quotes are the ones measured',
    s == (p[0], str(roster), p[2]), 'spec=%s measured=%s' % (s, (p[0], roster, p[2])))

out('the two evaluations / two audit rows / none for the 409 claim matches the transcript',
    '**one** evaluation row' in spec and 'no** audit row for the 409' in spec
    and 'probation_evaluations rows: 2' in F['03-rows-and-audit-rows.txt']
    and 'audit_logs rows for probation_evaluations: 2' in F['03-rows-and-audit-rows.txt'])
rows = re.findall(r'\{"id":"[0-9a-f-]{36}","employee_id":"([^"]+)","milestone_index":(\d+)', F['03-rows-and-audit-rows.txt'])
out('exactly one evaluation row exists for the milestone whose second submission was refused',
    sum(1 for e, m in rows if m == '1') == 1, 'rows for milestone 1: %s' % sum(1 for e, m in rows if m == '1'))

s = (from_spec(r'tables \*\*(\d+) → (\d+)\*\*', 1, 'the before-count'),
     from_spec(r'tables \*\*(\d+) → (\d+)\*\*', 2, 'the after-count'))
p = (from_pack('04-proposed-ddl-additive-and-read-rule.txt', r'tables before: (\d+)'),
     from_pack('04-proposed-ddl-additive-and-read-rule.txt', r'tables after the proposal: (\d+)'))
out('the table delta the spec quotes is the one measured', s == p, 'spec=%s measured=%s' % (s, p))

s = (from_spec(r'dump md5 `([0-9a-f]{8})…`', 1, 'the evaluations dump md5 prefix'),
     from_spec(r'`audit_logs` dump md5 `([0-9a-f]{8})…`', 1, 'the audit dump md5 prefix'))
p = (from_pack('04-proposed-ddl-additive-and-read-rule.txt', r'evaluations rows: \d+  dump md5 ([0-9a-f]{8})'),
     from_pack('04-proposed-ddl-additive-and-read-rule.txt', r'audit_logs rows: \d+  dump md5 ([0-9a-f]{8})'))
out('the dump md5 prefixes the spec quotes are the ones measured', s == p, 'spec=%s measured=%s' % (s, p))
out('the "unchanged by the proposal" claim matches the transcript',
    'unchanged**' in spec and 'probation_evaluations dump unchanged: true  audit_logs unchanged: true' in F['04-proposed-ddl-additive-and-read-rule.txt'])
out('the control ("the tree\'s own schema.sql adds nothing") matches the transcript',
    'as a **control** added nothing' in spec and 'new correction table present: false' in F['04-proposed-ddl-additive-and-read-rule.txt'])
out('the as_of-before-the-corrections claim matches the transcript',
    '`as_of 2026-10-25` → `null`' in spec
    and 'EFFECTIVE content as of 2026-10-25 (before both corrections): null' in F['04-proposed-ddl-additive-and-read-rule.txt'])

s = (from_spec(r'evaluation route \*\*(\d+) hits?\*\*', 1, 'the client-caller count'),
     from_spec(r'escalation route \*\*(\d+) hits?\*\*', 1, 'the escalation-caller count'))
p = tuple(from_pack('05-census-client-routes-cells.txt', r'--- %s ---\s*hits: (\d+)' % label)
          for label in [r"client callers of the evaluation route \(grep -rn 'probation-evaluations' client/src\)",
                        r"client callers of the escalation route \(grep -rn 'escalation' client/src\)"])
out('the client-caller counts the spec quotes are the ones measured', s == p, 'spec=%s measured=%s' % (s, p))

s = from_spec(r'Registered `/api` routes\s*\|\s*\*\*(\d+)\*\*', 1, 'the route count')
p = from_pack('05-census-client-routes-cells.txt', r'count: (\d+)')
out('the registered-route count the spec quotes is the one measured', s == p, 'spec=%s measured=%s' % (s, p))
out('the build\'s route count is the measured one plus one',
    from_spec(r'Route count (\d+) → (\d+)', 1) == p and str(int(p) + 1) == from_spec(r'Route count (\d+) → (\d+)', 2),
    'spec=%s measured=%s' % (from_spec(r'Route count (\d+) → (\d+)'), p))

out('the timeline-route caller and the no-caller fact are in the census the spec cites',
    'client/src/App.tsx:741' in F['05-census-client-routes-cells.txt'] and 'App.tsx:741' in spec
    and 'called by nobody' in spec
    and 'evaluationsFor' not in F['05-census-client-routes-cells.txt'].split('--- callers of the evaluation module')[1].split('---')[0])

out('the escalation-note sentence the spec reproduces is in the transcript',
    'while the app was not running' in spec and 'while the app was not running' in F['02-evaluation-surface-at-0afe5ac.txt'])

# ---- the document's own honesty markers ----
for must in ['specified, not observed', 'What was NOT measured', 'What this document does not decide',
             'The two shapes this decision rejects', 'A reason is required']:
    out('the spec keeps: ' + must, must.lower() in spec.lower())
out('the section sign survived (the spec cites sections)', spec.count('\u00a7') >= 8, 'count=%d' % spec.count('\u00a7'))
readme = open(os.path.join(PACK, 'README.md'), encoding='utf-8').read()
out('the pack README names every file in the pack',
    all(n in readme for n in list(raw) + ['check-pack.py']),
    'missing: ' + ','.join(n for n in list(raw) + ['check-pack.py'] if n not in readme))

print()
print(('ALL CHECKS PASS' if fails == 0 else '%d CHECK(S) FAILED' % fails) + ' (of %d)' % checks)
sys.exit(0 if fails == 0 else 1)
