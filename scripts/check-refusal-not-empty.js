#!/usr/bin/env node
/**
 * A REFUSED READ MUST NOT RENDER AS AN EMPTY RESULT — the regression net for the client's empty states.
 *
 * WHAT IT JUDGES, and this is the whole claim: for each panel declared below, the screen's EMPTY-STATE
 * text sits inside a branch selected by `emptyArea(panelReading.<panel>)` — the function
 * `client/src/panelReading.js` defines — and the same panel also renders its refusal sentence, and the
 * reading it branches on is produced by a `callPanel('<panel>', …)` record rather than by a bare fetch
 * whose rejection is swallowed. Three source facts, each asserted by position, so a screen that goes
 * back to deciding "empty" from the length of a list reddens here.
 *
 * WHY IT EXISTS. Measured 2026-11-08 on the deployed tree `f4729f3`: signed in as the client-demo account
 * (`demo`, `finance`), the Pre-boarding screen rendered `0 / CASES OPEN` and "No open UAE pre-boarding
 * cases — nothing outstanding to show for this jurisdiction" while `GET /api/preboarding/cases` answered
 * the policy gate's `403` (empty body) and the database held three open AE cases. The refusal reached the
 * browser console and nothing else. The plan's rule — "an empty result and a refusal must never render
 * the same" — had no instrument; this is it.
 *
 * WHAT IT CANNOT SEE, so a green run never implies otherwise:
 *   - what a browser PAINTS. It reads source; the rendered proof for this change is the screenshot pair
 *     in the PR, taken on scratch rigs. A screen whose gate is present but computed wrongly passes here
 *     and is caught by `client/src/panelReading.test.js`'s semantics instead — the two halves are
 *     deliberately different instruments.
 *   - a panel NOT declared below. The declared set is printed on every run; a new screen with an empty
 *     state is not covered until it is declared, and that is stated rather than implied.
 *   - whether the refusal itself is correct. It is not this file's question: `server/access.js` decides,
 *     and `server/panel-reading-copy.test.js` asserts the copy names the roles that cell allows.
 *
 * EXIT CODES (the team's convention, #266):
 *   0  every declared panel holds
 *   1  a panel failed — the empty state is reachable after a refusal, or the refusal arm/copy is gone
 *   2  CANNOT-JUDGE — the instrument could not run (no client source in the tree it was pointed at, or
 *      the copy module it must read is absent). Never printed as a verdict; check-all fails the run.
 *
 * USAGE
 *   node scripts/check-refusal-not-empty.js                # this repository
 *   node scripts/check-refusal-not-empty.js --tree <dir>   # another checkout (that is the mutation)
 *   node scripts/check-refusal-not-empty.js --selftest     # plants the defect in a scratch copy and
 *                                                          # requires the judgement to redden, then
 *                                                          # requires the untouched copy to pass
 */
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const DEFAULT_TREE = path.join(__dirname, "..");

/**
 * The panels this check knows about: the state slot that IS the empty state on screen, and the reading
 * the screen must branch on. `marker` is a literal from the rendered JSX — unique in the file, which is
 * asserted — so a reworded empty state reddens here instead of quietly leaving the panel unjudged.
 */
const PANELS = [
  {
    name: "preboarding_cases",
    screen: 'Pre-boarding — the "Cases open" tile',
    marker: "preboardingCases.length",
  },
  {
    name: "preboarding_overview",
    screen: "Pre-boarding — the HR roll-up",
    marker: "nothing outstanding to show for this jurisdiction",
  },
  {
    name: "probation",
    screen: "Directory — the probation timelines panel",
    marker: "{EMPTY_PANEL_SENTENCE}",
  },
];

function parseArgs(argv) {
  const out = { tree: DEFAULT_TREE, selftest: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--tree") out.tree = path.resolve(argv[++i] || "");
    else if (a === "--selftest") out.selftest = true;
    else {
      console.error(`unknown argument ${JSON.stringify(a)}`);
      console.error("usage: check-refusal-not-empty.js [--tree <dir>] [--selftest]");
      process.exit(2);
    }
  }
  return out;
}

const countOf = (haystack, needle) => haystack.split(needle).length - 1;

/** Index of the last `emptyArea(` occurrence before `limit`, or -1. */
function lastGateBefore(source, limit) {
  let best = -1;
  const needle = "emptyArea(";
  let at = source.indexOf(needle);
  while (at !== -1 && at < limit) {
    best = at;
    at = source.indexOf(needle, at + needle.length);
  }
  return best;
}

/**
 * Judge one client source. Pure: a string in, findings out — so `--selftest` can drive the same function
 * over mutated copies without a second implementation drifting from this one.
 *
 * @returns {Array<{panel: string, ok: boolean, why: string}>}
 */
function judge(source) {
  const findings = [];
  for (const panel of PANELS) {
    const problems = [];
    const markerCount = countOf(source, panel.marker);
    if (markerCount !== 1) {
      problems.push(
        `the empty state this check knows about (${JSON.stringify(panel.marker)}) occurs ${markerCount} `
          + "times in the screen — it was reworded or duplicated, so the check cannot see its subject"
      );
    } else {
      const markerAt = source.indexOf(panel.marker);
      const gateAt = lastGateBefore(source, markerAt);
      if (gateAt === -1) {
        problems.push(
          "no `emptyArea(...)` gate precedes the empty state — the screen decides \"empty\" without "
            + "consulting what the read was, which is the defect"
        );
      } else {
        const gate = source.slice(gateAt, source.indexOf(")", gateAt) + 1);
        if (gate !== `emptyArea(panelReading.${panel.name})`) {
          problems.push(
            `the empty state sits under ${JSON.stringify(gate)}, not `
              + `\`emptyArea(panelReading.${panel.name})\` — it belongs to another panel's branch`
          );
        }
      }
    }

    const sentenceCalls = countOf(source, `emptyAreaSentence('${panel.name}'`);
    if (sentenceCalls !== 1) {
      problems.push(
        `the refusal sentence for this panel is rendered ${sentenceCalls} times — a refusal must have a `
          + "place on the screen, exactly one"
      );
    }

    const recordCalls = countOf(source, `callPanel('${panel.name}'`);
    if (recordCalls !== 1) {
      problems.push(
        `the reading for this panel comes from ${recordCalls} \`callPanel('${panel.name}', …)\` calls — it `
          + "must come from exactly one panel record, never from a bare fetch whose rejection is swallowed"
      );
    }

    findings.push({
      panel: panel.name,
      ok: problems.length === 0,
      why: problems.length === 0 ? `${panel.screen}: gated, named, and fed by a panel record` : problems.join("; "),
    });
  }
  return findings;
}

/** Read a tree's client source, or say why the instrument cannot judge it. */
function readSubject(tree) {
  const app = path.join(tree, "client", "src", "App.tsx");
  if (!fs.existsSync(app)) return { error: `client/src/App.tsx is not in ${tree} — nothing to judge` };
  // The copy module is deliberately NOT required: a tree where the screen has no gate is the defect this
  // check exists to report, and it must read RED there — never CANNOT-JUDGE, and never a green zero.
  return { source: fs.readFileSync(app, "utf8") };
}

function report(findings, tree) {
  const declared = PANELS.map((p) => p.name).join(", ");
  console.log(`subject      : ${path.join(tree, "client", "src", "App.tsx")}`);
  console.log(`declared set : ${declared}  (a screen not named here is NOT judged)`);
  let bad = 0;
  for (const f of findings) {
    console.log(`  ${f.ok ? "ok  " : "FAIL"}  ${f.panel.padEnd(22)} ${f.why}`);
    if (!f.ok) bad += 1;
  }
  console.log(`panels: ${findings.length - bad} ok / ${bad} failing`);
  return bad;
}

function run(tree) {
  const subject = readSubject(tree);
  if (subject.error) {
    console.error(`CANNOT-JUDGE: ${subject.error}`);
    return 2;
  }
  const findings = judge(subject.source);
  const bad = report(findings, tree);
  return bad ? 1 : 0;
}

/**
 * Prove the judgement can redden, on THIS tree's own source. Four plants, each requiring its own
 * outcome, plus a control: the untouched copy must pass, or the plants prove nothing.
 */
function selftest() {
  const subject = readSubject(DEFAULT_TREE);
  if (subject.error) {
    console.error(`CANNOT-JUDGE: ${subject.error}`);
    return 2;
  }
  const source = subject.source;
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "refusal-not-empty-"));
  const write = (name, text) => {
    const file = path.join(scratch, name);
    fs.writeFileSync(file, text, "utf8");
    return file;
  };

  const plants = [
    {
      name: "control: the tree as it is",
      text: source,
      expectRed: false,
      what: "the shipped source must pass, or the plants below are measuring nothing",
    },
    {
      name: "plant 1: the empty state loses its gate (the pre-fix shape)",
      text: source.replace(
        "emptyArea(panelReading.probation) === EMPTY ?",
        "probationTimelines.length === 0 ?"
      ),
      expectRed: true,
      what: "a screen deciding \"empty\" without consulting the reading",
    },
    {
      name: "plant 2: the refusal sentence is deleted from the roll-up",
      text: source.replace(
        "{emptyAreaSentence('preboarding_overview', panelReading.preboarding_overview)}",
        "{null}"
      ),
      expectRed: true,
      what: "a refusal with nowhere to render",
    },
    {
      name: "plant 3: the reading comes from a bare fetch again",
      text: source.replace("callPanel('preboarding_cases',", "noPanel('preboarding_cases',"),
      expectRed: true,
      what: "a reading not produced by a panel record",
    },
    {
      name: "plant 4: the empty-state text is reworded under the gate",
      text: source.replace(
        "nothing outstanding to show for this jurisdiction",
        "no cases outstanding right now"
      ),
      expectRed: true,
      what: "the marker the check anchors on moving — a RED, never a silent skip",
    },
  ];

  let bad = 0;
  for (const plant of plants) {
    const file = write(`${plant.name.replace(/[^a-z0-9]+/gi, "-")}.txt`, plant.text);
    const findings = judge(fs.readFileSync(file, "utf8"));
    const red = findings.some((f) => !f.ok);
    const ok = red === plant.expectRed;
    console.log(`  ${ok ? "ok  " : "BAD "}  ${plant.name} -> ${red ? "RED" : "GREEN"} (want ${plant.expectRed ? "RED" : "GREEN"}): ${plant.what}`);
    if (!ok) {
      bad += 1;
      for (const f of findings) if (!f.ok) console.log(`         ${f.panel}: ${f.why}`);
    }
  }

  // The control's own proof: the same judgement on a copy with NO plant must be green, so plant 1's RED
  // is the plant and not the scratch copy.
  const control = judge(fs.readFileSync(write("control-copy.txt", source), "utf8"));
  const controlGreen = control.every((f) => f.ok);
  console.log(`  ${controlGreen ? "ok  " : "BAD "}  control: an unplanted copy of the same source is ${controlGreen ? "GREEN" : "RED"}`);
  if (!controlGreen) bad += 1;

  fs.rmSync(scratch, { recursive: true, force: true });
  console.log(`selftest: ${plants.length + 1 - bad}/${plants.length + 1} plants behaved`);
  return bad ? 1 : 0;
}

const args = parseArgs(process.argv.slice(2));
process.exit(args.selftest ? selftest() : run(args.tree));
