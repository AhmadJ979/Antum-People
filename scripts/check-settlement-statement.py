#!/usr/bin/env python3
"""check-settlement-statement.py - the movement's settlement check, re-grounded to what the
product actually does since #325 (a document naming a fact we do not hold is NOT ISSUED).

WHAT THIS REPLACES, AND WHY
    Until now scripts/deploy-main.sh step 5 compared the rendered EOSB against the employee
    record and printed `match: False` on every movement, because the product now CORRECTLY
    refuses to render: `issued: false` with a figureless notice. A check that is red on the
    product's truthful behaviour is not a check - it is noise that hides a real red. This
    asserts each of the two states a correct product can be in, and it can still redden on a
    body that is inconsistent with either.

THE TWO BRANCHES (the payload is the one the route serves; see server/index.js:684-695)
    issued: false  -> `missing_fields` must name at least one unheld fact, AND the content must
                      carry no amount, AND it must carry none of the statement's own lines.
    issued: true   -> the rendered EOSB must equal the record's `eosb_accrued` (to a cent).
    anything else  -> FAIL. An absent verdict is not a pass.

WHY "NO AMOUNT" IS "NO FIGURE OTHER THAN THE LITERAL 0.00"
    The refusal document's own prose says it will not fill a hole with "a plausible licence
    number, a party name or a 0.00" (server/compliance_engine.js refusalDocument), so the
    honest, correct refusal DOES contain the token `0.00`. Asserting "no figure at all" would
    redden on the product being right - the exact defect this file exists to remove. A zero is
    not an amount the statement could be read out of; every real figure in the statement is
    rendered into a table cell by the template (templates/final-settlement-statement.md:28).

Usage (as the movement calls it):
    python3 scripts/check-settlement-statement.py PAYLOAD.json PRODUCT_DB EMPLOYEE_ID
Exit 0 = the served document is consistent with the record. Exit 1 = RED (each failed
assertion is named). Exit 2 = CANNOT-JUDGE (the payload or the record could not be read).
"""
import json
import re
import sqlite3
import sys

ISSUED = "issued"
# A rendered amount. The `(?<![\d.])` / `(?![\d])` pair keeps `v2.3.1` and `19.82478` out.
FIGURE = re.compile(r"(?<![\d.])\d[\d,]*\.\d{2}(?![\d])")
# The statement's own EOSB row, as the template writes it and the engine fills it:
#   | **End of Service Benefit (EOSB) / <arabic>** | **[eosb_amount]** |
EOSB_ROW = re.compile(r"EOSB[^|]*\|\s*\*{0,2}([0-9][0-9,]*\.[0-9]{2})")
# Lines the statement carries and a refusal must not (its own claim: "no clause, no signature
# block and no figure" - these are the figure-bearing and signature-bearing rows).
STATEMENT_LINES = ("NET PAYABLE AMOUNT:", "End of Service Benefit (EOSB)", "Signature")
# The one figure the honest refusal legitimately carries (its own prose, quoted above).
REFUSAL_PROSE_FIGURE = "0.00"

fails = 0


def verdict(ok, label, note=""):
    global fails
    print(("OK   " if ok else "FAIL ") + label)
    if note and not ok:
        print("       " + note)
    if not ok:
        fails += 1


def main(argv):
    if len(argv) < 2:
        print("CANNOT-JUDGE: usage: check-settlement-statement.py PAYLOAD.json [PRODUCT_DB EMPLOYEE_ID]")
        return 2
    payload_path = argv[1]
    try:
        data = json.load(open(payload_path))
    except Exception as exc:                                        # noqa: BLE001
        print("CANNOT-JUDGE: %s is not readable JSON (%s)" % (payload_path, exc))
        return 2
    if not isinstance(data, dict) or "content" not in data or not isinstance(data["content"], str) \
            or not data["content"].strip():
        print("CANNOT-JUDGE: %s carries no document content - nothing to judge" % payload_path)
        return 2
    content = data["content"]

    print("  payload: %s (%d bytes of content)" % (payload_path, len(content)))
    if ISSUED not in data:
        verdict(False, "the payload states no `issued` verdict",
                "the route serves `issued` on both branches (server/index.js:686, :695); without it "
                "there is nothing to assert against")
        return 1

    if data[ISSUED] is False:
        print("  branch: NOT ISSUED - the document must be a figureless refusal")
        missing = data.get("missing_fields")
        verdict(bool(missing) and isinstance(missing, list),
                "missing_fields names the facts the document is withheld for: %r"
                % (missing,),
                "an unissued document that names no missing fact is a refusal with no cause")
        figures = [m.group(0) for m in FIGURE.finditer(content) if m.group(0) != REFUSAL_PROSE_FIGURE]
        verdict(not figures,
                "the refusal carries no amount (figures other than the prose %s: %r)"
                % (REFUSAL_PROSE_FIGURE, figures),
                "a refusal that renders a figure can be read out as the document")
        leaked = [s for s in STATEMENT_LINES if s in content]
        verdict(not leaked,
                "the refusal carries no part of the statement itself (leaked: %r)" % (leaked,),
                "the withheld document's own lines are in the body")
    elif data[ISSUED] is True:
        print("  branch: ISSUED - the rendered EOSB must equal the record")
        if len(argv) < 4:
            verdict(False, "an ISSUED statement with no record to compare against",
                    "pass PRODUCT_DB and EMPLOYEE_ID, or the match cannot be measured")
            return 1
        db_path, employee_id = argv[2], argv[3]
        try:
            row = sqlite3.connect(db_path).execute(
                "select eosb_accrued from employees where id=?", (employee_id,)).fetchone()
        except Exception as exc:                                    # noqa: BLE001
            print("CANNOT-JUDGE: could not read %s (%s)" % (db_path, exc))
            return 2
        if row is None:
            verdict(False, "the record %s is not in %s" % (employee_id, db_path))
            return 1
        record = row[0]
        rendered = None
        for line in content.split("\n"):
            m = EOSB_ROW.search(line)
            if m:
                rendered = m.group(1)
                break
        verdict(rendered is not None,
                "the issued statement renders an EOSB row (record holds %r)" % (record,),
                "the statement was issued with no EOSB row to compare")
        if rendered is not None:
            verdict(record is not None
                    and abs(float(rendered.replace(",", "")) - float(record)) < 0.01,
                    "rendered EOSB %s == record eosb_accrued %r" % (rendered, record),
                    "the rendered figure is not the record's - one of the two is being invented")
    else:
        verdict(False, "`issued` is %r, which is neither true nor false" % (data[ISSUED],),
                "an unreadable verdict must not read as a pass")

    print("  settlement check: %s" % ("OK" if not fails else "RED (%d failed assertion(s))" % fails))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
