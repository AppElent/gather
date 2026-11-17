// Decides, per platform, whether CI may publish an over-the-air update to a
// channel (the release standard, ADR 0044). Run from the repo root by
// mobile-update.yml and mobile-update-production.yml:
//
//   node apps/mobile/scripts/ota-gate.mjs <preview|production> [--force]
//
// Writes `platforms=<space-separated list>` to $GITHUB_OUTPUT (empty: publish
// nothing) and one line per platform to $GITHUB_STEP_SUMMARY. Three gates:
//
// Each gate is per platform, against that platform's tag `ota-<channel>-<platform>`.
//
// 0. HEAD descends from the platform's tag, so a re-run of an old Deploy run or
//    an older soaked commit never replaces a newer update (for example an
//    owner-approved hotfix on production).
// 1. Something the app bundles changed since the platform's tag (moved after
//    each publish of that platform). A web-only merge publishes nothing.
// 2. Something on the channel already runs this runtime fingerprint: an earlier
//    update or a finished EAS build. Otherwise a native change is waiting and
//    the platform needs a new build first; an update would never load.
//
// `--force` skips all three. It exists to seed a channel after a local build, which
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

// The channel's builds are its APP_VARIANT (app.config.ts): the bundle ID enters
// the runtime fingerprint, so resolve it as the variant those builds are.
const env = { ...process.env, APP_VARIANT: channel }

function run(command, args, cwd = appRoot) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return { ok: result.status === 0, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

const repoRoot = join(appRoot, '..', '..')
// One tag per platform, moved by the workflow after that platform publishes, so
// publishing one platform never marks the other as current.
const tagFor = (platform) => `${tag}-${platform}`
const hasTag = (name) => run('git', ['rev-parse', '-q', '--verify', `refs/tags/${name}`], repoRoot).ok

function descendsFrom(name) {
  if (!hasTag(name)) return true
  return run('git', ['merge-base', '--is-ancestor', name, 'HEAD'], repoRoot).ok
}

function changedSince(name) {
  if (!hasTag(name)) return true
  // `git diff --quiet` exits 1 when something differs.
  return !run('git', ['diff', '--quiet', name, 'HEAD', '--', ...BUNDLED_PATHS], repoRoot).ok
}

function count(args) {
  const result = run('pnpm', ['exec', 'eas', ...args, '--json', '--non-interactive'])
  // A channel nobody has published to yet has no EAS branch: nothing runs on it.
  if (!result.ok && /Could not find (any branches|branch)/.test(result.stdout + result.stderr)) return { currentPage: [] }
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

const publish = []
for (const platform of PLATFORMS) {
  const resolved = run('pnpm', ['exec', 'expo-updates', 'runtimeversion:resolve', '--platform', platform])
  if (!resolved.ok) {
    console.error(resolved.stderr)
    process.exit(1)
  }
  const runtime = JSON.parse(resolved.stdout).runtimeVersion
  const short = `\`${runtime.slice(0, 12)}\``
  const platformTag = tagFor(platform)
  if (!force && !descendsFrom(platformTag)) {
    summary(`- ${platform}: HEAD is not a descendant of \`${platformTag}\`, so ${channel} already runs newer code; skipped`)
    continue
  }
  if (!force && !changedSince(platformTag)) {
    summary(`- ${platform}: nothing the app bundles changed since \`${platformTag}\`; skipped`)
    continue
  }
  if (force || channelRuns(platform, runtime)) {
    publish.push(platform)
    summary(`- ${platform} ${short}: publishing to \`${channel}\`${force ? ' (forced)' : ''}`)
  } else {
    summary(`- ${platform} ${short}: **native change, ${nextBuild}** (no update or build on \`${channel}\` has this fingerprint)`)
  }
}
output(`platforms=${publish.join(' ')}`)
