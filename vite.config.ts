import { execFileSync } from 'node:child_process'
import { cloudflare } from '@cloudflare/vite-plugin'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The release ties an uploaded source map to the events its bundle emits, so it
// must be the same string at build (upload) and at runtime (VITE_SENTRY_RELEASE).
function resolveRelease(): string | undefined {
  if (process.env.SENTRY_RELEASE) return process.env.SENTRY_RELEASE
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return undefined
  }
}

const release = resolveRelease()
// Upload only when the token is present: local builds and PR previews without
// it build exactly as before. The token is read here, never inlined (no VITE_).
const uploadSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN)

const config = defineConfig({
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
        org: process.env.VITE_SENTRY_ORG,
        project: process.env.VITE_SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        release: { name: release },
        sourcemaps: {
          filesToDeleteAfterUpload: ['dist/**/*.map'],
        },
        telemetry: false,
      }),
  ],
})

export default config
