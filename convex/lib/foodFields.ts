import { v } from 'convex/values'
import { nutritionSourceValidator, nutritionValidator } from './nutrition'
import { servingValidator } from './servings'

const baseUnitValidator = v.union(v.literal('g'), v.literal('ml'))

/** What a food says it is, in the table and on every write that names it. */
export const foodFields = {
  name: v.string(),
  brand: v.optional(v.string()),
  baseUnit: baseUnitValidator,
  nutritionPer100: nutritionValidator,
  // What somebody calls a portion of this food, in order — "1 slice",
  // "1 glass" — each an amount in `baseUnit`. Optional because most foods
  // have none: an empty list is answered by the person's own logged amounts
  // rather than by inventing a portion for them.
  servings: v.optional(v.array(servingValidator)),
}

/**
 * The fields a *person* saves, which is `foodFields` plus the emoji they
 * picked (#94).
 *
 * Separate from `foodFields` because of the one write that is not a person
 * saying what this food is: `applyOffRefresh` replaces a row wholesale with
 * Open Food Facts' answer, and Open Food Facts has no emoji. A refresh
 * therefore leaves the icon you chose exactly where it was, rather than
 * clearing it on your behalf.
 *
 * Absent means none. It is never stored as an empty string — a set-but-empty
 * icon would sit in front of the generic glyph in the tile's fallback chain
 * and render nothing at all.
 *
 * Three states, not two, which is why `null` is in the type. Convex drops an
 * argument whose value is `undefined` before it reaches the server, so an
 * optional string can only say "a person chose this one" or nothing at all —
 * and "nothing at all" would have to mean both *leave what is there* and
 * *take it off*. `null` is the clear, because it survives the wire; omitting
 * the field leaves the icon alone, which is what any caller that does not
 * know about icons should do.
 */
export const savedFoodFields = {
  ...foodFields,
  icon: v.optional(v.union(v.string(), v.null())),
}

/**
 * A reviewed Open Food Facts result, whichever door it comes through. Every
 * field of the review reaches the row through these, so one missing here would
 * be dropped at the save without anything saying so.
 */
export const offImportFields = {
  ...savedFoodFields,
  barcode: v.string(),
  // A direct import uses `imported`; a person who checked first and corrected
  // the figures sends `manual` instead, and the food says the true thing about
  // the numbers it actually carries (#112).
  nutritionSource: v.optional(nutritionSourceValidator),
}
