// Decides, per platform, whether CI may publish an over-the-air update to a
// channel (the release standard, ADR 0044). Run from the repo root by
// mobile-update.yml and mobile-update-production.yml:
//
//   node apps/mobile/scripts/ota-gate.mjs <preview|production> [--force]
//
// Writes `platforms=<space-separated list>` to $GITHUB_OUTPUT (empty: publish
// nothing) and one line per platform to $GITHUB_STEP_SUMMARY. Two gates:
//
// 1. Something the app bundles changed since the channel's tag (`ota-<channel>`,
//    moved after each publish). A web-only merge publishes nothing.
// 2. Something on the channel already runs this runtime fingerprint: an earlier
//    update or a finished EAS build. Otherwise a native change is waiting and
//    the platform needs a new build first; an update would never load.
//
// `--force` skips both. It exists to seed a channel after a local build, which
// EAS does not record; on production it waits for the owner's decision card.
// Needs EXPO_TOKEN; reads EAS through the CLI pinned in apps/mobile.
import { spawnSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const PLATFORMS = ['ios', 'android']
// What ends up in the update bundle. `packages/` is @gather/core, bundled into
// the app; the lockfile and patches change what node_modules bundles.
const BUNDLED_PATHS = ['apps/mobile', 'packages', 'patches', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']

const [channel, ...flags] = process.argv.slice(2)
if (!['preview', 'production'].includes(channel)) {
  console.error('Usage: ota-gate.mjs <preview|production> [--force]')
  process.exit(1)
}
const force = flags.includes('--force')
const tag = `ota-${channel}`
const nextBuild = channel === 'production' ? 'a store build is due' : 'rebuild `preview-internal`'

const summary = (line) => {
  console.log(line)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`)
}
const output = (line) => {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${line}\n`)
}

function run(command, args, cwd = appRoot) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return { ok: result.status === 0, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

function changedSinceTag() {
  const root = join(appRoot, '..', '..')
  if (!run('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`], root).ok) return true
  // `git diff --quiet` exits 1 when something differs.
  return !run('git', ['diff', '--quiet', tag, 'HEAD', '--', ...BUNDLED_PATHS], root).ok
}

function count(args) {
  const result = run('pnpm', ['exec', 'eas', ...args, '--json', '--non-interactive'])
  if (!result.ok) throw new Error(`eas ${args[0]} failed: ${result.stderr.trim().split('\n').at(-1)}`)
  return JSON.parse(result.stdout)
}

function channelRuns(platform, runtime) {
  const updates = count(['update:list', '--branch', channel, '--runtime-version', runtime, '--limit', '50'])
  const hasUpdate = (updates.currentPage ?? []).some((group) => String(group.platforms).includes(platform))
  if (hasUpdate) return true
  const builds = count([
    'build:list', '--platform', platform, '--channel', channel, '--runtime-version', runtime,
    '--status', 'finished', '--limit', '1',
  ])
  return builds.length > 0
}

if (!force && !changedSinceTag()) {
  summary(`Nothing the app bundles changed since \`${tag}\`; no ${channel} update published.`)
  output('platforms=')
  process.exit(0)
}

const publish = []
for (const platform of PLATFORMS) {
  const resolved = run('pnpm', ['exec', 'expo-updates', 'runtimeversion:resolve', '--platform', platform])
  if (!resolved.ok) {
    console.error(resolved.stderr)
    process.exit(1)
  }
  const runtime = JSON.parse(resolved.stdout).runtimeVersion
  const short = `\`${runtime.slice(0, 12)}\``
  if (force || channelRuns(platform, runtime)) {
    publish.push(platform)
    summary(`- ${platform} ${short}: publishing to \`${channel}\`${force ? ' (forced)' : ''}`)
  } else {
    summary(`- ${platform} ${short}: **native change, ${nextBuild}** (no update or build on \`${channel}\` has this fingerprint)`)
  }
}
output(`platforms=${publish.join(' ')}`)
