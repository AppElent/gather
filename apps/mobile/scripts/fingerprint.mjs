// Runtime fingerprints: the value a build and an over-the-air update must share
// before the build loads the update (ADR 0029). Computed locally, they match
// what EAS records on a build. Copied from the toolkit template
// docs/standards/mobile-baseline/templates/fingerprint.mjs, with one change:
// Gather has no APP_VARIANT (app.json, not app.config.ts), so every EAS profile
// shares one fingerprint per platform and there are no variants to loop over.
//
//   node apps/mobile/scripts/fingerprint.mjs              # this checkout
//   node apps/mobile/scripts/fingerprint.mjs diff <base>  # Markdown: what changed vs
//                                                         # another checkout (CI)
//
// `diff` needs `<base>` installed (`pnpm install`), because native modules are
// fingerprinted from node_modules. The mobile-runtime workflow runs it.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
export const PLATFORMS = ['ios', 'android']
const RUNBOOK = 'docs/runbooks/mobile-releases.md#over-the-air-or-a-new-build'

/** `{ hash, sources }` for one platform of the app at `root`. */
export function fingerprint(platform, root = appRoot) {
  const result = spawnSync('pnpm', ['exec', 'expo-updates', 'fingerprint:generate', '--platform', platform], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  if (result.status !== 0) {
    throw new Error(`fingerprint:generate failed in ${root} (${platform}):\n${result.stderr}`)
  }
  return JSON.parse(result.stdout)
}

/** Readable id: pnpm's store path shortened to `node_modules/<package>/…`. */
function sourceKey(source) {
  return source.type === 'contents' ? source.id : source.filePath.replace(/^.*node_modules\//, 'node_modules/')
}

/**
 * Source keys whose hash differs, or that exist on one side only. Sources
 * without a hash (an ignored local `ios/` folder) don't count.
 */
function changedSources(before, after) {
  const hashed = (print) => print.sources.filter((s) => s.hash !== null)
  const hashes = new Map(hashed(before).map((s) => [sourceKey(s), s.hash]))
  const changed = new Set()
  for (const source of hashed(after)) {
    const key = sourceKey(source)
    if (hashes.get(key) !== source.hash) changed.add(key)
    hashes.delete(key)
  }
  for (const key of hashes.keys()) changed.add(key)
  return changed
}

function diff(baseRepo) {
  const repoRoot = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: appRoot,
    encoding: 'utf8',
  }).stdout.trim()
  const baseApp = join(resolve(baseRepo), relative(repoRoot, appRoot))
  if (!existsSync(join(baseApp, 'package.json'))) {
    return '### Mobile runtime\n\nThe base branch has no mobile app yet; every build is new.'
  }
  const rows = []
  const sources = new Set()
  let native = false
  for (const platform of PLATFORMS) {
    const before = fingerprint(platform, baseApp)
    const after = fingerprint(platform)
    const changed = before.hash !== after.hash
    if (changed) {
      native = true
      for (const key of changedSources(before, after)) sources.add(key)
    }
    const label = platform === 'ios' ? 'iOS' : 'Android'
    rows.push(`| ${label} | ${changed ? '**yes**' : 'no'} | \`${before.hash.slice(0, 12)}\` | \`${after.hash.slice(0, 12)}\` |`)
  }
  const lines = [
    '### Mobile runtime',
    '',
    native
      ? 'This PR changes the native fingerprint. Installed builds will not load its JavaScript as an update: after merging, make a new `preview-internal` build (and a production build when releasing) before the next over-the-air update.'
      : 'No native changes. Installed builds can take this PR as an over-the-air update (`pnpm mobile:update:preview`).',
    '',
    '| Platform | Native fingerprint changed | Base | This PR |',
    '| --- | --- | --- | --- |',
    ...rows,
  ]
  if (sources.size > 0) {
    lines.push(
      '',
      '<details><summary>Changed fingerprint sources</summary>',
      '',
      ...[...sources].sort().map((key) => `- \`${key}\``),
      '',
      '</details>',
    )
  }
  // Absolute in CI, so the link works in both the PR comment and the run summary.
  const { GITHUB_SERVER_URL: server, GITHUB_REPOSITORY: repo } = process.env
  const runbook = server && repo ? `${server}/${repo}/blob/main/${RUNBOOK}` : RUNBOOK
  lines.push('', `See [Mobile releases](${runbook}). Informational only; this check never fails a PR.`)
  return lines.join('\n')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, base] = process.argv.slice(2)
  if (command === 'diff' && base) {
    console.log(diff(base))
  } else if (!command) {
    for (const platform of PLATFORMS) console.log(`${platform.padEnd(8)} ${fingerprint(platform).hash}`)
  } else {
    console.error('Usage: fingerprint.mjs [diff <base checkout>]')
    process.exit(1)
  }
}
