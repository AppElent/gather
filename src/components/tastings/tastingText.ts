import {
  type TastingAttributes,
  type TastingKind,
  type TastingVocabularyId,
  tastingFactsLine,
  type tastingFields,
} from '@gather/core/tastings'
import type { Messages } from '../../lib/i18n'

export function tastingFieldValue(
  messages: Messages,
  field: ReturnType<typeof tastingFields>[number],
  value: unknown,
): string {
  if (Array.isArray(value)) {
    return value
      .map((entry) => tastingTerm(messages, field.vocabulary, String(entry)))
      .join(', ')
  }
  if (typeof value === 'number') {
    const unit = field.unit ? messages.tastings.units[field.unit] : ''
    return unit ? `${value}${unit === '%' ? '' : ' '}${unit}` : String(value)
  }
  return tastingTerm(messages, field.vocabulary, String(value ?? ''))
}

export function tastingTerm(
  messages: Messages,
  vocabulary: TastingVocabularyId | undefined,
  key: string,
): string {
  if (!vocabulary) return key
  return (
    (messages.tastings.vocabularies[vocabulary] as Record<string, string>)[
      key
    ] ?? key
  )
}

export function subjectFacts(
  messages: Messages,
  kind: TastingKind,
  attributes: TastingAttributes,
): string {
  return tastingFactsLine(
    kind,
    attributes,
    (vocabulary, key) => tastingTerm(messages, vocabulary, key),
    (unit) => messages.tastings.units[unit],
  )
}
