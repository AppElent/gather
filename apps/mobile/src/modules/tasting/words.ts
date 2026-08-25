/**
 * Turning the Kind spec's keys into the reader's words.
 *
 * The spec deals in keys — `semiHard`, `milk`, `cheese` — because a key is the
 * thing two locales can both point at (ADR-0011). Every screen needs the same
 * four lookups over those keys, so they are here once rather than as four
 * inline `t.tastings.…[key]` expressions per component, each of which would
 * need its own cast.
 *
 * Plain functions taking the dictionary, not hooks: the same rule the rest of
 * `lib/` follows, so a helper stays callable from a test with no React tree.
 *
 * **A tag is not always a key.** The vocabularies are prompts, not permission
 * lists (story 11), so `term()` answers with the raw string when it has no
 * translation for it — which is exactly right, because a typed "wet slate" is
 * content the person wrote and translating it was never on the table.
 */
import type {
  TastingFieldDef,
  TastingKind,
  TastingVocabularyId,
} from '@gather/core/tastings'

import type { Messages } from '../../i18n'

export type TastingWords = Messages['tastings']

/** What a field is called — "Milk", "Tannin". */
export function fieldLabel(t: TastingWords, field: TastingFieldDef): string {
  return (t.fields as Record<string, string>)[field.key] ?? field.key
}

/** The unit at the right of a number field — "%", "months". */
export function unitLabel(t: TastingWords, field: TastingFieldDef): string {
  return field.unit ? t.units[field.unit] : ''
}

/**
 * One term of one vocabulary, or the term itself where there is no translation
 * — which is how a descriptor somebody typed survives being rendered.
 */
export function term(
  t: TastingWords,
  vocabulary: TastingVocabularyId | undefined,
  key: string,
): string {
  if (!vocabulary) return key
  const words = (
    t.vocabularies as Record<string, Record<string, string> | undefined>
  )[vocabulary]
  return words?.[key] ?? key
}

/** A `term` bound to the dictionary, for `tastingFactsLine` and friends. */
export function termResolver(t: TastingWords) {
  return (vocabulary: TastingVocabularyId, key: string) =>
    term(t, vocabulary, key)
}

/** What one Kind of thing is called — singular, plural, and its headings. */
export function kindWords(t: TastingWords, kind: TastingKind) {
  return t.kinds[kind]
}
