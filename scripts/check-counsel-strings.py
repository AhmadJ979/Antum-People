#!/usr/bin/env python3
"""check-counsel-strings.py - the counsel-string guard.

WHAT IT IS FOR
    The product serves legal text: the privacy notice as published, the refusal a client gets
    instead of a contract or a settlement statement, the three form templates (breach letters,
    DPA, DPIA), the lawful-basis catalogue the pre-boarding checklist serves, and the generated
    task checklist that is the one place a statutory article number and a deadline render on a
    screen. Counsel is going to be asked about that text (owner decision 15a). This guard makes
    an edit to it VISIBLE: every served legal string is hashed into a manifest, and a run
    reddens when a served string's bytes no longer match the manifest - an UNMARKED change.

    The only way to clear a red is to say in the same commit that the string changed and why:
        python3 scripts/check-counsel-strings.py --write-manifest --note "why this text moved"
    That writes the new hash and a `marked` block into the manifest (previous hash, note, who,
    when, the revision it was measured from). The run then reports the unit as MARKED - never as
    reviewed - and the mark is part of the diff a reviewer reads.

HOW THE HASHES ARE TAKEN (the point of the whole exercise)
    From WHAT A CLIENT RECEIVES, never from a source file. A hash of `server/privacy-notice.js`
    proves the source did not change; that is not the question. So this script boots a scratch
    instance of THE TREE IT IS RUN FROM - its own port, its own throwaway database, its own
    throwaway user (rule 14: the live demo credential is never read) - creates the fixture the
    routes need through the product's own writers, and hashes the bytes of the HTTP responses.
    Nothing here reads `templates/*.md` or a `.js` file for the text it hashes. The one thing it
    does read off disk is the LIST of template names (the documents the product ships), and that
    list is only used to decide which routes to ask for; every name is then fetched over HTTP and
    a name that serves nothing is a red, not a silent omission.

                        THE BLIND SPOT - READ THIS BEFORE QUOTING A GREEN RUN
    (1) It detects that a string CHANGED. It cannot tell whether anyone read it, whether the
        change was significant or a typo fix, or whether the new text is right or wrong. A green
        run says "nothing moved since <revision>" - it does not say "this text was reviewed".
    (2) No counsel recipient exists (the plan records none): every unit therefore starts and
        stays `unreviewed`. A manifest that claims otherwise is a false claim of exactly the
        class this repository has a rule about, so this script FAILS a run in which `reviewed_by`
        is not null or any unit carries a review marker - a review cannot be earned today.
    (3) It covers the LEGAL TEXT THE SERVER SERVES. The client-side legal strings (the 20 units
        the design inventory of 2026-10-29 counts in `client/src`) are NOT hashed: they are not
        API-served, and hashing them would mean hashing the built client bundle, which is
        gitignored and absent from a fresh tree. The manifest declares that gap by name and this
        script prints it on every run. A gap that is printed is not a silent omission; it is
        still a gap.

WHAT A RED MEANS, AND THE THREE WAYS OUT
    RED names every unit whose served bytes moved. The ways out are: revert the edit; update the
    manifest with a note that says what moved and why (the change then reads as MARKED in the
    diff); or, if the unit genuinely stopped being served or a new document appeared, add or
    remove its entry - the served set and the manifest set must be EQUAL, so a document that
    arrives with no manifest entry rides in red rather than quietly joining a green run.

USAGE
    python3 scripts/check-counsel-strings.py                    # boot a rig from THIS tree, judge
    python3 scripts/check-counsel-strings.py --selftest         # prove the controls (2 boots)
    python3 scripts/check-counsel-strings.py --print-hashes     # `id sha256` lines, for a diff
    python3 scripts/check-counsel-strings.py --write-manifest --note "..."
    python3 scripts/check-counsel-strings.py --url http://127.0.0.1:4711 --token-file T \
                                                --tree-rev <sha>      # judge a running instance
    python3 scripts/check-counsel-strings.py --manifest /tmp/m.json  # judge against another manifest

    --selftest runs the two controls the owner asked for, on a scratch COPY of this tree, and
    requires each to come out its own way:
        A. SCOPE CONTROL  - a chrome string (an item label a screen shows, no legal content) is
           edited in the copy. The served bytes demonstrably change (both readings printed) and
           the guard stays GREEN.
        B. CHANGE CONTROL - one served legal sentence is edited. The guard REDDENS, naming the
           unit whose hash moved.
        C. MARKED         - the same edit, then --write-manifest --note onto a copy of the
           manifest: the run is green and prints the unit as MARKED, review still unreviewed.

EXIT CODES (the team's convention, check-all.py classifies on these)
    0  every served legal unit matches the manifest (or moved with a mark)
    1  RED - at least one unmarked change, or a unit no longer served, or a review marker
    2  CANNOT-JUDGE - the rig could not be built or a route did not answer, so nothing is claimed

WHY NOT IN THE MOVEMENT
    Same reason as every other check: `scripts/cutover-preflight.sh` runs no checker, and a
    check that could abort a product deploy would invert the rule that a docs-only delta owes
    no movement. This is reachable from the one operator entry point, `scripts/check-all.py`.
"""
import hashlib
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MANIFEST = os.path.join(HERE, "counsel-strings-manifest.json")
TEMPLATES_DIR = os.path.join(ROOT, "templates")
PORT_RANGE = range(4891, 4901)

# The fixture. Fixed literals on purpose: every record-derived value that reaches a served
# document comes from these, so two runs on different days produce the same bytes. (The seeded
# demo cannot be used for this: its accruals are computed to "today", so a document that renders
# one would move every day and the guard would cry wolf.) The record's own id is a uuid minted by
# the product, so it is MASKED out of the served bytes before hashing - see mask().
FIXTURE = [
    dict(key="AE", payload=dict(
        first_name="Counsel", last_name="Guardrow", email="counsel.guard.ae@example.invalid",
        department="People", role="Analyst", start_date="2025-01-15",
        basic_salary=10000, salary=15000, data_residency_country="AE",
        national_id_value="784-1990-0000000-1")),
    dict(key="SA", payload=dict(
        first_name="Counsel", last_name="Guardrow", email="counsel.guard.sa@example.invalid",
        department="People", role="Analyst", start_date="2025-02-20",
        basic_salary=9000, salary=14000, data_residency_country="SA",
        national_id_value="784-1990-0000000-2")),
]
END_DATE = "2026-11-30"
CASE = dict(offer_reference="COUNSEL-GUARD-RIG", candidate_name="A Candidate", role="Analyst",
            department="People", reporting_line="Head of People", jurisdiction="AE",
            start_date="2026-12-01")

# Writes the rig's own throwaway account. `access_role` is the column name (not `role`), and the
# value is a role the product knows - `hr_admin`, whose template scope is ALL_TEMPLATES. An
# unknown role is refused with 403 by the policy gate, which reads exactly like a broken rig.
SETUP_USER_JS = r'''
const db = require("./db"), bcrypt = require("bcryptjs");
const h = bcrypt.hashSync(process.env.RIG_PASS, 12);
db.query("INSERT OR REPLACE INTO users (id,username,password_hash,access_role,created_at) VALUES (" +
  db.escapeString("counsel-guard-rig") + "," + db.escapeString("counselguard") + "," +
  db.escapeString(h) + "," + db.escapeString("hr_admin") + "," +
  db.escapeString("2026-10-02 00:00:00") + ")").then(function () {
    console.log("rig user ready");
  }).catch(function (e) {
    console.error("RIGUSERFAIL " + e.message);
    process.exit(1);
  });
'''

FAILS = []


def mask(text, ids):
    """The served bytes with the request's own identifiers replaced.

    A refusal names the record it refused (`for the record <uuid>`), and the uuid is minted by
    the product on every run - it is fixture noise, not legal text. Masking it is stated here and
    in the manifest rather than hidden: the hash covers the served sentence, not the record id.
    """
    for token, placeholder in ids:
        text = text.replace(token, placeholder)
    return text


def http(method, url, token=None, body=None, timeout=20):
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method)
    if token:
        req.add_header("Authorization", "Bearer " + token)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def free_port():
    for port in PORT_RANGE:
        with socket.socket() as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    return None


def run(cmd, cwd, env=None, timeout=180):
    return subprocess.run(cmd, cwd=cwd, env=env, capture_output=True, text=True, timeout=timeout)


def tree_files(src_root, dest_root):
    """A scratch copy of the parts of the tree a product instance needs.

    Deliberately not `git worktree`: the tree under judgement may be dirty (the guard judges
    uncommitted work too), and a worktree would silently judge the commit instead. Only the three
    directories the server reads are copied; `node_modules` is linked, never copied.
    """
    os.makedirs(dest_root, exist_ok=True)
    for name in ("server", "scripts", "templates"):
        src = os.path.join(src_root, name)
        dst = os.path.join(dest_root, name)
        if os.path.isdir(src):
            shutil.copytree(src, dst, symlinks=True,
                            ignore=shutil.ignore_patterns("node_modules", "*.db", "*.log"))
    nm = os.path.join(ROOT, "server", "node_modules")
    link = os.path.join(dest_root, "server", "node_modules")
    if os.path.isdir(nm) and not os.path.exists(link):
        os.symlink(nm, link)


class Rig(object):
    """A scratch product instance: own port, own database, own credential, own teardown."""

    def __init__(self, tree_root, label="rig"):
        self.tree_root = tree_root
        self.label = label
        self.proc = None
        self.tmp = tempfile.mkdtemp(prefix="counsel-strings-%s-" % label)
        self.db = os.path.join(self.tmp, "rig.db")
        self.log = open(os.path.join(self.tmp, "server.log"), "w")
        self.port = free_port()
        self.passwd = hashlib.sha256(os.urandom(32)).hexdigest()[:24]
        self.token = None
        self.server_dir = os.path.join(tree_root, "server")

    def start(self):
        if self.port is None:
            self.stop()
            raise CannotJudge("no free port in %s" % (list(PORT_RANGE),))
        if not os.path.isdir(os.path.join(self.server_dir, "node_modules")):
            self.stop()
            raise CannotJudge("server/node_modules is absent in %s: without it the product "
                              "cannot boot at all (link it, as the rig skill says)" % self.server_dir)
        env = dict(os.environ)
        env.update(dict(
            JWT_SECRET=hashlib.sha256(os.urandom(32)).hexdigest(),
            ENCRYPTION_KEY=hashlib.sha256(os.urandom(32)).hexdigest()[:32],
            PORT=str(self.port), PRODUCT_DB_PATH=self.db, RIG_PASS=self.passwd))
        self.env = env
        self.proc = subprocess.Popen(["node", "index.js"], cwd=self.server_dir, env=env,
                                     stdout=self.log, stderr=subprocess.STDOUT,
                                     start_new_session=True)
        base = self.base()
        for _ in range(120):
            try:
                code, _ = http("GET", base + "/api/employees")
                if code in (200, 401, 403):
                    break
            except Exception:
                pass
            if self.proc.poll() is not None:
                self.stop()
                raise CannotJudge("the product did not boot; its log is at %s" % self.log.name)
            time.sleep(0.25)
        else:
            self.stop()
            raise CannotJudge("the product did not answer on port %d" % self.port)
        setup = run(["node", "-e", SETUP_USER_JS], cwd=self.server_dir, env=env)
        if "rig user ready" not in setup.stdout:
            self.stop()
            raise CannotJudge("the rig's own account was not written: %s %s"
                              % (setup.stdout.strip(), setup.stderr.strip()[:300]))
        code, body = http("POST", base + "/api/login",
                          body=dict(username="counselguard", password=self.passwd))
        if code != 200:
            self.stop()
            raise CannotJudge("login on the rig answered %d: %s" % (code, body[:200]))
        self.token = json.loads(body)["token"]
        return self

    def base(self):
        return "http://127.0.0.1:%d" % self.port

    def stop(self):
        if self.proc is not None and self.proc.poll() is None:
            try:
                os.killpg(os.getpgid(self.proc.pid), 15)
            except Exception:
                pass
            try:
                self.proc.wait(timeout=10)
            except Exception:
                try:
                    os.killpg(os.getpgid(self.proc.pid), 9)
                except Exception:
                    pass
        try:
            self.log.close()
        except Exception:
            pass
        shutil.rmtree(self.tmp, ignore_errors=True)

    def __enter__(self):
        return self.start()

    def __exit__(self, *exc):
        self.stop()
        return False


class CannotJudge(Exception):
    """The rig could not be built or a route did not answer - exit 2, never a verdict."""


def build_fixture(base, token):
    """Create the fixture THROUGH THE PRODUCT'S OWN WRITERS, then fetch every payload."""
    ids = []
    employees = {}
    for item in FIXTURE:
        code, body = http("POST", base + "/api/employees", token, item["payload"])
        if code != 201:
            raise CannotJudge("POST /api/employees -> %d: %s" % (code, body[:200]))
        eid = json.loads(body)["id"]
        employees[item["key"]] = eid
        ids.append((eid, "<record>"))
        code, body = http("PUT", base + "/api/employees/" + eid, token,
                          dict(end_date=END_DATE, status="offboarding"))
        if code != 200:
            raise CannotJudge("PUT /api/employees/<id> -> %d: %s" % (code, body[:200]))
    code, body = http("POST", base + "/api/preboarding/cases", token, CASE)
    if code not in (200, 201):
        raise CannotJudge("POST /api/preboarding/cases -> %d: %s" % (code, body[:200]))
    case = json.loads(body)["case"]
    cid = case.get("id") or case.get("case_id")
    ids.append((cid, "<case>"))

    def get(path):
        code, body = http("GET", base + path, token)
        if code != 200:
            raise CannotJudge("GET %s -> %d: %s  (a route that does not answer is not a pass)"
                              % (path, code, body[:200]))
        return json.loads(body)

    units = []
    # A. the documents the product ships, each fetched from the route that serves it by name.
    #    The list is a directory listing - never the text: the text below comes from the response.
    names = sorted(f[:-3] for f in os.listdir(TEMPLATES_DIR) if f.endswith(".md"))
    for name in names:
        payload = get("/api/compliance/templates/%s/%s" % (name, employees["AE"]))
        content = payload.get("content")
        if not isinstance(content, str):
            raise CannotJudge("template %s served no `content` field: %s" % (name, body[:200]))
        where = "GET /api/compliance/templates/%s/<record> -> content" % name
        if payload.get("issued") is False:
            where += " (the served refusal - the document itself is withheld)"
        units.append(("doc:" + name, mask(content, ids), where))
    # B. the notice as published - served with no substitution, which is why it is the one
    #    document whose whole text reaches a client today.
    notice = get("/api/compliance/notice")
    units.append(("notice:content", mask(notice["content"], ids),
                  "GET /api/compliance/notice -> content (as published, no substitution)"))
    units.append(("notice:version", notice["version"],
                  "GET /api/compliance/notice -> version"))
    # C. the lawful-basis catalogue as the pre-boarding checklist serves it.
    checklist = get("/api/preboarding/cases/%s/checklist" % cid)
    bases = checklist["notice"]["bases"]
    for key in sorted(bases):
        units.append(("basis:" + key,
                      json.dumps(bases[key], sort_keys=True, ensure_ascii=False),
                      "GET /api/preboarding/cases/<case>/checklist -> notice.bases." + key))
    # D. the generated task checklist - the one place a statutory article number and a deadline
    #    render on a screen.
    for key, eid in sorted(employees.items()):
        for kind in ("onboarding", "offboarding"):
            tasks = get("/api/employees/%s/%s" % (eid, kind))
            if not isinstance(tasks, list) or not tasks:
                raise CannotJudge("no %s tasks were served for the %s fixture employee" % (kind, key))
            for task in tasks:
                title = task["title"]
                slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:48]
                units.append(("task:%s:%s:%s" % (kind, key.lower(), slug),
                              title + "\n" + task["description"],
                              "GET /api/employees/<record>/%s -> a task's title+description" % kind))
    return units


def hashes(units):
    return dict((uid, hashlib.sha256(text.encode("utf-8")).hexdigest()) for uid, text, _ in units)


def git(*args):
    return subprocess.run(["git", "-C", ROOT, *args], capture_output=True, text=True).stdout.strip()


def load_manifest(path):
    with open(path) as f:
        return json.load(f)


def compare(manifest, units, tree_label):
    """Print the counts and return the exit code. Never a bare verdict: every number is printed.

    The verdict is this call's OWN findings, not the module-level list: in --selftest several
    comparisons run in one process, and a red from arm B must not decide arm C's exit (measured:
    it did, and arm C read as a failure while its own run was clean).
    """
    before = len(FAILS)
    served = hashes(units)
    where = dict((uid, w) for uid, _, w in units)
    recorded = dict((u["id"], u) for u in manifest["units"])
    print("  units served     : %d   (documents %d · notice %d · bases %d · tasks %d)"
          % (len(served),
             sum(1 for i in served if i.startswith("doc:")),
             sum(1 for i in served if i.startswith("notice:")),
             sum(1 for i in served if i.startswith("basis:")),
             sum(1 for i in served if i.startswith("task:"))))
    print("  served bytes     : %d" % sum(len(t.encode("utf-8")) for _, t, _ in units))
    print("  manifest         : %d unit(s), measured from %s"
          % (len(recorded), manifest["measured_from"].get("tree_revision", "<unnamed>")))

    changed = sorted(i for i in served if i in recorded and recorded[i]["sha256"] != served[i])
    added = sorted(i for i in served if i not in recorded)
    removed = sorted(i for i in recorded if i not in served)
    marked = [i for i in changed if recorded[i].get("marked")]
    unmarked = [i for i in changed if not recorded[i].get("marked")]
    reviewed = [u for u in manifest["units"] if u.get("review") != "unreviewed"]

    print("  review markers   : %d of %d unit(s) carry one (no counsel recipient exists)"
          % (len(reviewed), len(recorded)))
    if reviewed:
        FAILS.append("the manifest claims a review (%s): no counsel recipient exists, so a "
                     "review marker cannot be earned today" % manifest.get("reviewed_by"))
    if manifest.get("reviewed_by") is not None:
        FAILS.append("the manifest names `reviewed_by` = %r: no counsel recipient exists"
                     % manifest["reviewed_by"])
    for missing in manifest.get("not_hashed", []):
        print("  not hashed       : %s - %s (%s)"
              % (missing.get("count", "?"), missing.get("what", ""), missing.get("why", "")))

    def show(word, ids, extra=""):
        for uid in ids:
            entry = recorded.get(uid)
            if entry:
                print("    %-52s served %s  recorded %s%s"
                      % (uid, served.get(uid, "-")[:16], entry["sha256"][:16],
                         "  [%s]" % entry["marked"]["note"] if entry.get("marked") else ""))
            else:
                print("    %-52s served %s  NO MANIFEST ENTRY" % (uid, served[uid][:16]))
            print("      %s" % (where.get(uid) or (recorded.get(uid) or {}).get("where", "")))

    print("  CHANGED, MARKED  : %d" % len(marked))
    if marked:
        show("marked", marked)
    print("  CHANGED, UNMARKED: %d" % len(unmarked))
    if unmarked:
        show("unmarked", unmarked)
        FAILS.append("%d served legal unit(s) changed with the manifest not updated in this "
                     "commit: %s" % (len(unmarked), ", ".join(unmarked)))
    print("  NEW / NO ENTRY   : %d" % len(added))
    if added:
        show("added", added)
        FAILS.append("%d served legal unit(s) have no manifest entry: %s" % (len(added), ", ".join(added)))
    print("  NO LONGER SERVED : %d" % len(removed))
    for uid in removed:
        print("    %-52s %s" % (uid, recorded[uid].get("where", "")))
    if removed:
        FAILS.append("%d manifest unit(s) are no longer served: %s" % (len(removed), ", ".join(removed)))
    print("  UNCHANGED        : %d" % (len(served) - len(changed) - len(added)))
    return 1 if len(FAILS) > before else 0


def do_write_manifest(path, manifest, units, tree_rev, note):
    """Rewrite the manifest from the served bytes, marking what moved.

    A unit whose hash moves WITHOUT a note is refused: the mark IS the record that someone said
    the text changed, and a rewritten hash with no sentence beside it is the silent edit this
    guard exists to make impossible.
    """
    served = hashes(units)
    where = dict((uid, w) for uid, _, w in units)
    old = dict((u["id"], u) for u in manifest.get("units", []))
    moved = sorted(i for i in served if i in old and old[i]["sha256"] != served[i])
    new_ids = sorted(i for i in served if i not in old)
    gone = sorted(i for i in old if i not in served)
    if (moved or new_ids) and not note:
        print("REFUSED: %d unit(s) moved and %d are new - --write-manifest needs --note "
              "\"what changed and why\"" % (len(moved), len(new_ids)))
        return 2
    who = os.environ.get("USER") or git("config", "user.name") or "unnamed operator"
    entries = []
    for uid, text, w in units:
        entry = dict(id=uid, sha256=served[uid], bytes=len(text.encode("utf-8")),
                     review="unreviewed", counsel_question=None, where=w, marked=None)
        if uid in old and old[uid]["sha256"] != served[uid]:
            entry["marked"] = dict(at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                                   tree_revision=tree_rev, by=who, note=note,
                                   from_sha256=old[uid]["sha256"])
        elif uid in old and old[uid].get("marked"):
            entry["marked"] = old[uid]["marked"]      # a mark is kept until the next change
        entries.append(entry)
    out = dict(manifest)
    out.update(dict(
        reviewed_by=None,
        measured_from=dict(manifest["measured_from"],
                           tree_revision=tree_rev,
                           generated_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                           generated_by=who),
        units=entries))
    with open(path, "w") as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
        f.write("\n")
    print("manifest written: %s" % path)
    print("  %d unit(s) recorded · %d changed and MARKED · %d new · %d recorded unit(s) no longer "
          "served (dropped from the manifest - say so in the commit message)"
          % (len(entries), len(moved), len(new_ids), len(gone)))
    for uid in moved:
        print("    marked: %s   %s" % (uid, note))
    for uid in gone:
        print("    dropped: %s" % uid)
    return 0


SELFTEST_CHROME = ("server/preboarding-items.js", "label: 'Passport copy'",
                   "label: 'Passport copy (scope control)'")
SELFTEST_LEGAL = ("server/compliance_engine.js",
                  "'**NOT ISSUED.** This response is not the document you asked for.",
                  "'**NOT ISSUED.** This response is not the document you asked for now.")


def selftest(tree_rev, manifest_path):
    """The two controls, run here so an operator who invokes this script alone gets them.

    Each arm is a scratch COPY of this tree with one string edited in the copy. The manifest is
    read from a COPY too, so the repository's manifest is not touched by a proving run.
    """
    bad = 0
    work = tempfile.mkdtemp(prefix="counsel-strings-selftest-")
    print("counsel-strings selftest - two controls, each on a scratch copy of this tree")
    print("  scratch root: %s" % work)
    try:
        base_tree = os.path.join(work, "clean")
        tree_files(ROOT, base_tree)
        manifest_copy = os.path.join(base_tree, "scripts", "counsel-strings-manifest.json")
        shutil.copyfile(manifest_path, manifest_copy)
        print("\n  ARM 0 - the clean copy: the guard must be GREEN against its own manifest")
        with Rig(base_tree, "clean") as rig:
            units = build_fixture(rig.base(), rig.token)
        code0 = compare(load_manifest(manifest_copy), units, "clean copy")
        print("  arm 0 exit=%d (want 0)" % code0)
        bad += 0 if code0 == 0 else 1

        # ---- ARM A: the SCOPE control - a chrome string moves, the guard stays green --------
        print("\n  ARM A - SCOPE CONTROL: an item LABEL (chrome the screen shows, no legal "
              "content) is edited; the guard must stay GREEN")
        tree_a = os.path.join(work, "chrome")
        tree_files(ROOT, tree_a)
        path_a = os.path.join(tree_a, SELFTEST_CHROME[0])
        src = open(path_a).read()
        if SELFTEST_CHROME[1] not in src:
            print("  FAIL  the chrome plant is not in %s: %r" % (SELFTEST_CHROME[0], SELFTEST_CHROME[1]))
            return 1
        open(path_a, "w").write(src.replace(SELFTEST_CHROME[1], SELFTEST_CHROME[2], 1))
        with Rig(tree_a, "chrome") as rig:
            units_a = build_fixture(rig.base(), rig.token)
            code, body = http("GET", rig.base() + "/api/preboarding/cases", rig.token)
            cid = json.loads(body)["cases"][0]["id"]
            code, body = http("GET", rig.base() + "/api/preboarding/cases/%s/checklist" % cid, rig.token)
            served_label = [i["label"] for i in json.loads(body)["items"] if i["item_key"] == "passport"][0]
        print("  the chrome string as served: before %r  after %r" % ("Passport copy", served_label))
        code_a = compare(load_manifest(manifest_copy), units_a, "chrome copy")
        print("  arm A exit=%d (want 0 - a chrome edit is not this guard's business)" % code_a)
        if served_label != "Passport copy (scope control)":
            print("  FAIL  the chrome string is not what moved: the control proves nothing")
            bad += 1
        bad += 0 if code_a == 0 else 1

        # ---- ARM B: the CHANGE control - one served legal sentence moves, RED --------------
        print("\n  ARM B - CHANGE CONTROL: one served LEGAL sentence is edited; the guard must "
              "REDDEN and name the unit")
        tree_b = os.path.join(work, "legal")
        tree_files(ROOT, tree_b)
        path_b = os.path.join(tree_b, SELFTEST_LEGAL[0])
        src = open(path_b).read()
        if SELFTEST_LEGAL[1] not in src:
            print("  FAIL  the legal plant is not in %s: %r" % (SELFTEST_LEGAL[0], SELFTEST_LEGAL[1]))
            return 1
        open(path_b, "w").write(src.replace(SELFTEST_LEGAL[1], SELFTEST_LEGAL[2], 1))
        with Rig(tree_b, "legal") as rig:
            units_b = build_fixture(rig.base(), rig.token)
        before = len(FAILS)
        code_b = compare(load_manifest(manifest_copy), units_b, "legal copy")
        named = ", ".join(FAILS[before:])
        print("  arm B exit=%d (want 1) - the red names: %s" % (code_b, named))
        if code_b != 1 or "doc:" not in named:
            print("  FAIL  the change control did not redden on the legal unit by name")
            bad += 1

        # ---- ARM C: the same edit, MARKED ------------------------------------------------
        print("\n  ARM C - the same edit, then the manifest is updated WITH a note: the run must "
              "be green and print the unit as MARKED, review still unreviewed")
        manifest_c = os.path.join(work, "manifest-c.json")
        shutil.copyfile(manifest_copy, manifest_c)
        rc = do_write_manifest(manifest_c, load_manifest(manifest_c), units_b, tree_rev,
                               "selftest: one word of the refusal sentence moved (arm C)")
        out = open(manifest_c).read()
        marks = json.loads(out)
        marked = [u["id"] for u in marks["units"] if u.get("marked")]
        print("  marked units in the rewritten manifest: %s" % ", ".join(marked))
        before = len(FAILS)
        code_c = compare(load_manifest(manifest_c), units_b, "legal copy, marked")
        print("  arm C exit=%d (want 0)" % code_c)
        if rc != 0 or code_c != 0 or not marked or marks["reviewed_by"] is not None:
            print("  FAIL  a marked change did not read as green-marked-and-unreviewed")
            bad += 1
        # the honesty control: a manifest that claims a review must FAIL
        dishonest = json.loads(out)
        dishonest["units"][0]["review"] = "reviewed_by_counsel"
        dpath = os.path.join(work, "manifest-dishonest.json")
        json.dump(dishonest, open(dpath, "w"))
        before = len(FAILS)
        code_d = compare(load_manifest(dpath), units_b, "dishonest manifest")
        print("  arm D (extra): a manifest claiming a review -> exit=%d (want 1)" % code_d)
        if code_d != 1:
            print("  FAIL  a false review claim was not refused")
            bad += 1
    finally:
        shutil.rmtree(work, ignore_errors=True)
    print("\nselftest: %s" % ("all arms behaved as required" if not bad else "%d arm(s) FAILED" % bad))
    return 1 if bad else 0


def parse(argv):
    opts = dict(url=None, token_file=None, tree_rev=None, manifest=MANIFEST,
                note=None, write=False, selftest=False, print_hashes=False)
    i = 1
    while i < len(argv):
        a = argv[i]
        if a == "--selftest":
            opts["selftest"] = True
        elif a == "--write-manifest":
            opts["write"] = True
        elif a == "--print-hashes":
            opts["print_hashes"] = True
        elif a in ("--url", "--token-file", "--tree-rev", "--manifest", "--note"):
            if i + 1 >= len(argv):
                print("REFUSED: %s needs a value" % a)
                return None
            opts[a[2:].replace("-", "_")] = argv[i + 1]
            i += 1
        else:
            print("REFUSED: %r is not an option this script understands. It refuses rather than "
                  "guessing, because a run that tested nothing must not exit 0." % a)
            return None
        i += 1
    return opts


def main(argv):
    opts = parse(argv)
    if opts is None:
        return 2
    if opts["selftest"]:
        return selftest(git("rev-parse", "--short", "HEAD") or "<unknown>", opts["manifest"])

    tree_rev = git("rev-parse", "--short", "HEAD") or "<unknown>"
    dirty = [l for l in git("status", "--porcelain").splitlines() if l.strip() and not l.startswith("??")]
    print("=" * 100)
    print("counsel-strings - the legal text this product SERVES, hashed so an edit cannot be quiet")
    print("  tree judged      : %s%s" % (tree_rev,
          "" if not dirty else "  (DIRTY: %d tracked path(s) modified - the served bytes are not "
                               "the commit's)" % len(dirty)))
    print("  repository       : %s" % ROOT)
    print("  manifest         : %s" % opts["manifest"])
    print("  blind spot       : this detects that a string CHANGED. It cannot tell whether anyone "
          "read it,\n                     whether the edit was legally significant or a typo fix, "
          "or whether the new text is right.")
    print("=" * 100)
    try:
        if opts["url"]:
            base = opts["url"].rstrip("/")
            if not opts["token_file"]:
                raise CannotJudge("--url needs --token-file: nothing here logs in to a live "
                                  "instance, and the demo credential is not this script's to read")
            if not opts["tree_rev"]:
                raise CannotJudge("--url needs --tree-rev <sha>: a hash must name the revision it "
                                  "was measured from, and a running instance's revision cannot be "
                                  "read off it")
            token = open(opts["token_file"]).read().strip()
            tree_rev = opts["tree_rev"]
            print("  served from      : %s (given, not booted here)" % base)
            units = build_fixture(base, token)
        else:
            print("  served from      : a scratch instance of THIS tree (own port, throwaway DB, "
                  "throwaway user)")
            with Rig(ROOT, "judge") as rig:
                print("                     port %d · database %s" % (rig.port, rig.db))
                units = build_fixture(rig.base(), rig.token)
    except CannotJudge as e:
        print("\nCANNOT-JUDGE: %s" % e)
        print("VERDICT: nothing was judged. exit 2")
        return 2
    if opts["print_hashes"]:
        for uid in sorted(hashes(units)):
            print("%s %s" % (uid, hashes(units)[uid]))
        return 0
    manifest = load_manifest(opts["manifest"])
    if opts["write"]:
        return do_write_manifest(opts["manifest"], manifest, units, tree_rev, opts["note"])
    code = compare(manifest, units, tree_rev)
    print()
    if code:
        for line in FAILS:
            print("  RED: %s" % line)
        print("VERDICT: the served legal text moved without a mark. exit 1")
    else:
        print("VERDICT: every served legal unit matches the manifest. This says the text did not "
              "move since %s - it does NOT say anybody read it. exit 0" % tree_rev)
    return code


if __name__ == "__main__":
    sys.exit(main(sys.argv))
