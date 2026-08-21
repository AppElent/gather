/**
 * The one line under a timeline row.
 *
 * The web has its own (`src/lib/babyEventSummary.ts`) and this is deliberately
 * not that one: the web's produces React nodes and reaches for web-only
 * formatting. What the two share is the *vocabulary* — both read
 * `baby.log.summary` and `baby.log.options` out of the shared message tree, so
 * a wet diaper is called the same thing on both clients even though the two
 * renderers are separate (ADR-0017).
 *
 * Pure: messages arrive as parameters, so this is callable from a test.
 */
import type { BabyEventType } from '@gather/core/domain'
import { fmt } from '@gather/core/i18n'

export interface SummaryEvent {
  type: BabyEventType
  timestamp: number
  endTimestamp?: number
  notes?: string
  data: unknown
}

type SummaryMessages = {
  celsiusWithMethod: string
  celsius: string
  sideMinutes: string
  diaper: { wet: string; dirty: string; both: string }
  sleepFor: string
  sleep: string
  headCircumference: string
  growth: string
  medication: string
  vaccination: string
  milestone: string
  note: string
  memory: string
}

type OptionMessages = {
  temperatureMethod: Record<string, string>
  feedingMethod: Record<string, string>
  feedingSide: Record<string, string>
  diaperKind: Record<string, string>
}

function minutes(ms: number): string {
  return `${Math.max(0, Math.round(ms / 60_000))}m`
}

export function summarize(
  event: SummaryEvent,
  m: SummaryMessages,
  options: OptionMessages,
): string {
  const data = (event.data ?? {}) as Record<string, unknown>

  if (event.type === 'temperature') {
    const celsius = data.celsius as number | undefined
    if (celsius === undefined) return m.celsius
    const method = data.method as string | undefined
    return method
      ? fmt(m.celsiusWithMethod, {
          celsius,
          method: options.temperatureMethod[method] ?? method,
        })
      : fmt(m.celsius, { celsius })
  }

  if (event.type === 'feeding') {
    const method = data.method as string | undefined
    const parts: string[] = []
    if (method) parts.push(options.feedingMethod[method] ?? method)
    // One unit per method (ml for a bottle, g for solid food), so at most one
    // of these is ever on an entry.
    if (typeof data.amountMl === 'number') parts.push(`${data.amountMl} ml`)
    if (typeof data.amountG === 'number') parts.push(`${data.amountG} g`)
    const left = data.leftMin as number | undefined
    const right = data.rightMin as number | undefined
    if (left) {
      parts.push(
        fmt(m.sideMinutes, { side: options.feedingSide.left, minutes: left }),
      )
    }
    if (right) {
      parts.push(
        fmt(m.sideMinutes, { side: options.feedingSide.right, minutes: right }),
      )
    }
    return parts.join(' · ')
  }

  if (event.type === 'diaper') {
    const kind = data.kind as 'wet' | 'dirty' | 'both' | undefined
    return kind ? m.diaper[kind] : m.diaper.wet
  }

  if (event.type === 'sleep') {
    // No running timer in v1, so a sleep with no end means "duration unknown"
    // rather than "still asleep" — and it says the shorter thing instead of
    // counting up to now.
    return event.endTimestamp && event.endTimestamp > event.timestamp
      ? fmt(m.sleepFor, {
          duration: minutes(event.endTimestamp - event.timestamp),
        })
      : m.sleep
  }

  if (event.type === 'growth') {
    const parts: string[] = []
    if (typeof data.weightKg === 'number') parts.push(`${data.weightKg} kg`)
    if (typeof data.heightCm === 'number') parts.push(`${data.heightCm} cm`)
    if (typeof data.headCircumferenceCm === 'number') {
      parts.push(fmt(m.headCircumference, { value: data.headCircumferenceCm }))
    }
    return parts.length > 0 ? parts.join(' · ') : m.growth
  }

  if (event.type === 'medication') {
    const name = (data.name as string | undefined) ?? m.medication
    const amount = data.doseAmount as number | undefined
    const unit = (data.doseUnit as string | undefined) ?? ''
    return amount === undefined ? name : `${name} · ${amount} ${unit}`.trim()
  }

  if (event.type === 'vaccination') {
    return (data.name as string | undefined) ?? m.vaccination
  }

  if (event.type === 'memory') {
    // The whole of a memory is what it says happened, so the line under the
    // row is that sentence rather than a word about it.
    const what = (data.what as string | undefined)?.trim()
    return what || m.memory
  }

  return event.notes?.trim() || m.note
}
