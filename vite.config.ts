import { execFileSync } from 'node:child_process'
import { cloudflare } from '@cloudflare/vite-plugin'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// The release ties an uploaded source map to the events its bundle emits, so it
// must be the same string at build (upload) and at runtime (VITE_SENTRY_RELEASE).
function resolveRelease(env: Record<string, string | undefined>) {
  if (env.SENTRY_RELEASE) return env.SENTRY_RELEASE
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return undefined
  }
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
  const release = resolveRelease(env)
  // Upload only when the token is present: local builds and PR previews without
  // it build exactly as before. The token is read here, never inlined (no VITE_).
  const uploadSourceMaps = Boolean(env.SENTRY_AUTH_TOKEN)
  return {
    resolve: { tsconfigPaths: true },
    define: {
      'import.meta.env.VITE_SENTRY_RELEASE': JSON.stringify(release),
    },
    // `hidden` emits the maps without a sourceMappingURL comment; the plugin
    // uploads them and deletes them from dist, so none reach the public client.
    build: { sourcemap: uploadSourceMaps ? 'hidden' : false },
    plugins: [
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
