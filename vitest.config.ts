import { configDefaults, defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [viteReact()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'convex/**/*.test.ts'],
    exclude: [...configDefaults.exclude, '**/.claude/**', '**/node_modules_OLD/**', '**/node_modules.*/**'],
  },
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname, '#': new URL('./src', import.meta.url).pathname },
  },
})
