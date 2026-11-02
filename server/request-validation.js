'use strict';

/**
 * CALLER-ERROR VALIDATION — the one place a route asks "is this request mine to refuse?".
 *
 * WHY THIS EXISTS (measured 2026-11-02): `POST /api/login` with `{}` answered **HTTP 500**. The body
 * was well-formed JSON that simply did not carry the two fields the route needed; the route handed
 * `undefined` to `bcrypt.compare`, the throw landed in its own `catch`, and the caller was told
 * "Internal Server Error" — the same answer a broken database gets. Three other routes did the same
 * thing for a wrong-typed field: `auth.encrypt([])` and `eosb.recordedReason(12345)` both throw, and
 * both were reachable from a request that was merely malformed.
 *
 * THE RULE, in one line: **400 = the caller's fault. 500 = ours.** Nothing here catches an error and
 * relabels it — that would turn a bug into a weather report, which is worse than the 500 it hides.
 * These functions only ever look at the request and say what is wrong with it, BEFORE the handler
 * reaches code whose job is real work. A throw from inside the work stays a 500, and it should.
 *
 * A refusal must NAME THE FIELD. "Bad request" tells a caller nothing they can act on; "password must
 * be a string" tells them exactly what to fix, and it is the same sentence the client's form needs.
 *
 * THE SHAPES:
 *   `bodyProblem(body, { required, strings, numbers })` → a sentence, or `null` when the body is
 *   usable. Fields listed as `strings`/`numbers` are checked **only when present**: a route that
 *   never required a field does not start requiring it here, because a request that used to work
 *   must keep working. `required` is where a route states, deliberately, that the field is the
 *   point of the request.
 *
 *   `isPlainObject(value)` → false for `null`, for an array and for a scalar. This is what keeps an
 *   array body (`[]`) from being read as "an object with no fields": every `body.field` on it is
 *   `undefined`, so a route would quietly write NULLs and answer 200 to a request it never
 *   understood.
 */

/** A JSON object — not null, not an array, not a scalar. */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** A number, or a string that is one. `''` and `'abc'` are not. */
function isNumeric(value) {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return false;
    return Number.isFinite(Number(trimmed));
  }
  return false;
}

function isBlank(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

/**
 * What is wrong with this request body, as a sentence a caller can act on — or `null`.
 *
 * @param {unknown} body
 * @param {{ required?: string[], strings?: string[], numbers?: string[] }} spec
 * @returns {string|null}
 */
function bodyProblem(body, spec = {}) {
  const { required = [], strings = [], numbers = [] } = spec;
  if (!isPlainObject(body)) return 'request body must be a JSON object';
  for (const field of required) {
    if (isBlank(body[field])) return `${field} is required`;
  }
  for (const field of strings) {
    const value = body[field];
    if (value !== undefined && value !== null && typeof value !== 'string') {
      return `${field} must be a string`;
    }
  }
  for (const field of numbers) {
    const value = body[field];
    if (value !== undefined && value !== null && !isNumeric(value)) {
      return `${field} must be a number`;
    }
  }
  return null;
}

module.exports = {
  isPlainObject,
  isNumeric,
  isBlank,
  bodyProblem,
};
