import { z } from 'zod'

export const groupId = z
  .string()
  .min(1)
  .describe('The Group to act in: an id from list_groups.')

export const idempotencyKey = z
  .string()
  .min(8)
  .max(100)
  .describe(
    'Unique key for this write, such as a UUID. Reuse it only when retrying the same write.',
  )

export const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.')
  .describe('A calendar day, YYYY-MM-DD')

export const clockTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM, 24-hour.')
  .describe('Local time of day, HH:MM (24-hour)')

/** `HH:MM` as minutes after midnight, the calendar's stored form. */
export function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function clockOf(minutes: number | undefined): string | undefined {
  if (minutes === undefined) return undefined
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Case-insensitive "contains", for the list tools' optional filters. */
export function matches(query: string | undefined, ...fields: unknown[]) {
  if (!query) return true
  const needle = query.toLowerCase()
  return fields.some((field) =>
    Array.isArray(field)
      ? field.some((item) => String(item).toLowerCase().includes(needle))
      : typeof field === 'string' && field.toLowerCase().includes(needle),
  )
}
