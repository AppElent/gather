import { configDefaults, defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [viteReact()],
  test: {
    projects: [
      {
        test: {
          name: 'web',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./vitest.setup.ts'],
          include: ['src/**/*.test.{ts,tsx}', 'shared/**/*.test.ts'],
          exclude: [
            ...configDefaults.exclude,
            'convex/**/*.test.ts',
            '**/.claude/**',
            '**/node_modules_OLD/**',
            '**/node_modules.*/**',
          ],
        },
      },
      {
        test: {
          name: 'convex',
          environment: 'edge-runtime',
          include: ['convex/**/*.test.ts'],
          setupFiles: [],
        },
      },
    ],
  },
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname, '#': new URL('./src', import.meta.url).pathname },
  },
})
