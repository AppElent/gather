// Publishes an over-the-air update and uploads its source maps.
//
//   pnpm update:preview --message "…"
//   pnpm update:prod    --message "…"
//   pnpm update:prod --upload-only      (retry the upload for the last export)
//
// `eas update` always carries `--environment`: EXPO_PUBLIC_* values are inlined
// at publish time, and a bare publish would bake in this machine's .env.local.
// Maps are keyed by the debug ID Metro stamps on the bundle, so they must come
// from the exact `dist/` that was just published — never rebuild in between.
//
// Production refuses to publish without SENTRY_AUTH_TOKEN: a crash in a bundle
// nobody can symbolicate is the one that costs a day. Preview publishes
// without it (and says so), because preview is where the pipeline is tried and
// an engineer without the token should still be able to try it.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const channels = ['preview', 'production']

const [channel, ...rest] = process.argv.slice(2)
if (!channels.includes(channel)) {
  console.error(`Usage: publish-update.mjs <${channels.join('|')}> [--upload-only] [eas update args]`)
  process.exit(1)
}
const uploadOnly = rest.includes('--upload-only')
const easArgs = rest.filter((arg) => arg !== '--upload-only')

// The web build keeps these in the repo-root .env.local (VITE_SENTRY_* names).
// Read just the names this script needs; a real environment variable wins.
function readDotenv(path) {
  if (!existsSync(path)) return {}
  const values = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (match) values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
  }
  return values
}
const file = readDotenv(join(appRoot, '..', '..', '.env.local'))
const pick = (...names) => {
  for (const name of names) {
    const value = process.env[name] || file[name]
    if (value) return value
  }
  return undefined
}

const token = pick('SENTRY_AUTH_TOKEN')
const org = pick('SENTRY_ORG', 'VITE_SENTRY_ORG')
const project = pick('SENTRY_PROJECT', 'VITE_SENTRY_PROJECT')
const upload = Boolean(token && org && project)

if (!upload) {
  const missing = [
    !token && 'SENTRY_AUTH_TOKEN',
    !org && 'SENTRY_ORG (or VITE_SENTRY_ORG)',
    !project && 'SENTRY_PROJECT (or VITE_SENTRY_PROJECT)',
  ].filter(Boolean)
  const message = `Cannot upload source maps: ${missing.join(', ')} not set.`
  if (channel === 'production' || uploadOnly) {
    console.error(`${message} Refusing to continue.`)
    process.exit(1)
  }
  console.warn(`${message} Publishing to ${channel} without them; its stacks will not be symbolicated.`)
}

const env = {
  ...process.env,
  ...(upload && { SENTRY_AUTH_TOKEN: token, SENTRY_ORG: org, SENTRY_PROJECT: project }),
}

function run(command, args) {
  const result = spawnSync('pnpm', ['exec', command, ...args], { cwd: appRoot, env, stdio: 'inherit' })
  if (result.error) console.error(result.error.message)
  if (result.status !== 0) {
    if (command !== 'eas') {
      console.error('The update is published but its maps are not. Re-run with --upload-only, without publishing again.')
    }
    process.exit(result.status || 1)
  }
}

if (!uploadOnly) run('eas', ['update', '--channel', channel, '--environment', channel, ...easArgs])
if (upload) run('sentry-expo-upload-sourcemaps', ['dist'])
