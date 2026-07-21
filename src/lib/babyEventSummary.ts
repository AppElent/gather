import type { Doc } from '../../convex/_generated/dataModel'
import {
  DIAPER_KIND_LABELS,
  FEEDING_METHOD_LABELS,
  FEEDING_SIDE_LABELS,
  TEMPERATURE_METHOD_LABELS,
} from './babyEventFields'

/** One-line human summary of an event's `data` payload, used in the timeline and PDF export. */
export function summarizeEvent(event: Doc<'babyEvents'>): string {
  const data = event.data as Record<string, unknown>
  switch (event.type) {
    case 'temperature': {
      const method =
        typeof data.method === 'string'
          ? TEMPERATURE_METHOD_LABELS[data.method]
          : undefined
      const celsius = typeof data.celsius === 'number' ? data.celsius : 0
      return `${celsius.toFixed(1)}°C${method ? ` (${method})` : ''}`
    }
    case 'feeding': {
      const method =
        typeof data.method === 'string'
          ? (FEEDING_METHOD_LABELS[data.method] ?? data.method)
          : ''
      const side =
        typeof data.side === 'string'
          ? ` · ${FEEDING_SIDE_LABELS[data.side] ?? data.side}`
          : ''
      const amount =
        typeof data.amountMl === 'number' ? ` · ${data.amountMl} ml` : ''
      return `${method}${side}${amount}`
    }
    case 'diaper': {
      const kind = typeof data.kind === 'string' ? data.kind : ''
      return `${DIAPER_KIND_LABELS[kind] ?? kind} diaper`
    }
    case 'sleep': {
      if (event.endTimestamp) {
        const mins = Math.round((event.endTimestamp - event.timestamp) / 60000)
        const h = Math.floor(mins / 60)
        const m = mins % 60
        return `Sleep · ${h > 0 ? `${h}h ` : ''}${m}m`
      }
      return 'Sleep'
    }
    case 'growth': {
      const parts: string[] = []
      if (typeof data.weightKg === 'number') parts.push(`${data.weightKg} kg`)
      if (typeof data.heightCm === 'number') parts.push(`${data.heightCm} cm`)
      if (typeof data.headCircumferenceCm === 'number') {
        parts.push(`head ${data.headCircumferenceCm} cm`)
      }
      return parts.join(' · ') || 'Growth measurement'
    }
    case 'medication': {
      const name = typeof data.name === 'string' ? data.name : 'Medication'
      const dose =
        typeof data.doseAmount === 'number'
          ? ` · ${data.doseAmount}${data.doseUnit ? ` ${data.doseUnit}` : ''}`
          : ''
      return `${name}${dose}`
    }
    case 'vaccination':
      return typeof data.name === 'string' ? data.name : 'Vaccination'
    case 'note':
      return data.milestone === true ? 'Milestone' : 'Note'
    default:
      return ''
  }
}
