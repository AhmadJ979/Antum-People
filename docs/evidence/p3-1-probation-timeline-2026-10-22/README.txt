P3-1 evidence pack
rig-run.txt — the scratch rig, before=93de0bd after=1ef9e9c (origin/main then)
the digests of these delivered bytes are in manifest.txt (md5sum -c)

CORRECTION (see ERRATUM.txt): the rig's merge-result tree quoted in rig-run.txt is 1ef9e9c's tree
(at the time the rig ran); the FINAL merge result at f4314d8 is 5951de62393f782f12986b7dd68a38a49f9c7a05.
tsc-b.log is empty by construction (tsc -b is silent on success) and cannot redden; the build
proof's load-bearing half is vite-build.log plus the exit codes.
