/**
 * A refusal never renders as an empty result — the assertion behind `panelReading.js`.
 *
 * THE PAIR IS THE TEST. "The refusal is shown" is not the claim: the claim is that the EMPTY state is
 * unreachable once the read came back refused, because on the deployed tree `f4729f3` the refusal was
 * shown (in the console) while the screen said "nothing outstanding to show for this jurisdiction" over
 * three open cases. So every case below asserts both halves — what the area shows, and that it is not
 * the empty state — and the CONTROL at the bottom replays the pre-fix shape (a reading the render never
 * consulted) to show these assertions are capable of failing.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert';

import {
  PENDING, EMPTY, REFUSAL_AREA, FAILED_AREA,
  emptyArea, mayRenderEmpty, panelReadings, emptyAreaSentence,
  refusalSentenceFor, failedSentenceFor, REFUSED_PANELS, ROLE_WORDS, roleWordsFor,
} from './panelReading.js';
import { GRANTED, REFUSED, FAILED } from './panelResults.js';

const PANELS = Object.keys(REFUSED_PANELS);

describe('a refusal is not an empty result', () => {
  test('a refused read can never render the empty state', () => {
    assert.strictEqual(emptyArea(REFUSED), REFUSAL_AREA);
    assert.strictEqual(mayRenderEmpty(REFUSED), false);
  });

  test('a failed read can never render the empty state either', () => {
    assert.strictEqual(emptyArea(FAILED), FAILED_AREA);
    assert.strictEqual(mayRenderEmpty(FAILED), false);
  });

  test('a granted read still renders the empty state — the fix does not hide real emptiness', () => {
    assert.strictEqual(emptyArea(GRANTED), EMPTY);
    assert.strictEqual(mayRenderEmpty(GRANTED), true);
  });

  test('an unread panel is EMPTY, not refused: no answer is not a refusal', () => {
    for (const reading of [undefined, null, PENDING, 'anything-else']) {
      assert.strictEqual(emptyArea(reading), EMPTY, `reading ${String(reading)}`);
    }
  });

  test('the three outcomes are distinct — no two readings collapse into one area', () => {
    const areas = [GRANTED, REFUSED, FAILED].map(emptyArea);
    assert.strictEqual(new Set(areas).size, 3, `got ${areas.join(', ')}`);
  });
});

describe('the sentence a refused panel says', () => {
  test('every declared panel has one, and it names the roles the cell allows', () => {
    for (const name of PANELS) {
      const sentence = refusalSentenceFor(name);
      const panel = REFUSED_PANELS[name];
      for (const role of panel.roles) {
        // The word the sentence uses, which is the panel's own override where it declares one.
        assert.ok(
          sentence.includes(roleWordsFor(name, role)),
          `${name}: the sentence does not name ${role} (${ROLE_WORDS[role]}): ${sentence}`
        );
      }
      assert.doesNotMatch(sentence, /undefined|\[object/, `${name}: ${sentence}`);
    }
  });

  test('every declared role has a human word, so a new role cannot print "undefined"', () => {
    for (const name of PANELS) {
      for (const role of REFUSED_PANELS[name].roles) {
        assert.strictEqual(typeof ROLE_WORDS[role], 'string', `${name} names role ${role}`);
        assert.ok(ROLE_WORDS[role].length > 0, `${name} role ${role} has an empty word`);
      }
    }
  });

  test('it says what this account cannot read, that nothing changed, and that the session is intact', () => {
    for (const name of PANELS) {
      const sentence = refusalSentenceFor(name);
      assert.match(sentence, /^You can't read .+ from this account\./, name);
      assert.match(sentence, /Nothing was changed, and you are still signed in\./, name);
    }
  });

  test('the sentence AGREES with its subject — "the roll-up are read by" is a refusal nobody can read', () => {
    for (const name of PANELS) {
      const panel = REFUSED_PANELS[name];
      const sentence = refusalSentenceFor(name);
      const verb = panel.plural ? 'are' : 'is';
      assert.ok(
        sentence.includes(`${panel.sentence_subject} ${verb} read by`),
        `${name}: expected "${panel.sentence_subject} ${verb} read by" in ${sentence}`
      );
    }
  });

  test('it never claims the data is absent — that is the defect, in words', () => {
    for (const name of PANELS) {
      const sentence = refusalSentenceFor(name);
      assert.doesNotMatch(sentence, /nothing outstanding|No open |there are none|0 cases|is empty/i, name);
    }
  });

  test('a failed read is stated as a failure, not as a refusal and not as emptiness', () => {
    for (const name of PANELS) {
      const sentence = failedSentenceFor(name);
      assert.match(sentence, /could not be read/, name);
      assert.match(sentence, /Nothing was changed, and you are still signed in\./, name);
      assert.doesNotMatch(sentence, /You can't read/, `${name}: a failure is not a refusal`);
    }
  });

  test('emptyAreaSentence returns null exactly when the empty state may render', () => {
    for (const name of PANELS) {
      assert.strictEqual(emptyAreaSentence(name, GRANTED), null, name);
      assert.strictEqual(emptyAreaSentence(name, REFUSED), refusalSentenceFor(name), name);
      assert.strictEqual(emptyAreaSentence(name, FAILED), failedSentenceFor(name), name);
    }
  });

  test('an undeclared panel is a loud error, never a silent empty string', () => {
    assert.throws(() => refusalSentenceFor('no-such-panel'), /no refusal copy declared/);
    assert.throws(() => failedSentenceFor('no-such-panel'), /no failure copy declared/);
  });
});

describe('panelReadings() keeps what settlePanels() decided', () => {
  test('every record becomes a reading, by the name the screen knows the panel by', () => {
    const readings = panelReadings([
      { name: 'employees', status: GRANTED },
      { name: 'probation', status: REFUSED },
      { name: 'analytics', status: FAILED },
    ]);
    assert.deepStrictEqual(readings, { employees: GRANTED, probation: REFUSED, analytics: FAILED });
  });

  test('junk in the record list cannot invent a reading', () => {
    assert.deepStrictEqual(panelReadings(null), {});
    assert.deepStrictEqual(panelReadings([null, {}, { name: 7, status: REFUSED }]), {});
  });
});

/**
 * THE CONTROL. The pre-fix screen had no reading to consult: it rendered its empty state whenever the
 * list was empty, whatever the request had answered. This replays that shape on the same readings, so a
 * green suite above is a statement about a gate that exists — not about a gate nobody needed.
 */
describe('control: the pre-fix render (empty state decided by list length alone)', () => {
  const renderLikeBeforeTheFix = (reading) => {
    void reading; // the defect: the reading existed and was never consulted
    return 'empty-state';
  };

  test('the pre-fix shape renders the empty state for a REFUSED read — the defect reproduced', () => {
    assert.strictEqual(renderLikeBeforeTheFix(REFUSED), 'empty-state');
    // ... and the shipped decision disagrees with it, which is what makes the assertions above bite.
    assert.notStrictEqual(emptyArea(REFUSED), EMPTY);
  });
});
