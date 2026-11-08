/**
 * The daily AI cap, as it crosses the wire.
 *
 * An AI action over its budget throws a `ConvexError` whose data is
 * `{ kind: 'aiLimitReached' }` — the shape of every refusal (`refusals.ts`) —
 * and leaves its success return exactly as it was. That is deliberate: a phone
 * build installed before the cap existed (ADR-0029) keeps the old contract until
 * its over-the-air update lands, and every older client already treats a
 * non-string `ConvexError` as a generic failure, so it can neither mistake the
 * limit for a result nor crash on it.
 */

import { refusalKind } from './refusals'

export const AI_LIMIT_KIND = 'aiLimitReached'

/** Whether a thrown value is the daily-cap refusal from an AI action. */
export function isAiLimitReached(error: unknown): boolean {
  return refusalKind(error) === AI_LIMIT_KIND
}
