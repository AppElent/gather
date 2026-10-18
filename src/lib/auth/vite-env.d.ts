/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLERK_PUBLISHABLE_KEY: string
  /** Dev-only test-instance user for the test-login button (see core.ts). */
  readonly VITE_TEST_USER_EMAIL?: string
  readonly VITE_TEST_USER_PASSWORD?: string
}
