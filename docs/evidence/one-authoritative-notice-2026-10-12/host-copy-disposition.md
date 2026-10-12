# The host copy: retire it, do not point at it

**Amended 2026-10-12** (was `shared-pointer-privacy-notice.md`). The earlier plan — install a one-line
pointer at `/home/team/shared/templates/privacy-notice.md` at the cutover — is **withdrawn, and must not
be executed.** This file records the decision that replaced it.

## Why a pointer there is wrong, not merely optional

Anything at that path is a candidate to be served as the notice. A resolution that looks at the host
directory first is the *old* code (still the live tree until a cutover, and what a rollback restores), so
replacement text placed there would be served **as the privacy notice**: a pointer statement where a
real-but-stale document used to be. Serving the wrong *document* was the defect; serving a sentence
saying "this is not the notice any more" is worse, because it is not a document at all.

The flip the pointer was meant to compensate for is already in the code, so nothing needs installing:
`server/privacy-notice.js` resolves every template inside this repository and names the host directory
only in its history note; `server/privacy-notice.test.js` fails if any module under `server/` reads it
again. There is no second resolution left to redirect.

## What to do instead

**Retire the host copy by removing it or moving it aside — never by leaving text at the same path.**
After a cutover has shipped the merged change, move it out of the namespace any reader resolves:

```bash
DEPLOY=/home/team/shared/probable-octo-sniffle
SHA=$(git -C "$DEPLOY" rev-parse --short HEAD)
mkdir -p /home/team/shared/templates/retired
mv /home/team/shared/templates/privacy-notice.md \
   "/home/team/shared/templates/retired/privacy-notice.md.retired-$SHA"

# the proof, by the bytes the route returns — never by reading the code
curl -s -H "Authorization: Bearer $TOKEN" localhost:3000/api/compliance/notice > /tmp/served.json
python3 -c "import json;d=json.load(open('/tmp/served.json'));print(d['path']);open('/tmp/served.md','w').write(d['content'])"
md5sum /tmp/served.md "$DEPLOY/templates/privacy-notice.md"   # must match
grep -c 'statutory retention' /tmp/served.md                  # must be 0
grep -c 'retention period'    /tmp/served.md                  # must be >= 1
```

The `path` the route reports must sit inside `$DEPLOY/templates/`; the served bytes must equal that
file; and the retired copy's md5 `e011d3d6f18eb8175050917bb4fb08fe` must not be what comes back.

## Ordering, and the failure that ordering prevents

The retirement happens **at the cutover's own commit or after it** — never before, because the old code
still serves that path today and removing it early changes what a client receives without a reviewed
movement. If the read-back above returns the retired copy's md5, this change did not ship and the file
goes back from git:

```bash
git -C "$DEPLOY" show HEAD:templates/privacy-notice.md > /home/team/shared/templates/privacy-notice.md
```

Removing it is safe under either code version: the old code falls back to its own repository copy
(`b54412d`'s `templates/privacy-notice.md`, md5 `9c060b9fd07129cdb466471bbed7945b`, the corrected text),
and the merged code never consults the host directory at all.

## And the pointer must never restate the version

Even as a record, a file that repeats a version string drifts the instant the notice moves — the reason
this note names a path, an md5 and a commit, and quotes no version of its own.
