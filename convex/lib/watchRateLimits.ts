/**
 * How often a paired watch may call (APP-653). A watch asks for a Module when
 * it opens and sends an outbox when it is back online, so these are far above
 * one wrist and far below a script.
 */
import { HOUR, MINUTE, RateLimiter } from '@convex-dev/rate-limiter'
import { components } from '../_generated/api'

/** The most changes one request may carry. */
export const MAX_CHANGES = 50

export const watchLimits = new RateLimiter(components.rateLimiter, {
  /** Per watch: every call. */
  watchRequests: {
    kind: 'token bucket',
    rate: 60,
    period: MINUTE,
    capacity: 120,
  },
  /** Per watch: changes, each counted. */
  watchChanges: {
    kind: 'token bucket',
    rate: 120,
    period: MINUTE,
    capacity: 300,
  },
  /** Per person: new keys. */
  watchPairings: { kind: 'token bucket', rate: 20, period: HOUR, capacity: 20 },
})
