import { configDefaults, defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'

const alias = {
  '@': new URL('./src', import.meta.url).pathname,
  '#': new URL('./src', import.meta.url).pathname,
}

const exclude = [
  ...configDefaults.exclude,
  '**/.claude/**',
  '**/node_modules_OLD/**',
  '**/node_modules.*/**',
]

// Two suites, two runtimes. The web suite needs a DOM; the Convex suite runs
// real queries and mutations through `convex-test`, which needs the edge
// runtime Convex functions actually execute in. They cannot share one
// environment, so they are separate projects rather than one include glob.
export default defineConfig({
  test: {
    projects: [
      {
        plugins: [viteReact()],
        resolve: { alias },
        test: {
          name: 'web',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./vitest.setup.ts'],
          include: ['src/**/*.test.{ts,tsx}'],
          exclude,
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'convex',
          environment: 'edge-runtime',
          globals: true,
          include: ['convex/**/*.test.ts'],
          exclude,
          server: { deps: { inline: ['convex-test'] } },
        },
      },
    ],
  },
})
