/**
 * THE PROBATION TERM A CLIENT CHOOSES — ONE FACT, TWO UNITS
 * --------------------------------------------------------
 * Owner ruling 2026-11-11: *"Probation is 3 months by default, but some clients may change it to 6
 * months based on their policy, so we make two options so the client will choose one."*
 *
 * The choice is recorded ONCE, on the employer row (`employers.probation_days`), because it is the
 * client's policy and not a per-employee arrangement. It is stored in DAYS, and that is the whole
 * point of this module: the two jurisdictions' statutes count in different units, so one stored value
 * has to print as two different phrases, and the old failure mode is recorded at
 * `server/compliance_engine.js` line 101 — the same value printing as "6 months" in the UAE contract
 * and "6 days" in the KSA one, because the templates' units were never reconciled with the fact.
 *
 *   * UAE — the statute counts in MONTHS: 90 days prints "3 months", 180 days prints "6 months";
 *   * KSA — the statute counts in DAYS: 90 prints "90 days", 180 prints "180 days". A calendar-month
 *     expression is NOT a lawful way to say the KSA ceiling (six calendar months is 181–184 days, so
 *     it always exceeds 180), and nothing here may print months into a KSA contract.
 *
 * WHAT THIS MODULE REFUSES, each one a defect it exists to stop:
 *
 *   * NO DEFAULT. A null `probation_days` is "nobody has chosen", not "3 months". The contract is
 *     withheld and the refusal names the fact, exactly as for every other blank employer fact.
 *   * NO TERM WITHOUT A JURISDICTION. The unit is a legal question, not a formatting one: with no
 *     jurisdiction there is no lawful way to write the term down, so it is refused rather than
 *     guessed at months.
 *   * NO EXTENSION EVIDENCE ANYWHERE BUT KSA 180. The UAE has no extension mechanism (the "one
 *     extension allowed" rule in our own record is the repealed 1980 law — see
 *     `compliance-requirements.md` line 39), and a 90-day KSA term has nothing to extend. Evidence
 *     recorded against either is refused by name, both on save and at issue.
 *   * NO KSA 180 WITHOUT THE WRITTEN AGREEMENT. A 180-day KSA term holds only where the parties
 *     agreed a written extension; without a reference and a date the product would be recording a
 *     term enforceable only to day 90 — the same class of defect as a document that prints a term
 *     nobody agreed. So the choice cannot be SAVED, and the contract cannot be ISSUED, without them.
 *
 * Nothing here takes a request or an actor: the term comes from the employer row and from nowhere
 * else, the same rule `server/employers.js` holds for the rest of the employer's facts.
 */
const { REQUIRED_FACTS } = require('./compliance_engine');

/** The two options the client may choose between. Nothing else is a term this product records. */
const TERMS = Object.freeze([90, 180]);

/** The three columns the choice lives in — declared here so the schema, the write and the screen
 *  cannot disagree about a name. `probation_days` carries the fact; the other two carry the evidence
 *  that makes the KSA 180-day option lawful. */
const COLUMNS = Object.freeze([
  'probation_days',
  'probation_extension_reference',
  'probation_extension_date',
]);

/**
 * The labels a refusal uses, taken from the engine's own table so the screen, the refusal and the
 * document name one fact with one set of words. A second hand-written copy of these strings is how a
 * screen ends up telling a reader to record "probation term" while the document refuses "probation
 * period".
 */
const LABELS = Object.freeze({
  term: REQUIRED_FACTS.probation_period,
  reference: REQUIRED_FACTS.probation_extension_reference,
  date: REQUIRED_FACTS.probation_extension_date,
});

/** Is this value a fact the record actually holds? A blank is not. */
function held(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

/**
 * The stored term, as a number of days — or `null` when nobody has chosen.
 *
 * A value outside `TERMS` is `null` too. The database CHECK constraint refuses one, so this branch is
 * only reachable on a hand-edited database; treating it as "no choice" withholds the contract rather
 * than printing a term no option offered.
 */
function daysOf(row) {
  if (!row) return null;
  const raw = row.probation_days;
  if (!held(raw)) return null;
  const days = Number(raw);
  return TERMS.indexOf(days) === -1 ? null : days;
}

/** The unit the employer's own law counts the term in. */
function unitFor(jurisdiction) {
  if (jurisdiction === 'UAE') return 'months';
  if (jurisdiction === 'KSA') return 'days';
  return null;
}

/**
 * How one stored term reads in one jurisdiction — the number in that jurisdiction's unit, and the
 * phrase a reader sees. `null` when the term is unset or the jurisdiction is not one we hold a unit
 * for: the caller must withhold rather than print.
 *
 * @returns {{days: number, value: string, unit: string, text: string}|null}
 */
function render(days, jurisdiction) {
  if (days === null) return null;
  const unit = unitFor(jurisdiction);
  if (!unit) return null;
  const value = unit === 'months' ? String(days / 30) : String(days);
  return { days, value, unit, text: `${value} ${unit}` };
}

/** The resolved term for a row — what the screen shows as chosen. */
function reading(row) {
  if (!row) return null;
  return render(daysOf(row), row.jurisdiction);
}

/** The two options, labelled in the employer's own jurisdiction. The screen renders these verbatim. */
function optionsFor(jurisdiction) {
  return TERMS.map((days) => {
    const rendered = render(days, jurisdiction);
    return { days, label: rendered ? rendered.text : `${days} days` };
  });
}

/** The evidence a KSA 180-day term needs, and the only state in which it is accepted. */
function extensionRequired(row) {
  return Boolean(row) && row.jurisdiction === 'KSA' && daysOf(row) === 180;
}

function extensionHeld(row) {
  return held(row && row.probation_extension_reference) && held(row && row.probation_extension_date);
}

/**
 * The template facts this row supplies — `{}` when it supplies none.
 *
 * `probation_period` is the value the template's own unit names (the UAE template says
 * `[probation_period] months`, the KSA one says `[probation_period] days`), so the term prints in the
 * unit of the document that carries it. A KSA 180-day term whose extension evidence is missing still
 * supplies the term: the term IS held, and what is missing is the evidence — named separately by
 * `missingFrom`, never by pretending the client chose nothing.
 */
function factsFrom(row) {
  const rendered = reading(row);
  return rendered ? { probation_period: rendered.value } : {};
}

/**
 * The facts that withhold a document, by the labels the screen and the refusal share.
 *
 * `[]` means the term is held and lawful to print. A term nobody chose names the term; a KSA 180-day
 * term without its written extension names the missing evidence, one field at a time, so the refusal
 * is never an empty list standing in for "something is wrong".
 */
function missingFrom(row) {
  const days = daysOf(row);
  if (days === null) return [LABELS.term];
  if (!render(days, row.jurisdiction)) return [LABELS.term];
  if (!extensionRequired(row)) return [];
  const missing = [];
  if (!held(row.probation_extension_reference)) missing.push(LABELS.reference);
  if (!held(row.probation_extension_date)) missing.push(LABELS.date);
  return missing;
}

/** `YYYY-MM-DD`, and a real calendar day — 2026-02-30 is refused rather than stored. */
function dateProblem(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'must be a date written YYYY-MM-DD';
  const stamp = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(stamp.getTime()) || stamp.toISOString().slice(0, 10) !== value) return 'is not a calendar date';
  return null;
}

/**
 * THE SAVE-TIME RULE. Given the record AS IT WILL BE STORED (the existing row with the write applied),
 * return the reason it cannot be stored, or `null`.
 *
 * The server refuses here rather than leaving it to the screen: a 422 the client alone can produce is
 * not a rule, it is a suggestion — and the same row can be written by any caller.
 *
 * @returns {{field: string, error: string}|null}
 */
function saveProblem(row) {
  const days = daysOf(row);
  const jurisdiction = row ? row.jurisdiction : null;
  const reference = held(row && row.probation_extension_reference);
  const date = held(row && row.probation_extension_date);

  if (days !== null && !unitFor(jurisdiction)) {
    return {
      field: 'jurisdiction',
      error: 'a probation term needs the employer\'s jurisdiction: the term is stored in days and printed in the unit that jurisdiction\'s law counts in',
    };
  }
  if ((reference || date) && !(jurisdiction === 'KSA' && days === 180)) {
    return {
      field: 'probation_extension_reference',
      error: 'extension evidence is accepted only for a 180-day KSA term: the UAE has no extension mechanism, and a 90-day term has nothing to extend',
    };
  }
  if (jurisdiction === 'KSA' && days === 180) {
    if (!reference) {
      return {
        field: 'probation_extension_reference',
        error: 'a 180-day probation term in KSA holds only with a written extension agreement between the parties: record the agreement\'s reference',
      };
    }
    if (!date) {
      return {
        field: 'probation_extension_date',
        error: 'a 180-day probation term in KSA holds only with a written extension agreement between the parties: record the date it was agreed',
      };
    }
  }
  return null;
}

module.exports = {
  TERMS,
  COLUMNS,
  LABELS,
  daysOf,
  unitFor,
  render,
  reading,
  optionsFor,
  extensionRequired,
  extensionHeld,
  factsFrom,
  missingFrom,
  dateProblem,
  saveProblem,
};
