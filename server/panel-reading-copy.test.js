/**
 * The refusal sentence the client renders must name the roles the GATE actually allows — asserted
 * against `server/access.js` itself, at run time.
 *
 * WHY THIS IS A SERVER TEST. The sentence lives in `client/src/panelReading.js` (an ES module, because
 * the client bundle needs it); the thing that decides whether it is TRUE lives here, in the CommonJS
 * policy module. A sentence of the shape "read by HR" is a served claim about an ACCESS fact, and this
 * repository has a name for that family: a served string asserting an access fact the access model
 * contradicts. So the claim is not reviewed by eye — it is compared to `POLICY`, to the ROUTE that
 * reaches that cell, and to `ROLE_LIST`, on every run of the suite. If a cell gains or loses a role, or a
 * route is remapped to another resource, the sentence must move or this test reddens.
 *
 * It also asserts the sentence is not the empty-state sentence in disguise: the defect this change
 * closes was a refusal rendered as "nothing outstanding to show", and copy that drifts back towards
 * describing an absence would re-introduce the confusion without changing a line of render code.
 */
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const access = require('./access.js');

const CLIENT_MODULE = path.join(__dirname, '..', 'client', 'src', 'panelReading.js');

/** The panel -> the route the client actually calls for it. A remap of either side reddens below. */
const PANEL_ROUTES = Object.freeze({
  preboarding_cases: ['GET', '/api/preboarding/cases'],
  preboarding_overview: ['GET', '/api/preboarding/checklist/overview'],
  probation: ['GET', '/api/probation/timelines'],
  // The four panels #392 named as unfixed and this change closes: the dashboard, the roster, and the
  // two task panels of the employee detail. Each is policed by its own cell, and the two task panels
  // are the only place in the product where `finance` is refused a read it can reach a screen for.
  analytics: ['GET', '/api/analytics/dashboard'],
  employees: ['GET', '/api/employees'],
  onboarding: ['GET', '/api/employees/:id/onboarding'],
  offboarding: ['GET', '/api/employees/:id/offboarding'],
  // The employer record (owner ruling 2026-11-10, option (b)): one row per legal entity, read through
  // the roster's own cell rather than a resource of its own — so the refusal sentence names the roles
  // `employees:read` allows, and this line is what makes a remap of the route redden the copy.
  employer_record: ['GET', '/api/employers'],
});

const load = () => import(pathToFileURL(CLIENT_MODULE).href);

test('every declared panel maps to the policy cell its ROUTE is mapped to', async () => {
  const mod = await load();
  const names = Object.keys(mod.REFUSED_PANELS);
  assert.ok(names.length > 0, 'no panel declares refusal copy — the sentence would be rendered by nothing');
  assert.deepStrictEqual(names.sort(), Object.keys(PANEL_ROUTES).sort(),
    'the panels with refusal copy and the routes this test knows about have drifted apart');

  for (const name of names) {
    const [method, route] = PANEL_ROUTES[name];
    const declared = mod.REFUSED_PANELS[name].resource;
    assert.strictEqual(access.resourceFor(method, route), declared,
      `${name}: the route ${method} ${route} is policed by a different cell than the copy declares`);
  }
});

test('the roles the sentence names ARE the roles the cell allows — set equality, both directions', async () => {
  const mod = await load();
  for (const name of Object.keys(mod.REFUSED_PANELS)) {
    const panel = mod.REFUSED_PANELS[name];
    const cell = access.POLICY[panel.resource];
    assert.ok(Array.isArray(cell) && cell.length > 0,
      `${name}: ${panel.resource} is not a non-empty POLICY cell — an unnamed resource refuses everyone`);
    assert.deepStrictEqual(
      [...panel.roles].sort(),
      [...cell].sort(),
      `${name}: the sentence names ${panel.roles.join(', ')} but ${panel.resource} allows ${cell.join(', ')}`
    );
    for (const role of panel.roles) {
      assert.ok(access.ROLE_LIST.includes(role),
        `${name}: ${role} is not a role the product knows (access.js ROLE_LIST)`);
    }
  }
});

test('the sentence names every allowed role in words, and says nothing changed', async () => {
  const mod = await load();
  for (const name of Object.keys(mod.REFUSED_PANELS)) {
    const panel = mod.REFUSED_PANELS[name];
    const sentence = mod.refusalSentenceFor(name);
    for (const role of access.POLICY[panel.resource]) {
      // The word the SENTENCE uses: a panel may override the generic one where it reads badly inside a
      // list, so the assertion follows the composer rather than a table the composer no longer reads.
      assert.ok(sentence.includes(mod.roleWordsFor(name, role)),
        `${name}: "${sentence}" does not name the allowed role ${role}`);
    }
    assert.match(sentence, /Nothing was changed, and you are still signed in\./,
      `${name}: a refusal must say nothing changed and the session is intact`);
  }
});

test('the sentence never states an ABSENCE — the defect this change closes, in words', async () => {
  const mod = await load();
  for (const name of Object.keys(mod.REFUSED_PANELS)) {
    const sentence = mod.refusalSentenceFor(name);
    assert.doesNotMatch(sentence, /nothing outstanding|No open |there are none|no cases|0 cases/i,
      `${name}: a refusal must not read as an empty result: "${sentence}"`);
  }
});

test('control: a policy cell with one more role than the copy names is caught', async () => {
  const mod = await load();
  const name = 'preboarding_cases';
  const panel = mod.REFUSED_PANELS[name];
  const widened = [...access.POLICY[panel.resource], 'finance'];
  // The comparison above, replayed against a WIDENED cell: this is the shape a policy change takes, and
  // it must not pass. If the assertion in test 2 were vacuous, this control would pass too.
  assert.throws(() => assert.deepStrictEqual([...panel.roles].sort(), [...widened].sort()),
    /Expected values to be strictly deep-equal/);
});
