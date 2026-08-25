/**
 * What a Kind of tasting records (ADR-0024, issue #199).
 *
 * Cheeses, Wines and Beers are three Modules over one backend, and the only
 * thing that differs between them is data: a **Kind spec** declares what its
 * subjects and its Tastings record, which vocabularies those fields draw on,
 * and whether a Tasting catalog exists. Adding a fourth Kind is an entry in
 * `TASTING_KIND_SPECS`, not a new Module backend.
 *
 * It lives in `@gather/core` for `photoPresets.ts`'s reason (ADR-0016): the
 * phone and the web both render these fields and both validate them, and two
 * clients answering "what does a wine record" separately is the drift this
 * file exists to prevent. Convex validates against it too, so a payload the
 * form would never produce is refused at the door rather than stored.
 *
 * ## Five field types, and no sixth
 *
 * - `text` — free prose. A producer's name, the notes.
 * - `number` — a measured figure. ABV, an age in months.
 * - `scale` — 1–5, one value. Sweetness, tannin, firmness. **Never half
 *   steps**: a scale is an observation, and 3.5 tannin is a false precision
 *   the score deliberately allows and this deliberately does not.
 * - `select` — one term of a shipped vocabulary.
 * - `tags` — several terms of a shipped vocabulary, **plus anything typed**.
 *   The vocabulary is a prompt, not a permission list (story 11).
 *
 * The renderer therefore has five field components and never learns what a
 * wine is. **Fields are fixed by the spec and a Group cannot define its own** —
 * free-text notes absorb what the spec lacks, and a user-defined field's label
 * could not live in the message tree (ADR-0011).
 *
 * ## Facts on the subject, impressions on the Tasting
 *
 * Producer, vintage, region and milk type do not change between tastings; what
 * you tasted on the night does. That split is why `subjectFields` and
 * `tastingFields` are two lists rather than one with a flag.
 *
 * ## Vocabularies are not the catalog
 *
 * Grapes, regions, styles and aroma descriptors ship here as spec data because
 * they are *field options*. A catalog entry is a *subject* — a whole cheese —
 * and lives in Convex (ADR-0024). Every Kind has vocabularies, including the
 * two with no catalog.
 */

import type { ModuleId } from './modules'

// ---------------------------------------------------------------------------
// The Kinds
// ---------------------------------------------------------------------------

export const TASTING_KINDS = ['cheese', 'wine', 'beer'] as const
export type TastingKind = (typeof TASTING_KINDS)[number]

export function isTastingKind(value: unknown): value is TastingKind {
  return (
    typeof value === 'string' &&
    (TASTING_KINDS as readonly string[]).includes(value)
  )
}

// ---------------------------------------------------------------------------
// The field types
// ---------------------------------------------------------------------------

export const TASTING_FIELD_TYPES = [
  'text',
  'number',
  'scale',
  'select',
  'tags',
] as const
export type TastingFieldType = (typeof TASTING_FIELD_TYPES)[number]

/**
 * The unit a `number` field is read in.
 *
 * A key rather than the symbol, because "months" is a word somebody reads and
 * "%" only looks like it is not (ADR-0011). Resolved through
 * `messages.tastings.units`.
 */
export const TASTING_UNITS = ['percent', 'months'] as const
export type TastingUnit = (typeof TASTING_UNITS)[number]

// ---------------------------------------------------------------------------
// Vocabularies
// ---------------------------------------------------------------------------

/**
 * Every shipped list of terms a `select` or `tags` field may draw on.
 *
 * Terms are **keys**, not words: `semiHard`, not "Semi-hard". The word is in
 * both message trees, keyed by this union, so a term added here without a
 * translation is a compile error rather than a chip reading `undefined`.
 *
 * Proper nouns are keys too, and their two translations are usually identical
 * — Nebbiolo is Nebbiolo in Dutch. That is not duplication to remove: the day
 * a term *does* differ (Bourgogne / Burgundy) there is already somewhere to
 * put it.
 */
export const TASTING_VOCABULARIES = {
  milkType: ['cow', 'goat', 'sheep', 'buffalo', 'mixed'],
  cheeseCountry: [
    'france',
    'italy',
    'netherlands',
    'spain',
    'switzerland',
    'unitedKingdom',
    'ireland',
    'germany',
    'belgium',
    'portugal',
    'greece',
    'denmark',
    'sweden',
    'norway',
    'austria',
    'unitedStates',
    'other',
  ],
  cheeseStyle: ['fresh', 'soft', 'semiHard', 'hard', 'blue'],
  cheeseAroma: [
    'nutty',
    'hay',
    'caramel',
    'mushroom',
    'butter',
    'barnyard',
    'grassy',
    'crystalline',
    'tangy',
    'smoky',
    'earthy',
    'sharp',
  ],
  grape: [
    'nebbiolo',
    'barbera',
    'dolcetto',
    'sangiovese',
    'cabernetSauvignon',
    'merlot',
    'syrah',
    'pinotNoir',
    'tempranillo',
    'grenache',
    'malbec',
    'chardonnay',
    'sauvignonBlanc',
    'riesling',
    'cheninBlanc',
    'pinotGris',
    'gewurztraminer',
    'viognier',
    'loureiro',
  ],
  wineRegion: [
    'bordeaux',
    'burgundy',
    'champagne',
    'loire',
    'rhone',
    'alsace',
    'beaujolais',
    'piedmont',
    'tuscany',
    'veneto',
    'sicily',
    'rioja',
    'riberaDelDuero',
    'priorat',
    'douro',
    'alentejo',
    'minho',
    'mosel',
    'rheingau',
    'wachau',
    'napaValley',
    'sonoma',
    'willametteValley',
    'marlborough',
    'barossaValley',
    'mendoza',
    'stellenbosch',
    'other',
  ],
  wineStyle: ['red', 'white', 'rose', 'sparkling', 'sweet', 'fortified'],
  wineAroma: [
    'cherry',
    'blackcurrant',
    'plum',
    'citrus',
    'pineapple',
    'peach',
    'apple',
    'violet',
    'rose',
    'leather',
    'tar',
    'tobacco',
    'vanilla',
    'oak',
    'smoke',
    'pepper',
    'herbal',
    'honey',
    'butter',
    'mineral',
  ],
  beerStyle: [
    'pilsner',
    'helles',
    'weizen',
    'witbier',
    'saison',
    'tripel',
    'dubbel',
    'quadrupel',
    'belgianStrongGolden',
    'paleAle',
    'ipa',
    'amberAle',
    'brownAle',
    'stout',
    'porter',
    'sour',
    'lambic',
    'barleyWine',
    'bock',
  ],
  beerAroma: [
    'banana',
    'clove',
    'citrus',
    'pine',
    'resin',
    'caramel',
    'chocolate',
    'coffee',
    'roasted',
    'honey',
    'bread',
    'floral',
    'herbal',
    'tart',
  ],
} as const satisfies Record<string, readonly string[]>

export type TastingVocabularyId = keyof typeof TASTING_VOCABULARIES
export type TastingTerm<V extends TastingVocabularyId = TastingVocabularyId> =
  (typeof TASTING_VOCABULARIES)[V][number]

export const TASTING_VOCABULARY_IDS = Object.keys(
  TASTING_VOCABULARIES,
) as TastingVocabularyId[]

/**
 * How many terms a `select` can offer before a row of chips stops being a row.
 *
 * Presentation, but derived from the data rather than declared per field: a
 * vocabulary that grows past this becomes a picker everywhere at once, which
 * is what stops one client showing 28 wine regions as chips because nobody
 * remembered to set a flag.
 */
export const SELECT_PICKER_THRESHOLD = 8

export function tastingSelectPresentation(
  vocabulary: TastingVocabularyId,
): 'chips' | 'picker' {
  return TASTING_VOCABULARIES[vocabulary].length > SELECT_PICKER_THRESHOLD
    ? 'picker'
    : 'chips'
}

export function tastingVocabulary(
  vocabulary: TastingVocabularyId,
): readonly string[] {
  return TASTING_VOCABULARIES[vocabulary]
}

// ---------------------------------------------------------------------------
// The Kind specs
// ---------------------------------------------------------------------------

export interface TastingFieldDef {
  readonly key: string
  readonly type: TastingFieldType
  /** Required for `select` and `tags`; meaningless on the other three. */
  readonly vocabulary?: TastingVocabularyId
  /** `number` only. */
  readonly unit?: TastingUnit
  /** `number` only. Inclusive, and the reason a vintage cannot be 20250. */
  readonly min?: number
  readonly max?: number
}

export interface TastingKindSpec {
  /** The Module this Kind is reached through. */
  readonly moduleId: ModuleId
  /**
   * Whether `tastingCatalog` ships entries for this Kind. Cheese does; wine
   * and beer deliberately do not, because a list of every wine is not a thing
   * (story 6).
   */
  readonly catalog: boolean
  /** Facts about the thing. They do not change between tastings. */
  readonly subjectFields: readonly TastingFieldDef[]
  /** Impressions. What one person thought on one night. */
  readonly tastingFields: readonly TastingFieldDef[]
}

export const TASTING_KIND_SPECS = {
  cheese: {
    moduleId: 'cheeses',
    catalog: true,
    subjectFields: [
      { key: 'milk', type: 'select', vocabulary: 'milkType' },
      { key: 'country', type: 'select', vocabulary: 'cheeseCountry' },
      { key: 'style', type: 'select', vocabulary: 'cheeseStyle' },
      { key: 'producer', type: 'text' },
      { key: 'age', type: 'number', unit: 'months', min: 0, max: 600 },
    ],
    tastingFields: [
      { key: 'firmness', type: 'scale' },
      { key: 'saltiness', type: 'scale' },
      { key: 'aromas', type: 'tags', vocabulary: 'cheeseAroma' },
      { key: 'notes', type: 'text' },
    ],
  },
  wine: {
    moduleId: 'wines',
    catalog: false,
    subjectFields: [
      { key: 'producer', type: 'text' },
      { key: 'vintage', type: 'number', min: 1800, max: 2200 },
      { key: 'grapes', type: 'tags', vocabulary: 'grape' },
      { key: 'region', type: 'select', vocabulary: 'wineRegion' },
      { key: 'style', type: 'select', vocabulary: 'wineStyle' },
      { key: 'abv', type: 'number', unit: 'percent', min: 0, max: 100 },
    ],
    tastingFields: [
      { key: 'sweetness', type: 'scale' },
      { key: 'acidity', type: 'scale' },
      { key: 'tannin', type: 'scale' },
      { key: 'body', type: 'scale' },
      { key: 'aromas', type: 'tags', vocabulary: 'wineAroma' },
      { key: 'notes', type: 'text' },
    ],
  },
  beer: {
    moduleId: 'beers',
    catalog: false,
    subjectFields: [
      { key: 'brewery', type: 'text' },
      { key: 'style', type: 'select', vocabulary: 'beerStyle' },
      { key: 'abv', type: 'number', unit: 'percent', min: 0, max: 100 },
    ],
    tastingFields: [
      { key: 'bitterness', type: 'scale' },
      { key: 'body', type: 'scale' },
      { key: 'aromas', type: 'tags', vocabulary: 'beerAroma' },
      { key: 'notes', type: 'text' },
    ],
  },
} as const satisfies Record<TastingKind, TastingKindSpec>

export type TastingFieldScope = 'subject' | 'tasting'

/**
 * Every field key any Kind declares, in either scope.
 *
 * One flat union rather than one per Kind, so `style` is labelled "Style" once
 * and cheese, wine and beer each point it at their own vocabulary. Two Kinds
 * that want genuinely different words use two keys — a wine has a `producer`
 * and a beer has a `brewery`.
 */
export type TastingFieldKey =
  | (typeof TASTING_KIND_SPECS)[TastingKind]['subjectFields'][number]['key']
  | (typeof TASTING_KIND_SPECS)[TastingKind]['tastingFields'][number]['key']

export function tastingKindSpec(kind: TastingKind): TastingKindSpec {
  return TASTING_KIND_SPECS[kind]
}

export function tastingFields(
  kind: TastingKind,
  scope: TastingFieldScope,
): readonly TastingFieldDef[] {
  const spec = TASTING_KIND_SPECS[kind]
  return scope === 'subject' ? spec.subjectFields : spec.tastingFields
}

/** The Modules the tasting Kinds are reached through, in Kind order. */
export const TASTING_MODULE_IDS = TASTING_KINDS.map(
  (kind) => TASTING_KIND_SPECS[kind].moduleId,
)

/** Which Kind a Module shows, or `undefined` for a Module that is not one. */
export function tastingKindForModule(
  moduleId: string,
): TastingKind | undefined {
  return TASTING_KINDS.find(
    (kind) => TASTING_KIND_SPECS[kind].moduleId === moduleId,
  )
}

// ---------------------------------------------------------------------------
// The score
// ---------------------------------------------------------------------------

/**
 * One rating scale for every Kind: 1–5 in half steps, stored as a number.
 *
 * Not per Kind, deliberately — "what did we love this year" has to be able to
 * compare a cheese with a bottle, and a per-Kind scale makes that a conversion
 * rather than a sort.
 */
export const TASTING_RATING = { min: 0.5, max: 5, step: 0.5 } as const

export function isValidTastingRating(value: unknown): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false
  if (value < TASTING_RATING.min || value > TASTING_RATING.max) return false
  // Times two rather than modulo 0.5: 4.5 % 0.5 is 0.49999999999999994.
  return Number.isInteger(value * 2)
}

/**
 * The household's average, to one decimal, or `null` when nothing has been
 * tasted yet.
 *
 * Computed on read everywhere. A subject has a handful of Tastings, and a
 * stored average is a cache that every edit and every delete invalidates
 * (ADR-0024).
 *
 * **The average is never shown without its count**: 5.0 from one person is not
 * 5.0 from four, which is why callers get both back from the same call.
 */
export function tastingAverage(
  ratings: readonly number[],
): { average: number; count: number } | null {
  if (ratings.length === 0) return null
  const total = ratings.reduce((sum, rating) => sum + rating, 0)
  return {
    average: Math.round((total / ratings.length) * 10) / 10,
    count: ratings.length,
  }
}

// ---------------------------------------------------------------------------
// Attributes
// ---------------------------------------------------------------------------

/**
 * What one field holds, once it holds anything.
 *
 * Mutable `string[]` rather than `readonly`, because this is also the shape
 * Convex stores and reads back — a `readonly` here would make every document
 * round-trip need a cast at the boundary to buy an immutability the database
 * does not have anyway.
 */
export type TastingAttributeValue = string | number | string[]
export type TastingAttributes = Readonly<Record<string, TastingAttributeValue>>

/** The longest a typed tag may be, and how many a field may carry. */
export const TAG_MAX_LENGTH = 40
export const TAG_MAX_COUNT = 24
/** Free prose. Long enough for a paragraph, short enough not to be a document. */
export const TEXT_MAX_LENGTH = 2000

/**
 * Why an attribute was refused.
 *
 * A key, not a sentence — the form resolves it into the reader's language
 * (ADR-0011), and Convex could not know which language that is.
 */
export type TastingAttributeProblem =
  | 'unknownField'
  | 'wrongType'
  | 'notInVocabulary'
  | 'outOfRange'
  | 'tooLong'
  | 'tooMany'

export interface TastingAttributeError {
  readonly field: string
  readonly problem: TastingAttributeProblem
}

/**
 * Drop everything the person left blank.
 *
 * A form sends `''` for a text field nobody typed in and `[]` for a chip row
 * nobody touched. Storing those would make "no producer" and "a producer whose
 * name is the empty string" the same row, and would put a key in `attributes`
 * for every field of every Kind. So an empty value is an absent field, decided
 * here rather than in each of two clients.
 *
 * Strings are trimmed on the way through, and so is every tag; a tag that
 * trims to nothing falls out, and duplicates collapse.
 */
export function normalizeTastingAttributes(
  attributes: Readonly<Record<string, unknown>>,
): Record<string, TastingAttributeValue> {
  const normalized: Record<string, TastingAttributeValue> = {}
  for (const [key, raw] of Object.entries(attributes)) {
    if (raw === undefined || raw === null) continue
    if (typeof raw === 'string') {
      const trimmed = raw.trim()
      if (trimmed) normalized[key] = trimmed
      continue
    }
    if (typeof raw === 'number') {
      if (Number.isFinite(raw)) normalized[key] = raw
      continue
    }
    if (Array.isArray(raw)) {
      const tags: string[] = []
      for (const entry of raw) {
        if (typeof entry !== 'string') {
          // Kept, so validation reports `wrongType` rather than silently
          // dropping something the caller believes it sent.
          normalized[key] = raw as TastingAttributeValue
          break
        }
        const trimmed = entry.trim()
        if (trimmed && !tags.includes(trimmed)) tags.push(trimmed)
      }
      if (normalized[key] === undefined && tags.length > 0) {
        normalized[key] = tags
      }
      continue
    }
    normalized[key] = raw as TastingAttributeValue
  }
  return normalized
}

/**
 * Check an already-normalized attribute bag against a Kind's spec.
 *
 * Returns every problem rather than the first, so a form can mark all of its
 * bad fields at once. An empty array is a valid bag; a field the spec declares
 * and the bag omits is fine, because every attribute is optional — the score
 * is the only thing a Tasting must have.
 */
export function validateTastingAttributes(
  kind: TastingKind,
  scope: TastingFieldScope,
  attributes: Readonly<Record<string, unknown>>,
): TastingAttributeError[] {
  const fields = new Map(
    tastingFields(kind, scope).map((field) => [field.key, field]),
  )
  const errors: TastingAttributeError[] = []

  for (const [key, value] of Object.entries(attributes)) {
    const field = fields.get(key)
    if (!field) {
      errors.push({ field: key, problem: 'unknownField' })
      continue
    }
    const problem = fieldProblem(field, value)
    if (problem) errors.push({ field: key, problem })
  }

  return errors
}

function fieldProblem(
  field: TastingFieldDef,
  value: unknown,
): TastingAttributeProblem | null {
  switch (field.type) {
    case 'text':
      if (typeof value !== 'string') return 'wrongType'
      return value.length > TEXT_MAX_LENGTH ? 'tooLong' : null

    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 'wrongType'
      }
      if (field.min !== undefined && value < field.min) return 'outOfRange'
      if (field.max !== undefined && value > field.max) return 'outOfRange'
      return null
    }

    case 'scale': {
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        return 'wrongType'
      }
      // Whole steps only — see the note at the top of the file.
      return value < 1 || value > 5 ? 'outOfRange' : null
    }

    case 'select': {
      if (typeof value !== 'string') return 'wrongType'
      const terms = field.vocabulary
        ? TASTING_VOCABULARIES[field.vocabulary]
        : []
      return (terms as readonly string[]).includes(value)
        ? null
        : 'notInVocabulary'
    }

    case 'tags': {
      if (!Array.isArray(value)) return 'wrongType'
      if (value.some((entry) => typeof entry !== 'string')) return 'wrongType'
      if (value.length > TAG_MAX_COUNT) return 'tooMany'
      // Deliberately not checked against the vocabulary: a shipped term is a
      // prompt, and "peaty" belongs in a wine's aromas even though nobody put
      // it in the list (story 11).
      return value.some((entry: string) => entry.length > TAG_MAX_LENGTH)
        ? 'tooLong'
        : null
    }
  }
}

/**
 * The one-line summary of a subject's facts a list row shows —
 * "Cow · France · Hard", "Tripel · 9.5%".
 *
 * Built from the spec's `select` and `tags` fields first, in declaration
 * order: those are the ones with a short shared word for them. A Kind that
 * answers fewer than `FACTS_LINE_PARTS` that way tops the line up with its
 * numbers — which is what puts an ABV on a beer, whose only select is its
 * style, and keeps an age off a cheese, which already has three.
 *
 * A rule rather than a per-Kind list, so a fourth Kind gets a sensible row
 * without anybody choosing its fields; and a cap rather than everything,
 * because the row has to stay one line on a phone. A producer's name and the
 * rest belong on the subject's own page.
 *
 * Takes the resolved words rather than the message tree, for the reason every
 * pure helper in this package does (ADR-0011).
 */
export const FACTS_LINE_PARTS = 3

export function tastingFactsLine(
  kind: TastingKind,
  attributes: Readonly<Record<string, unknown>>,
  term: (vocabulary: TastingVocabularyId, key: string) => string,
  unit: (unit: TastingUnit) => string = () => '',
): string {
  const parts: string[] = []
  const numbers: string[] = []

  for (const field of tastingFields(kind, 'subject')) {
    const value = attributes[field.key]
    if (value === undefined) continue

    if (field.type === 'select' && typeof value === 'string') {
      parts.push(field.vocabulary ? term(field.vocabulary, value) : value)
    }
    if (field.type === 'tags' && Array.isArray(value) && value.length > 0) {
      const first = value[0]
      if (typeof first === 'string') {
        parts.push(field.vocabulary ? term(field.vocabulary, first) : first)
      }
    }
    if (field.type === 'number' && typeof value === 'number') {
      const suffix = field.unit ? unit(field.unit) : ''
      numbers.push(
        suffix
          ? `${value}${suffix === '%' ? '' : ' '}${suffix}`
          : String(value),
      )
    }
  }

  while (parts.length < FACTS_LINE_PARTS && numbers.length > 0) {
    parts.push(numbers.shift() as string)
  }
  if (parts.length > 0) return parts.slice(0, FACTS_LINE_PARTS).join(' · ')

  // Nothing categorical and nothing measured: fall back to a text fact rather
  // than leaving the row blank where the subject plainly has one.
  for (const field of tastingFields(kind, 'subject')) {
    const value = attributes[field.key]
    if (field.type === 'text' && typeof value === 'string' && value) {
      return value
    }
  }
  return ''
}
