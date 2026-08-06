/**
 * The one string a food is searched by.
 *
 * A Convex search index has exactly one full-text field and its filter fields
 * are equality-only, so "match either the name or the brand" cannot be
 * expressed as a query — it has to be expressed as data. This is that data:
 * denormalised on every write that can change a name or a brand, which is why
 * it is a function rather than a line repeated in four mutations.
 *
 * Nothing is normalised here beyond joining and trimming. The search index does
 * its own tokenising, lower-casing and stemming, and a second normalisation on
 * the way in would only make the stored value diverge from what a reader sees.
 */
export function foodSearchText(food: {
  name: string
  brand?: string
}): string {
  return [food.name, food.brand]
    .map((part) => part?.trim())
    .filter((part): part is string => !!part)
    .join(' ')
}
