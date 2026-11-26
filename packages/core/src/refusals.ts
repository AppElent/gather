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
import type { BarcodeProblem } from './barcodes'
import { CALENDAR_VALIDATION_KEYS } from './calendar'
import type { MealPreferencesField } from './mealPreferences'
import type { TastingAttributeError, TastingAttributeProblem } from './tastings'

export const TASTING_REFUSALS = [
  'needsScore',
  'needsName',
  'notYourTasting',
] as const

export const CALENDAR_REFUSAL_CODES = [
  'not-found',
  'deleted',
  'conflict',
  'assignee-not-member',
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

/**
 * Why the account portal (account.appelent.nl) may not delete Gather's data
 * now, as `accountPortal.deletionBlocker` returns it: the account is already
 * being deleted, in the scheduled steps that follow `accounts.deleteAccount`.
 * A stable code, because the portal owns the words.
 */
export const DELETION_IN_PROGRESS = 'deletionInProgress'

/**
 * The refusal for an export cursor this server did not hand out — not JSON,
 * the wrong shape, or a step the export does not have — from
 * `accountPortal.exportPage` and `dataExport.page` alike.
 */
export const INVALID_EXPORT_CURSOR = { kind: 'invalidCursor' } as const

export function refusal(
  kind: (typeof TASTING_REFUSALS)[number],
): { kind: string } {
  return { kind }
}

/**
 * A tasting attribute the Kind spec refused. It carries the field and what was
 * wrong with it, so a reader can say which.
 */
export function tastingAttributeRefusal({
  field,
  problem,
}: TastingAttributeError): { kind: string; field: string; problem: string } {
  return { kind: 'tastingAttribute', field, problem }
}

/** What was wrong with a refused tasting attribute, when that is the refusal. */
export function readTastingAttributeProblem(
  error: unknown,
): TastingAttributeProblem | null {
  if (refusalKind(error) !== 'tastingAttribute') return null
  const data = errorData(error) as { problem?: unknown }
  return typeof data.problem === 'string'
    ? (data.problem as TastingAttributeProblem)
    : null
}

/**
 * The prefix exists only on the wire: installed phones find a calendar refusal
 * by searching `.message`, which carries the JSON of this data.
 */
export function calendarRefusal(code: CalendarRefusalCode): { kind: string } {
  return { kind: `calendar:${code}` }
}

/**
 * A meal preference the server would not store, and which one. The screen
 * never sends one; an older or foreign client might.
 */
export function mealPreferencesRefusal(
  field: MealPreferencesField,
): { kind: string; field: string } {
  return { kind: 'mealPreferences:invalid', field }
}

function errorData(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'data' in error
    ? error.data
    : undefined
}

/**
 * Why a Loyalty card write was refused. `notFound` covers "no such card" and
 * "a card in another Group" alike (ADR-0009); the `cardNumber:*` codes are the
 * barcode validator's problems, so the form can say what is wrong.
 */
export const LOYALTY_CARD_REFUSAL_CODES = [
  'notFound',
  'needsStore',
  'tooLong',
  'brandColor',
  'unknownRetailer',
  'cardNumber:empty',
  'cardNumber:characters',
  'cardNumber:length',
  'cardNumber:checkDigit',
] as const satisfies readonly (string | `cardNumber:${BarcodeProblem}`)[]
export type LoyaltyCardRefusalCode = (typeof LOYALTY_CARD_REFUSAL_CODES)[number]

/** Namespaced on the wire, like the calendar's, so kinds cannot collide. */
export function loyaltyCardRefusal(code: LoyaltyCardRefusalCode): {
  kind: string
} {
  return { kind: `loyalty:${code}` }
}

export function readLoyaltyCardRefusal(
  error: unknown,
): LoyaltyCardRefusalCode | null {
  const kind = refusalKind(error)
  return (
    LOYALTY_CARD_REFUSAL_CODES.find((code) => `loyalty:${code}` === kind) ??
    null
  )
}

/**
 * Why an Energy write was refused (APP-492). `notFound` covers "no such
 * address" and "an address in another Group" alike, and `houseNotFound` a
 * House link to a House outside the Group (ADR-0009). A meter reading below
 * the one before it is `readingLower` (a new meter is a new channel), one
 * above a later reading `readingHigher` (APP-494).
 */
export const ENERGY_REFUSAL_CODES = [
  'needsName',
  'tooLong',
  'houseNotFound',
  'notFound',
  // APP-494: meter readings, their channels and contracts.
  'readingInvalid',
  'readingLower',
  'readingHigher',
  'readingInFuture',
  'channelsExist',
  'contractInvalid',
  'contractDateTaken',
  // APP-495: Home Assistant.
  'adminOnly',
  'addressNotHttps',
  'addressInvalid',
  'addressPrivate',
  'tokenNeeded',
  'channelTwice',
  'channelsMixed',
  'tooManyChannels',
  'statisticNotFound',
  'pickChannel',
  'sourceUnreachable',
  'sourceNotHomeAssistant',
  'sourceBadToken',
  'sourceRefused',
  // APP-493: the price source.
  'priceKeyNeeded',
  'priceKeyInvalid',
  // APP-496: solar panels and batteries.
  'assetNeedsName',
  'assetInvalid',
  'assetInFuture',
  'tooManyAssets',
] as const
export type EnergyRefusalCode = (typeof ENERGY_REFUSAL_CODES)[number]

/** Namespaced on the wire, like the calendar's, so kinds cannot collide. */
export function energyRefusal(code: EnergyRefusalCode): { kind: string } {
  return { kind: `energy:${code}` }
}

export function readEnergyRefusal(error: unknown): EnergyRefusalCode | null {
  const kind = refusalKind(error)
  return ENERGY_REFUSAL_CODES.find((code) => `energy:${code}` === kind) ?? null
}

/**
 * Why a task write was refused.
 *
 * - `assignee-not-member` (APP-302): a person who is not a current Member of
 *   the task's Group.
 * - `not-found`: no such task or list, or one in another Group (ADR-0009).
 * - `read-only`: a list linked to an outside service; Gather cannot write it.
 * - `not-grocery-list`: Recent, put back and Clear checked work on grocery
 *   lists only (APP-310).
 * - `invalid-undo`: an undo of Clear checked that names a moment it cannot
 *   have come from, such as one in the future (APP-403).
 * - `clear-superseded`: the list was cleared again, or already put back,
 *   since the clear being undone; nothing changed (APP-403).
 * - `amount-changed`: a grocery item's amount is not the one the write expected,
 *   or no longer adds up with it; nothing changed (APP-671).
 * - `subtask-depth` (APP-304): a subtask cannot have subtasks, and a task
 *   with subtasks cannot become one.
 * - `subtask-list`: a subtask sits on its parent's list, in its parent's
 *   section.
 * - `subtask-grocery`: a grocery list holds items, not subtasks.
 * - `subtask-repeat`: a subtask does not repeat on its own; it reopens with
 *   its parent.
 */
export const TASK_REFUSAL_CODES = [
  'assignee-not-member',
  'not-found',
  'read-only',
  'not-grocery-list',
  'invalid-undo',
  'clear-superseded',
  'amount-changed',
  'subtask-depth',
  'subtask-list',
  'subtask-repeat',
  'subtask-grocery',
] as const
export type TaskRefusalCode = (typeof TASK_REFUSAL_CODES)[number]

/** Namespaced on the wire, like the calendar's, so kinds cannot collide. */
export function taskRefusal(code: TaskRefusalCode): { kind: string } {
  return { kind: `tasks:${code}` }
}

export function readTaskRefusal(error: unknown): TaskRefusalCode | null {
  const kind = refusalKind(error)
  return TASK_REFUSAL_CODES.find((code) => `tasks:${code}` === kind) ?? null
}

/**
 * Why a note write was refused (APP-805): its title and body together are over
 * `NOTE_MAX_CHARS` (`@gather/core/notes`).
 */
export const NOTE_REFUSAL_CODES = ['too-long'] as const
export type NoteRefusalCode = (typeof NOTE_REFUSAL_CODES)[number]

/** Namespaced on the wire, like the calendar's, so kinds cannot collide. */
export function noteRefusal(code: NoteRefusalCode): { kind: string } {
  return { kind: `notes:${code}` }
}

/**
 * A refused note in the reader's own words: the sentence `sentences` holds for
 * its kind (`messages.notes.refusals`), or null when the thrown value is not one.
 */
export function noteRefusalSentence(
  error: unknown,
  sentences: Readonly<Record<`notes:${NoteRefusalCode}`, string>>,
): string | null {
  const kind = refusalKind(error)
  const code = NOTE_REFUSAL_CODES.find((each) => `notes:${each}` === kind)
  return code === undefined ? null : sentences[`notes:${code}`]
}

/**
 * Why a Group's time zone was not changed (APP-475): the caller is not an
 * admin, or no such IANA zone.
 */
export const GROUP_TIME_ZONE_REFUSAL_CODES = [
  'admin-only',
  'unknown-zone',
] as const
export type GroupTimeZoneRefusalCode =
  (typeof GROUP_TIME_ZONE_REFUSAL_CODES)[number]

export function groupTimeZoneRefusal(code: GroupTimeZoneRefusalCode): {
  kind: string
} {
  return { kind: `groupTimeZone:${code}` }
}

/**
 * A refused time zone in the reader's own words: the sentence `sentences`
 * holds for its code, or null when the thrown value is not one.
 */
export function groupTimeZoneRefusalSentence(
  error: unknown,
  sentences: Readonly<Record<GroupTimeZoneRefusalCode, string>>,
): string | null {
  const kind = refusalKind(error)
  const code = GROUP_TIME_ZONE_REFUSAL_CODES.find(
    (each) => `groupTimeZone:${each}` === kind,
  )
  return code === undefined ? null : sentences[code]
}

/**
 * Why a Group-scoped call was refused at the Group itself (APP-429), before
 * any row was read. `convex/lib/groupAccess.ts` builds them.
 *
 * - `not-signed-in`: no caller, or a caller with no Gather account yet. The
 *   sign-in helpers in `convex/lib/sharing.ts` throw it too (APP-581), so every
 *   signed-out refusal reads the same, Group or not.
 * - `unknown-slug`: no Group has that slug.
 * - `unknown-group`: no Group has that id (APP-581), from a write that names
 *   a Group by id: the mutations in `convex/groups.ts`, and
 *   `integrations.storeConnection` for a Group deleted meanwhile.
 * - `not-a-member`: the Group exists and the caller is not in it.
 *
 * The data also carries the English sentence these refusals threw before they
 * were keyed, as `message`. Clients that predate the kinds read nothing from an
 * object (they fall back to their own wording); clients that know `message`
 * keep showing the sentence they always showed until they get one of their own.
 */
export const GROUP_REFUSAL_CODES = [
  'not-signed-in',
  'unknown-slug',
  'unknown-group',
  'not-a-member',
] as const
export type GroupRefusalCode = (typeof GROUP_REFUSAL_CODES)[number]

/** Namespaced on the wire, like the calendar's, so kinds cannot collide. */
export function groupRefusal(
  code: GroupRefusalCode,
  message: string,
): { kind: string; message: string } {
  return { kind: `groups:${code}`, message }
}

export function readGroupRefusal(error: unknown): GroupRefusalCode | null {
  const kind = refusalKind(error)
  return GROUP_REFUSAL_CODES.find((code) => `groups:${code}` === kind) ?? null
}

/**
 * A refused Group in the reader's own words: the sentence `sentences` holds
 * for its kind (`messages.common.errors.groupRefusals`), or null when the
 * thrown value is not a Group refusal.
 */
export function groupRefusalSentence(
  error: unknown,
  sentences: Readonly<Record<GroupRefusalCode, string>>,
): string | null {
  const code = readGroupRefusal(error)
  return code === null ? null : sentences[code]
}

/**
 * Why a paired watch's call, or pairing one, was refused (APP-653), for a
 * reason of its own. A call refused at the key or the Group answers with the
 * Group refusal above.
 *
 * - `bad-request`: the request or the change is not one this API knows.
 * - `rate-limited`: too many calls; try again after `Retry-After`.
 * - `not-found`: no such item, task or list in the watch's Group.
 * - `read-only`: it is on a list Gather cannot write to.
 * - `key-reused`: the change's key was already used for another one.
 * - `failed`: the server could not apply the change; it may be sent again.
 */
export const WATCH_REFUSAL_CODES = [
  'bad-request',
  'rate-limited',
  'not-found',
  'read-only',
  'key-reused',
  'failed',
] as const
export type WatchRefusalCode = (typeof WATCH_REFUSAL_CODES)[number]

export function watchRefusal(code: WatchRefusalCode): { kind: string } {
  return { kind: `watch:${code}` }
}

export function readWatchRefusal(error: unknown): WatchRefusalCode | null {
  const kind = refusalKind(error)
  return WATCH_REFUSAL_CODES.find((code) => `watch:${code}` === kind) ?? null
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

/**
 * The sentence a server chose to show: the data itself when it threw a
 * sentence, or the `message` a keyed refusal carries for readers that have no
 * wording of their own for its kind. Only Group refusals carry a `message`
 * today (`groupRefusal`); give another vocabulary one only to keep a sentence
 * that installed readers already show.
 */
export function refusalSentence(error: unknown): string | null {
  const data = errorData(error)
  if (typeof data === 'string') return data
  if (typeof data === 'object' && data !== null && 'message' in data) {
    return typeof data.message === 'string' ? data.message : null
  }
  return null
}
