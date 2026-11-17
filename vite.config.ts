import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { cloudflare } from '@cloudflare/vite-plugin'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { gatherMcpViews } from './src/lib/mcp/views/vitePlugin.ts'

// apps/mobile/app.json `expo.version` is the one SemVer for web and phone
// (the release standard): web reports it on /version and in its Sentry release.
function appVersion() {
  const appJson = JSON.parse(
    readFileSync(fileURLToPath(new URL('./apps/mobile/app.json', import.meta.url)), 'utf8'),
  ) as { expo: { version: string } }
  return appJson.expo.version
}

function gitCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return undefined
  }
}

// The release ties an uploaded source map to the events its bundle emits, so it
// must be the same string at build (upload) and at runtime (VITE_SENTRY_RELEASE).
// `gather@<version>+<short sha>`, as the release standard names it.
function resolveRelease(
  env: Record<string, string | undefined>,
  version: string,
  commit: string | undefined,
) {
  if (env.SENTRY_RELEASE) return env.SENTRY_RELEASE
  if (!commit) return undefined
  return `gather@${version}+${commit.slice(0, 7)}`
}

// Vite reads .env files only after this file is evaluated, so the values
// `env.manifest.ts` routes to `.env.local` (local builds) would be invisible to
// `process.env`. Read just the four Sentry names from the files, let the real
// process environment (CI) win, and never copy unrelated secrets across.
const SENTRY_BUILD_KEYS = [
  'SENTRY_AUTH_TOKEN',
  'SENTRY_RELEASE',
  'VITE_SENTRY_ORG',
  'VITE_SENTRY_PROJECT',
] as const

function sentryBuildEnv(mode: string) {
  const files = loadEnv(mode, process.cwd(), '')
  const env: Record<string, string | undefined> = {}
  for (const key of SENTRY_BUILD_KEYS) env[key] = process.env[key] || files[key]
  return env
}

const config = defineConfig(({ mode }) => {
  const env = sentryBuildEnv(mode)
  const version = appVersion()
  const commit = gitCommit()
  const release = resolveRelease(env, version, commit)
  // Upload only when the token is present: local builds and PR previews without
  // it build exactly as before. The token is read here, never inlined (no VITE_).
  const uploadSourceMaps = Boolean(env.SENTRY_AUTH_TOKEN)
  return {
    resolve: { tsconfigPaths: true },
    define: {
      'import.meta.env.VITE_SENTRY_RELEASE': JSON.stringify(release),
      // Read by /version (src/lib/release/version.ts).
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(version),
      'import.meta.env.VITE_GIT_COMMIT': JSON.stringify(commit ?? null),
      'import.meta.env.VITE_BUILT_AT': JSON.stringify(new Date().toISOString()),
    },
    // `hidden` emits the maps without a sourceMappingURL comment; the plugin
    // uploads them and deletes them from dist, so none reach the public client.
    build: { sourcemap: uploadSourceMaps ? 'hidden' : false },
    plugins: [
      // The MCP views, bundled into one document the Worker serves (docs/runbooks/mcp.md).
      gatherMcpViews(),
      devtools(),
      cloudflare({ viteEnvironment: { name: 'ssr' } }),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
      uploadSourceMaps &&
        sentryVitePlugin({
          org: env.VITE_SENTRY_ORG,
          project: env.VITE_SENTRY_PROJECT,
          authToken: env.SENTRY_AUTH_TOKEN,
          release: { name: release },
          sourcemaps: {
            filesToDeleteAfterUpload: ['dist/**/*.map'],
          },
          telemetry: false,
        }),
    ],
  }
})

export default config
