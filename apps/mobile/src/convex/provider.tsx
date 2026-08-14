/**
 * The phone as a second client of the same Gather service.
 *
 * There is no mobile backend and no mobile schema: this is the deployment the
 * web app talks to, reached with the same Clerk identity through the same JWT
 * template (`applicationID: 'convex'` in `convex/auth.config.ts`). Everything
 * the phone reads therefore arrives through the queries the web already proves,
 * and every access rule is enforced where it always was.
 *
 * **Static dot access on `process.env` is load-bearing** for the same reason it
 * is in `auth/config.ts`: Metro substitutes `EXPO_PUBLIC_*` textually at build
 * time, so a computed read yields `undefined` in a release build while appearing
 * to work in dev.
 *
 * The URL is required rather than optional. A missing one is a misconfigured
 * checkout, and failing at import is louder — and far easier to act on — than a
 * websocket that quietly never connects.
 */
import { useAuth } from '@clerk/expo'
import { ConvexReactClient } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import type { ReactNode } from 'react'

const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL

if (!CONVEX_URL) {
  throw new Error(
    'EXPO_PUBLIC_CONVEX_URL is not set. Add it to apps/mobile/.env.local (see .env.example).',
  )
}

// `unsavedChangesWarning` is a `beforeunload` handler, and it is opt-*out*: left
// unset, the client reaches for `window.addEventListener` on a runtime that may
// not have one. There is no page to leave on a phone, so it is switched off
// explicitly rather than left to the environment sniff.
const convex = new ConvexReactClient(CONVEX_URL, {
  unsavedChangesWarning: false,
})

export function AppConvexProvider({ children }: { children: ReactNode }) {
  // `useAuth` comes from `@clerk/expo` (Clerk Core 3) while the web passes
  // `@clerk/clerk-react`'s (Core 2) — ADR-0014. Convex only ever calls the hook
  // and reads a token off it, so the generation split stops here.
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  )
}
