import type { Doc } from '../../convex/_generated/dataModel'
import { fmt } from './i18n'
import type { Messages } from './i18n/messages/en'

/**
 * The words this file needs. Passed in rather than read from a hook: the
 * timeline renders it from React and the PDF export from a plain function, and
 * only one of those has a context to read (ADR-0011).
 */
export type BabySummaryMessages = Messages['baby']['log']

/** One-line human summary of an event's `data` payload, used in the timeline and PDF export. */
export function summarizeEvent(
  event: Doc<'babyEvents'>,
  m: BabySummaryMessages,
): string {
  const data = event.data as Record<string, unknown>
  const { options, summary } = m

  switch (event.type) {
    case 'temperature': {
      const method =
        typeof data.method === 'string'
          ? options.temperatureMethod[
              data.method as keyof typeof options.temperatureMethod
            ]
          : undefined
      const celsius = (
        typeof data.celsius === 'number' ? data.celsius : 0
      ).toFixed(1)
      return method
        ? fmt(summary.celsiusWithMethod, { celsius, method })
        : fmt(summary.celsius, { celsius })
    }
    case 'feeding': {
      const method =
        typeof data.method === 'string'
          ? (options.feedingMethod[
              data.method as keyof typeof options.feedingMethod
            ] ?? data.method)
          : ''
      const amount =
        typeof data.amountMl === 'number' ? ` · ${data.amountMl} ml` : ''
      // Per-side minutes supersede the coarse side label when present —
      // "Left 10m · Right 8m" already says which side(s).
      const sides: string[] = []
      if (typeof data.leftMin === 'number') {
        sides.push(
          fmt(summary.sideMinutes, {
            side: options.feedingSide.left,
            minutes: data.leftMin,
          }),
        )
      }
      if (typeof data.rightMin === 'number') {
        sides.push(
          fmt(summary.sideMinutes, {
            side: options.feedingSide.right,
            minutes: data.rightMin,
          }),
        )
      }
      if (sides.length > 0) {
        return `${method} · ${sides.join(' · ')}${amount}`
      }
      const side =
        typeof data.side === 'string'
          ? ` · ${options.feedingSide[data.side as keyof typeof options.feedingSide] ?? data.side}`
          : ''
      return `${method}${side}${amount}`
    }
    case 'diaper': {
      const kind = typeof data.kind === 'string' ? data.kind : ''
      return summary.diaper[kind as keyof typeof summary.diaper] ?? kind
    }
    case 'sleep': {
      if (event.endTimestamp) {
        const mins = Math.round((event.endTimestamp - event.timestamp) / 60000)
        const hours = Math.floor(mins / 60)
        const rest = mins % 60
        return fmt(summary.sleepFor, {
          duration: `${hours > 0 ? `${hours}h ` : ''}${rest}m`,
        })
      }
      return summary.sleep
    }
    case 'growth': {
      const parts: string[] = []
      if (typeof data.weightKg === 'number') parts.push(`${data.weightKg} kg`)
      if (typeof data.heightCm === 'number') parts.push(`${data.heightCm} cm`)
      if (typeof data.headCircumferenceCm === 'number') {
        parts.push(
          fmt(summary.headCircumference, { value: data.headCircumferenceCm }),
        )
      }
      return parts.join(' · ') || summary.growth
    }
    case 'medication': {
      const name =
        typeof data.name === 'string' ? data.name : summary.medication
      const dose =
        typeof data.doseAmount === 'number'
          ? ` · ${data.doseAmount}${data.doseUnit ? ` ${data.doseUnit}` : ''}`
          : ''
      return `${name}${dose}`
    }
    case 'vaccination':
      return typeof data.name === 'string' ? data.name : summary.vaccination
    case 'note':
      return data.milestone === true ? summary.milestone : summary.note
    default:
      return ''
  }
}
