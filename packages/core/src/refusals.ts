/**
 * Refusals as they cross the wire.
 *
 * The server throws a `ConvexError` whose data is `{ kind }`, and a client reads
 * the kind back and resolves it in the reader's language (ADR-0011). A plain
 * `Error` will not do: production redacts its message on the way to the client.
 *
 * Dependency-free on purpose (ADR-0016): errors are read structurally rather
 * than through `ConvexError`.
 */
import { CALENDAR_VALIDATION_KEYS } from './calendar'

export const TASTING_REFUSALS = [
  'needsScore',
  'needsName',
  'notYourTasting',
] as const
export const COMBO_REFUSALS = [
  'comboNothingSelected',
  'comboComponentUnavailable',
] as const

export const CALENDAR_REFUSAL_CODES = [
  'not-found',
  'deleted',
  'conflict',
  'assignee-not-member',
  'not-member',
  'person-not-member',
  ...CALENDAR_VALIDATION_KEYS,
] as const
export type CalendarRefusalCode = (typeof CALENDAR_REFUSAL_CODES)[number]

/**
 * What `ensureUser` throws at an account that is on its way out, as the
 * sentence itself: installed clients compare `.data` to this string.
 *
 * Deleting an account runs in scheduled steps, and `ensureUser` runs on every
 * app mount, so there is a window in which a mount would cheerfully build the
 * person a brand new household. The client signs out instead.
 */
export const ACCOUNT_DELETED = 'Account deleted'

export function refusal(
  kind: (typeof TASTING_REFUSALS | typeof COMBO_REFUSALS)[number],
): { kind: string } {
  return { kind }
}

/**
 * The prefix exists only on the wire: installed phones find a calendar refusal
 * by searching `.message`, which carries the JSON of this data.
 */
export function calendarRefusal(code: CalendarRefusalCode): { kind: string } {
  return { kind: `calendar:${code}` }
}

function errorData(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'data' in error
    ? error.data
    : undefined
}

/** The `kind` a thrown value carries, whichever vocabulary it comes from. */
export function refusalKind(error: unknown): string | null {
  const data = errorData(error)
  if (typeof data !== 'object' || data === null || !('kind' in data)) {
    return null
  }
  return typeof data.kind === 'string' ? data.kind : null
}

/** The thrown value's kind, when it is one of `kinds`. */
export function readRefusal<K extends string>(
  error: unknown,
  kinds: readonly K[],
): K | null {
  const kind = refusalKind(error)
  return kinds.find((each) => each === kind) ?? null
}

export function readCalendarRefusal(
  error: unknown,
): CalendarRefusalCode | null {
  const kind = refusalKind(error)
  return (
    CALENDAR_REFUSAL_CODES.find((code) => `calendar:${code}` === kind) ?? null
  )
}

/** The sentence a server chose to show, when it threw one rather than a kind. */
export function refusalSentence(error: unknown): string | null {
  const data = errorData(error)
  return typeof data === 'string' ? data : null
}
