# The off-host uptime check accepts both shapes we actually ship

2026-11-10 · fix to `.github/workflows/uptime.yml`

## The defect

The public URL is behind the passcode wall (`server/public-gate.js`, #386). The off-host
check still asserted the PRE-wall page only: body contains `<title>Antum People</title>` and
names an `assets/index-<hash>.js`.

The gate page's title is `<title>Antum People — access</title>` and it names no asset by
design, so from the moment the wall went live the check failed on every run — on a site that
was answering correctly. Run history (`gh run list --workflow=uptime.yml`):

```
2026-11-08T13:35:19Z  success   <- last green, before the wall
2026-11-08T15:11:10Z  failure   <- the alert the owner saw (15:12:00Z)
2026-11-08T19:44:31Z  failure
2026-11-08T23:12:51Z  failure
2026-11-09T02:43:55Z  failure
2026-11-09T10:25:50Z  failure
2026-11-09T21:00:05Z  failure
2026-11-10T03:28:09Z  failure
```

A title-only patch would have moved the alarm to assertion C (the gate page names no asset).
So the assertion became a PAGE-IDENTITY assertion over two shapes.

## What the check now accepts — and what still reddens

Both halves of a shape must agree:

| shape | title | asset reference |
| --- | --- | --- |
| gate page (what a stranger sees) | exactly `<title>Antum People — access</title>` | none |
| product shell (behind a cookie, or if the wall is taken down) | `<title>Antum People</title>` | `assets/index-<hash>.js` |

Anything else reddens, and the alert names the title and the asset it actually observed.
A gate title carrying an asset — a shape we do not ship — reddens too.

## The proof (01-local-fixture-proof.txt)

The decision block is EXTRACTED FROM THE WORKFLOW FILE and driven against four bodies, so the
proof cannot drift from the thing it judges:

- the live gate page (fetched) → PASS, shape "gate page"
- the deployed product shell (`client/dist/index.html`) → PASS, shape "product shell (… index-NX5GUwrh.js)"
- `https://example.com/` → FAIL, `B: page identity`
- the gate page with an asset reference injected → FAIL, `B: page identity`

Four cases, four matches.

## The workflow's own runs (02, 03, 04)

| run | URL probed | conclusion | what it proves |
| --- | --- | --- | --- |
| `42774559203` | the live public URL | **success** | the wall no longer cries wolf: `page shape: gate page`, `RESULT: PASS after 1 attempt`, and it closed alert issue #390 |
| `42774625590` | `https://example.com/` (canary) | **failure** | a wrong page still reddens: `FAILED on: B: page identity (… observed title <title>Example Domain</title> and asset none)`, three attempts, and it opened alert issue #395 |
| `42774767178` | the production URL restored | **success** | the canary was reverted, not left in: `page shape: gate page`, and it commented on and CLOSED #395 |

The canary commits (`CANARY (temporary)` and `CANARY (restore)`) are in this branch's history and
the last one puts `UPTIME_URL_DEFAULT` back where it was — the file's own canary recipe, run as written.
