import { refusalKind, refusalSentence } from '@gather/core/refusals'
import { ConvexError } from 'convex/values'

/**
 * The readable half of something thrown by a call, and the only reader of one.
 *
 * - A keyed refusal (`{ kind }`, `@gather/core/refusals`) reads as the sentence
 *   `refusals` holds for its kind, in the reader's language (ADR-0011). A
 *   refused tasting attribute is read by its `problem`, which says what was
 *   wrong with the field. A key the caller has no sentence for gets the
 *   fallback.
 * - A `ConvexError` carrying a sentence ("List not found") shows that sentence.
 *   Its `.message` is the wire's `[CONVEX M(…)]` line, never something to show.
 * - Anything else is an `Error` we did not write the wording for; its message
 *   is still more use to a reader than silence.
 */
export function errorMessage(
  error: unknown,
  fallback: string,
  refusals: Readonly<Record<string, string>> = {},
): string {
  const key = refusalKey(error)
  if (key !== null) {
    return Object.hasOwn(refusals, key) ? refusals[key] : fallback
  }
  if (error instanceof ConvexError) return refusalSentence(error) ?? fallback
  return error instanceof Error && error.message ? error.message : fallback
}

function refusalKey(error: unknown): string | null {
  const kind = refusalKind(error)
  if (kind !== 'tastingAttribute') return kind
  const { problem } = (error as { data: { problem?: unknown } }).data
  return typeof problem === 'string' ? problem : kind
}
