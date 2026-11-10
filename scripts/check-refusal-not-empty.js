#!/usr/bin/env node
/**
 * A REFUSED READ MUST NOT RENDER AS AN EMPTY RESULT — the regression net for the client's empty states.
 *
 * WHAT IT JUDGES, and this is the whole claim. For each SITE declared below, the screen's empty state
 * sits inside an arm selected by `emptyArea(...)` — the function `client/src/panelReading.js` defines —
 * and the gate in that arm is the reading of the panel that feeds the site. Three source facts, each
 * asserted by position:
 *
 *   1. the site's ANCHOR (the gate line plus the JSX it guards) occurs exactly once — so a screen that
 *      goes back to deciding "empty" from the length of a list a refusal left behind reddens here;
 *   2. the anchor carries the gate for the DECLARED panel — not a sibling panel's gate, which is the
 *      shape a copy-pasted arm takes;
 *   3. the empty state's own marker occurs exactly once and AFTER the anchor — so it is inside the arm
 *      the gate selects, and a reworded marker is a RED rather than a silently unjudged panel.
 * Per panel it additionally asserts that the reading comes from exactly one `callPanel('<panel>', …)`
 * record (never a bare fetch whose rejection is swallowed) and that the panel's refusal sentence has a
 * place on the screen.
 *
 * WHY IT EXISTS. Measured 2026-11-08 on the deployed tree `f4729f3`: signed in as the client-demo account
 * (`demo`, `finance`), the Pre-boarding screen rendered `0 / CASES OPEN` and "No open UAE pre-boarding
 * cases — nothing outstanding to show for this jurisdiction" while `GET /api/preboarding/cases` answered
 * the policy gate's `403` (empty body) and the database held three open AE cases. The refusal reached the
 * browser console and nothing else. The plan's rule — "an empty result and a refusal must never render
 * the same" — had no instrument; this is it.
 *
 * WIDENED 2026-11-08 (#392 fixed three panels and NAMED the rest as unfixed; this change closes them):
 * the Dashboard's four stat cards and its two pipelines, the Directory roster, the Transitions tab and the
 * employee detail's transition checklist are declared here too. Every one of them decided "empty" from a
 * list length. The pre-fix tree is the mutation: `--tree` pointed at it reddens on every site it does not
 * have, which is how the class is proved rather than asserted.
 *
 * WIDENED AGAIN 2026-11-10, by enumerating the class rather than by trusting the list: the Strategic
 * Intelligence tab was in neither #392's enumeration nor the first pass over this file. Its executive
 * summary banner is computed FROM the analytics payload, so a refused read rendered "Retention lift has
 * stabilized in recent cohorts." and "Average Time-to-Value is 0 days." — a refusal drawn as a claim
 * about data the account may not read — and its three charts drew an empty Retention Lift, "Insufficient
 * productivity data." and a forecast grid with no bars. Both are declared below. The account that is
 * refused this panel is `manager` (`analytics:read` excludes it); `demo` (finance) and `admin`
 * (hr_admin) hold the cell, so for them these two sites are the CONTROL — the gate must not fire.
 *
 * WHAT IT CANNOT SEE, so a green run never implies otherwise:
 *   - what a browser PAINTS. It reads source; the rendered proof is the DOM transcript in the PR, taken on
 *     scratch rigs. A screen whose gate is present but computed wrongly passes here and is caught by
 *     `client/src/panelReading.test.js`'s semantics instead — the two halves are deliberately different
 *     instruments.
 *   - a site NOT declared below. The declared set is printed on every run; a new screen with an empty
 *     state is not covered until it is declared, and that is stated rather than implied.
 *   - WHICH site renders a panel's refusal sentence. A panel that feeds more than one site (the roster
 *     feeds the Directory table, the Transitions tab and the dashboard's offboarding pipeline) has one
 *     sentence per site and this check only requires that the panel has a place on the screen at all. The
 *     per-site half is the anchor: it says the empty state is behind the right gate, not that the refusal
 *     beside it is in the right place.
 *   - whether the refusal itself is correct. It is not this file's question: `server/access.js` decides,
 *     and `server/panel-reading-copy.test.js` asserts the copy names the roles that cell allows.
 *
 * EXIT CODES (the team's convention, #266):
 *   0  every declared site holds
 *   1  a site failed — the empty state is reachable after a refusal, or its gate/anchor is gone
 *   2  CANNOT-JUDGE — the instrument could not run (no client source in the tree it was pointed at).
 *      Never printed as a verdict; check-all fails the run.
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
 * The panels: the panel name the screen keeps its reading under (it is the `callPanel` name), the
 * `callPanel` call that must produce it, and the refusal sentence it must render.
 */
const PANELS = [
  {
    name: "preboarding_cases",
    record: "callPanel('preboarding_cases'",
    sentence: "emptyAreaSentence('preboarding_cases'",
  },
  {
    name: "preboarding_overview",
    record: "callPanel('preboarding_overview'",
    sentence: "emptyAreaSentence('preboarding_overview'",
  },
  {
    name: "probation",
    record: "callPanel('probation'",
    sentence: "emptyAreaSentence('probation'",
  },
  {
    name: "analytics",
    record: "callPanel('analytics'",
    sentence: "emptyAreaSentence('analytics'",
  },
  {
    name: "employees",
    record: "callPanel('employees'",
    sentence: "emptyAreaSentence('employees'",
  },
  // The two task panels share ONE render site: the checklist picks its panel from the employee's status
  // (`selectedTaskPanel`), which is why their sentence is a variable call and their record is asserted
  // per panel while the sentence is asserted once for both.
  {
    name: "onboarding",
    record: "callPanel('onboarding'",
    sentence: "emptyAreaSentence(selectedTaskPanel",
  },
  {
    name: "offboarding",
    record: "callPanel('offboarding'",
    sentence: "emptyAreaSentence(selectedTaskPanel",
  },
];

/**
 * The sites: `anchor` is a literal from the render that CONTAINS the gate and the JSX the gate guards,
 * unique in the file (asserted); `gate` is the exact gate expression the anchor must carry; `marker` is
 * the empty-state literal, unique in the file (asserted) and required to sit AFTER the anchor.
 */
const SITES = [
  {
    site: "dashboard_cards",
    screen: "Dashboard — the four stat cards",
    panel: "analytics",
    gate: "emptyArea(panelReading.analytics)",
    anchor: "              {emptyArea(panelReading.analytics) === EMPTY ? (\n"
      + "              <div className=\"grid grid-cols-1 md:grid-cols-4 gap-6\">",
    marker: "Retention Lift (1-yr)",
  },
  {
    site: "dashboard_onboarding",
    screen: "Dashboard — the Onboarding Pipeline card",
    panel: "analytics",
    gate: "emptyArea(panelReading.analytics)",
    anchor: "                {emptyArea(panelReading.analytics) === EMPTY ? (\n"
      + "                <div className=\"bg-white p-6 rounded-xl shadow-sm border border-slate-200\">\n"
      + "                  <h3 className=\"font-bold text-slate-900 mb-4 flex justify-between items-center\">\n"
      + "                    <span>Onboarding Pipeline</span>",
    marker: "No active onboardings.",
  },
  {
    site: "dashboard_offboarding",
    screen: "Dashboard — the Offboarding Pipeline card",
    panel: "employees",
    gate: "emptyArea(panelReading.employees)",
    anchor: "                {emptyArea(panelReading.employees) === EMPTY ? (\n"
      + "                <div className=\"bg-white p-6 rounded-xl shadow-sm border border-slate-200\">\n"
      + "                  <h3 className=\"font-bold text-slate-900 mb-4 flex justify-between items-center\">\n"
      + "                    <span>Offboarding Pipeline</span>",
    marker: "No active offboardings.",
  },
  {
    site: "roster",
    screen: "Directory — the roster table",
    panel: "employees",
    gate: "emptyArea(panelReading.employees)",
    anchor: "              {emptyArea(panelReading.employees) === EMPTY ? (\n"
      + "              <div className=\"bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden\">\n"
      + "                <table className=\"w-full text-left border-collapse\">",
    marker: "Gratuity Accrued",
  },
  {
    site: "transitions",
    screen: "Transitions — the two transition lists",
    panel: "employees",
    gate: "emptyArea(panelReading.employees)",
    anchor: "            emptyArea(panelReading.employees) === EMPTY ? (\n"
      + "            <div className=\"grid grid-cols-1 md:grid-cols-2 gap-8\">",
    marker: "Ramping Employees (Onboarding)",
  },
  {
    site: "employee_tasks",
    screen: "Employee detail — the transition checklist",
    panel: "onboarding/offboarding",
    gate: "emptyArea(panelReading[selectedTaskPanel])",
    anchor: "                        emptyArea(panelReading[selectedTaskPanel]) === EMPTY ? (\n"
      + "                          <div className=\"py-12 text-center text-slate-400 text-sm italic\">"
      + "No tasks generated for this stage.</div>",
    marker: "No tasks generated for this stage.",
  },
  {
    site: "probation",
    screen: "Directory — the probation timelines panel",
    panel: "probation",
    gate: "emptyArea(panelReading.probation)",
    anchor: "                {probationTimelines.length === 0 ? (\n"
      + "                  emptyArea(panelReading.probation) === EMPTY ? (",
    marker: "{EMPTY_PANEL_SENTENCE}",
  },
  {
    site: "preboarding_cases",
    screen: 'Pre-boarding — the "Cases open" tile',
    panel: "preboarding_cases",
    gate: "emptyArea(panelReading.preboarding_cases)",
    anchor: "{emptyArea(panelReading.preboarding_cases) === EMPTY",
    marker: "preboardingCases.length",
  },
  {
    site: "preboarding_overview",
    screen: "Pre-boarding — the HR roll-up",
    panel: "preboarding_overview",
    gate: "emptyArea(panelReading.preboarding_overview)",
    anchor: "{emptyArea(panelReading.preboarding_overview) !== EMPTY ? (",
    marker: "nothing outstanding to show for this jurisdiction",
  },
  {
    site: "analytics_banner",
    screen: "Strategic Intelligence — the executive summary banner",
    panel: "analytics",
    gate: "emptyArea(panelReading.analytics)",
    anchor: "              {emptyArea(panelReading.analytics) === EMPTY ? (\n"
      + "              <div className=\"bg-teal-900 text-white p-8 rounded-2xl shadow-xl\">",
    marker: "Strategic Workforce Intelligence",
  },
  {
    site: "analytics_charts",
    screen: "Strategic Intelligence — the three charts",
    panel: "analytics",
    gate: "emptyArea(panelReading.analytics)",
    anchor: "              {emptyArea(panelReading.analytics) === EMPTY ? (\n"
      + "              <div className=\"grid grid-cols-1 lg:grid-cols-2 gap-8\">\n"
      + "                {/* Retention Lift Chart */}",
    marker: "Avg days to full productivity (Illustrative Target)",
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

/**
 * Judge one client source. Pure: a string in, findings out — so `--selftest` can drive the same function
 * over mutated copies without a second implementation drifting from this one.
 *
 * @returns {Array<{site: string, ok: boolean, why: string}>}
 */
function judge(source) {
  const findings = [];

  for (const s of SITES) {
    const problems = [];
    const anchorCount = countOf(source, s.anchor);
    const markerCount = countOf(source, s.marker);

    if (anchorCount !== 1) {
      problems.push(
        `the gate this site is declared by occurs ${anchorCount} times — the screen no longer has `
          + `\`${s.gate}\` guarding this block, which is the pre-fix shape`
      );
    } else if (!s.anchor.includes(s.gate)) {
      problems.push(`the anchor does not carry the declared gate \`${s.gate}\``);
    }

    if (markerCount !== 1) {
      problems.push(
        `the empty state this check knows about (${JSON.stringify(s.marker)}) occurs ${markerCount} `
          + "times in the screen — it was reworded or duplicated, so the check cannot see its subject"
      );
    } else if (anchorCount === 1 && source.indexOf(s.marker) < source.indexOf(s.anchor)) {
      problems.push(
        "the empty state sits BEFORE the gate — it is not inside the arm the reading selects"
      );
    }

    findings.push({
      site: s.site,
      ok: problems.length === 0,
      why: problems.length === 0 ? `${s.screen}: gated on ${s.panel}` : problems.join("; "),
    });
  }

  for (const p of PANELS) {
    const problems = [];
    const records = countOf(source, p.record);
    if (records !== 1) {
      problems.push(
        `the reading for this panel comes from ${records} \`${p.record}\` calls — it must come from `
          + "exactly one panel record, never from a bare fetch whose rejection is swallowed"
      );
    }
    const sentences = countOf(source, p.sentence);
    if (sentences < 1) {
      problems.push("the refusal sentence for this panel is rendered nowhere — a refusal must have a place on the screen");
    }
    findings.push({
      site: `panel:${p.name}`,
      ok: problems.length === 0,
      why: problems.length === 0
        ? `one panel record, and its refusal sentence has a place`
        : problems.join("; "),
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
  console.log(`subject      : ${path.join(tree, "client", "src", "App.tsx")}`);
  console.log(`declared set : ${SITES.map((s) => s.site).join(", ")}  (a screen not named here is NOT judged)`);
  let bad = 0;
  for (const f of findings) {
    console.log(`  ${f.ok ? "ok  " : "FAIL"}  ${f.site.padEnd(22)} ${f.why}`);
    if (!f.ok) bad += 1;
  }
  console.log(`sites: ${findings.length - bad} ok / ${bad} failing`);
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
 * Prove the judgement can redden, on THIS tree's own source. Six plants, each requiring its own
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
      name: "plant 1: the roster loses its gate (the pre-fix shape)",
      text: source.replace(
        "              {emptyArea(panelReading.employees) === EMPTY ? (\n"
          + "              <div className=\"bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden\">\n"
          + "                <table className=\"w-full text-left border-collapse\">",
        "              <div className=\"bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden\">\n"
          + "                <table className=\"w-full text-left border-collapse\">"
      ),
      expectRed: true,
      what: "a screen deciding \"empty\" without consulting the reading",
    },
    {
      name: "plant 2: the checklist's empty state is decided by list length alone",
      text: source.replace(
        "                        emptyArea(panelReading[selectedTaskPanel]) === EMPTY ? (\n"
          + "                          <div className=\"py-12 text-center text-slate-400 text-sm italic\">"
          + "No tasks generated for this stage.</div>",
        "                          <div className=\"py-12 text-center text-slate-400 text-sm italic\">"
          + "No tasks generated for this stage.</div>"
      ),
      expectRed: true,
      what: "the employee-detail empty state the demo account actually hit",
    },
    {
      name: "plant 3: a site is gated on the WRONG panel's reading",
      text: source.replace(
        "                {emptyArea(panelReading.employees) === EMPTY ? (\n"
          + "                <div className=\"bg-white p-6 rounded-xl shadow-sm border border-slate-200\">\n"
          + "                  <h3 className=\"font-bold text-slate-900 mb-4 flex justify-between items-center\">\n"
          + "                    <span>Offboarding Pipeline</span>",
        "                {emptyArea(panelReading.analytics) === EMPTY ? (\n"
          + "                <div className=\"bg-white p-6 rounded-xl shadow-sm border border-slate-200\">\n"
          + "                  <h3 className=\"font-bold text-slate-900 mb-4 flex justify-between items-center\">\n"
          + "                    <span>Offboarding Pipeline</span>"
      ),
      expectRed: true,
      what: "a copy-pasted arm guarding the wrong panel's data",
    },
    {
      name: "plant 4: the reading comes from a bare fetch again",
      text: source.replace("callPanel('preboarding_cases',", "noPanel('preboarding_cases',"),
      expectRed: true,
      what: "a reading not produced by a panel record",
    },
    {
      name: "plant 5: the empty-state text is reworded under the gate",
      text: source.replace(
        "nothing outstanding to show for this jurisdiction",
        "no cases outstanding right now"
      ),
      expectRed: true,
      what: "the marker the check anchors on moving — a RED, never a silent skip",
    },
    {
      name: "plant 6: the Strategic Intelligence banner loses its gate (the pre-fix shape)",
      text: source.replace(
        "              {emptyArea(panelReading.analytics) === EMPTY ? (\n"
          + "              <div className=\"bg-teal-900 text-white p-8 rounded-2xl shadow-xl\">",
        "              <div className=\"bg-teal-900 text-white p-8 rounded-2xl shadow-xl\">"
      ),
      expectRed: true,
      what: "the banner deciding for itself that a refused read was an empty one",
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
      for (const f of findings) if (!f.ok) console.log(`         ${f.site}: ${f.why}`);
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
