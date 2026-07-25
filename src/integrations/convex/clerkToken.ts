/**
 * Fetches the Convex-audience JWT from Clerk, with retries.
 *
 * Convex's bundled `ConvexProviderWithClerk` maps *any* `getToken()` rejection
 * to `null`, and its AuthenticationManager treats a single `null` as terminal:
 * it reports `onAuthChange(false)`, resets itself to `noAuth` and never retries.
 * A hiccup while minting the token — most likely right after sign-in, when the
 * session is brand new — therefore leaves the client permanently unauthenticated
 * until the page is reloaded. Retrying here keeps those hiccups from ever
 * reaching that dead end.
 */

export type ClerkGetToken = (options: {
  template?: string
  skipCache?: boolean
}) => Promise<string | null>

/** Total attempts (initial + retries) per token fetch. */
export const TOKEN_FETCH_ATTEMPTS = 3
/** Clerk's own call has no timeout, so a hung request would stall auth forever. */
export const TOKEN_FETCH_TIMEOUT_MS = 10_000

const TOKEN_RETRY_BASE_DELAY_MS = 250

const retryDelayMs = (attempt: number) =>
  TOKEN_RETRY_BASE_DELAY_MS * 2 ** attempt

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('Clerk token fetch timed out')),
          ms,
        )
      }),
    ])
  } finally {
    clearTimeout(timeoutId)
  }
}

export interface FetchClerkConvexTokenOptions {
  /** Session tokens already carry the Convex audience, so no JWT template. */
  sessionTargetsConvex: boolean
  forceRefreshToken: boolean
  attempts?: number
  timeoutMs?: number
  wait?: (ms: number) => Promise<void>
}

export async function fetchClerkConvexToken(
  getToken: ClerkGetToken,
  {
    sessionTargetsConvex,
    forceRefreshToken,
    attempts = TOKEN_FETCH_ATTEMPTS,
    timeoutMs = TOKEN_FETCH_TIMEOUT_MS,
    wait = sleep,
  }: FetchClerkConvexTokenOptions,
): Promise<string | null> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    // Retries always bypass Clerk's cache: a cached miss would otherwise make
    // every further attempt fail in exactly the same way.
    const skipCache = forceRefreshToken || attempt > 0
    try {
      const token = await withTimeout(
        getToken(
          sessionTargetsConvex
            ? { skipCache }
            : { template: 'convex', skipCache },
        ),
        timeoutMs,
      )
      if (token) return token
    } catch {
      // Both a rejection and a `null` mean "no usable token"; retry either way.
    }
    if (attempt < attempts - 1) await wait(retryDelayMs(attempt))
  }
  return null
}
