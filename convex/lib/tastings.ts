/**
 * The database's side of the Kind spec (ADR-0024, #199).
 *
 * The spec itself lives in `@gather/core/tastings`, because the phone and the
 * web both render and both validate against it (ADR-0016). What lives here is
 * the two things a Convex schema needs that a portable module cannot give it:
 * validators, and the one function that turns a spec violation into a refusal.
 *
 * **`attributes` is a `v.record`, not a per-Kind object.** One table pair holds
 * three Kinds, and a schema that enumerated wine's fields would have to be
 * edited for the fourth Kind the spec exists to make free. The shape is
 * therefore checked by `assertValidAttributes` on every write rather than by
 * the schema on every read — which is also the only place that *can* check it,
 * since "is `tannin` a field?" depends on the Kind and the scope.
 */

import {
  isTastingKind,
  normalizeTastingAttributes,
  TASTING_KINDS,
  type TastingAttributeValue,
  type TastingFieldScope,
  type TastingKind,
  validateTastingAttributes,
} from '@gather/core/tastings'
import { ConvexError, v } from 'convex/values'

/** `'cheese' | 'wine' | 'beer'`, derived from the spec rather than retyped. */
export const tastingKindValidator = v.union(
  ...TASTING_KINDS.map((kind) => v.literal(kind)),
)

/**
 * What one attribute holds: a word, a figure, or several words.
 *
 * The three shapes the five field types produce — `select` and `text` are
 * strings, `number` and `scale` are numbers, `tags` is an array of strings.
 */
export const tastingAttributeValidator = v.union(
  v.string(),
  v.number(),
  v.array(v.string()),
)

export const tastingAttributesValidator = v.record(
  v.string(),
  tastingAttributeValidator,
)

export function assertTastingKind(value: string): TastingKind {
  if (!isTastingKind(value)) throw new ConvexError('Unknown tasting kind')
  return value
}

/**
 * Normalize an attribute bag and refuse it if it does not match the Kind.
 *
 * Returns what should be stored. The refusal is a **key**, not a sentence — the
 * form resolves it into the reader's language (ADR-0011) — and it names the
 * field so a client can point at the control that is wrong. Only the first
 * problem is reported: a payload with two bad fields did not come from the
 * form, which validates before it sends, so this is a door and not a linter.
 */
export function checkedAttributes(
  kind: TastingKind,
  scope: TastingFieldScope,
  attributes: Record<string, unknown> | undefined,
): Record<string, TastingAttributeValue> {
  const normalized = normalizeTastingAttributes(attributes ?? {})
  const [problem] = validateTastingAttributes(kind, scope, normalized)
  if (problem) {
    throw new ConvexError({
      kind: 'tastingAttribute',
      field: problem.field,
      problem: problem.problem,
    })
  }
  return normalized
}
