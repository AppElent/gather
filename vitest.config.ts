import { defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [viteReact()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'convex/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname, '#': new URL('./src', import.meta.url).pathname },
  },
})
