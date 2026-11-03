import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

/**
 * BUILD PROVENANCE — what this build was, written into the thing it built.
 *
 * WHY. `client/dist` is gitignored and untracked, so a checkout does not touch it and
 * `git status` stays clean while it holds bytes nobody merged. On 2026-11-02 this tree's
 * `client/dist` was built at 22:55:44 from an UNMERGED branch (#353) and the live product
 * served that bundle for ~50 minutes; the recorded pair for the deployed revision was not
 * on disk at all, and its URL answered 200 with the SPA shell, so no status code could
 * have caught it. Nothing in this repository could say what a `dist/` was built from,
 * because the build recorded nothing about itself.
 *
 * WHAT. After every `npm run build` (`tsc -b && vite build`) this plugin writes
 * `client/dist/build-provenance.json`: the git revision the build ran at, whether the tree
 * was dirty, a UTC timestamp, the entry asset `index.html` names, and the byte size and
 * md5 of every file in `dist/`. `scripts/check-served-provenance.py` then reads that
 * record against the tree it sits in and against the bytes on disk, and reddens when they
 * disagree — see that file's header for what it proves and what it cannot.
 *
 * The gate command is unchanged: this runs inside `vite build`, so `cd client && npm run
 * build` is still exactly `tsc -b && vite build`.
 *
 * If git is unavailable the record is still written, with `revision: null` and the reason
 * in `revision_reason` — a build that cannot name its revision is recorded as such rather
 * than failing the build or, worse, claiming a revision it never read.
 */
const PROVENANCE_FILE = 'build-provenance.json'
const PROVENANCE_SCHEMA = 1
const DIRTY_FILES_KEPT = 40

type GitResult = { ok: true; out: string } | { ok: false; why: string }

function git(args: string[], cwd: string): GitResult {
  try {
    const out = execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10000,
    })
    return { ok: true, out: out.trim() }
  } catch (err) {
    const e = err as { message?: string; stderr?: unknown }
    const why = String(e.stderr || e.message || err).split('\n')[0].trim()
    return { ok: false, why: why || 'git failed with no message' }
  }
}

function walk(dir: string, base: string, out: string[]): void {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, base, out)
    else out.push(relative(base, full).split(sep).join('/'))
  }
}

/** Every `/assets/...` path `index.html` names, as paths relative to `dist`. */
function referencedAssets(html: string): string[] {
  const seen = new Set<string>()
  const re = /(?:src|href)="(\/assets\/[^"]+)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) seen.add(m[1].slice(1))
  return [...seen].sort()
}

/** The one asset `index.html` loads as a module — the entry the browser runs. */
function entryAsset(html: string): string | null {
  const m = /<script\b[^>]*\bsrc="(\/assets\/[^"]+)"/.exec(html)
  return m ? m[1].slice(1) : null
}

function writeProvenance(distDir: string): void {
  const names: string[] = []
  walk(distDir, distDir, names)

  const files: Record<string, { bytes: number; md5: string }> = {}
  for (const name of names) {
    if (name === PROVENANCE_FILE) continue
    const buf = readFileSync(join(distDir, name))
    files[name] = { bytes: buf.length, md5: createHash('md5').update(buf).digest('hex') }
  }

  const html = readFileSync(join(distDir, 'index.html'), 'utf8')
  const head = git(['rev-parse', 'HEAD'], distDir)
  const top = git(['rev-parse', '--show-toplevel'], distDir)
  const dirty = git(['status', '--porcelain', '--untracked-files=no'], distDir)

  const record = {
    schema: PROVENANCE_SCHEMA,
    written_by: 'client/vite.config.ts (vite closeBundle hook)',
    built_at_utc: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    revision: head.ok ? head.out : null,
    revision_reason: head.ok ? null : head.why,
    git_top_level: top.ok ? top.out : null,
    dirty: dirty.ok ? dirty.out.length > 0 : null,
    dirty_reason: dirty.ok ? null : dirty.why,
    dirty_files: dirty.ok ? dirty.out.split('\n').filter(Boolean).slice(0, DIRTY_FILES_KEPT) : [],
    entry: entryAsset(html),
    referenced: referencedAssets(html),
    files,
  }

  writeFileSync(join(distDir, PROVENANCE_FILE), JSON.stringify(record, null, 2) + '\n')

  // One line in the build's own log, so a movement's transcript carries the record too.
  console.log(
    `[build-provenance] revision=${record.revision ?? 'NULL(' + record.revision_reason + ')'}` +
      ` dirty=${record.dirty === null ? 'NULL(' + record.dirty_reason + ')' : record.dirty}` +
      ` entry=${record.entry ?? 'NONE'}` +
      ` files=${Object.keys(files).length}` +
      ` -> ${join(distDir, PROVENANCE_FILE)}`,
  )
}

function buildProvenance(): Plugin {
  let root = process.cwd()
  let outDir = 'dist'
  return {
    name: 'antum-build-provenance',
    apply: 'build',
    configResolved(config) {
      root = config.root
      outDir = config.build.outDir
    },
    // closeBundle runs after every file is on disk, including index.html, so the record
    // hashes exactly what the product will serve.
    closeBundle() {
      writeProvenance(resolve(root, outDir))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), buildProvenance()],
})
