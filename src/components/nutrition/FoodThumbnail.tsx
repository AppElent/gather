/**
 * The picture on a food, recipe, or Combo tile.
 *
 * Always occupies the same square, picture or no picture: a row that collapses
 * to the left when a food has no image makes a list of results harder to read
 * than one with no images at all. The same tile is used outside the add sheet
 * too, so every surface has the same fallback chain. Every caller puts the
 * tile beside the content's name, making it decoration rather than a second
 * label for assistive technology.
 *
 * Three tiers, in this order — **photograph, then chosen icon, then the generic
 * glyph** (#94, superseding the photo-or-glyph fallback #69 shipped as
 * provisional). Each is a weaker answer to the same question than the one
 * before it: a photograph is this product, an emoji is what somebody said this
 * is, and the glyph is only "this is food". A food with a photograph *and* an
 * icon shows the photograph; the icon does not go anywhere, it just is not
 * needed while there is something better.
 *
 * The picture's source is a URL either way, but not from the same place. A food
 * of your own has its picture stored with it and this is a Convex storage URL;
 * a live Open Food Facts result has nothing stored, so it renders theirs
 * directly and the row stops existing when the search does (#69).
 */
export type ThumbnailKind = 'food' | 'recipe' | 'combo'

const GENERIC_GLYPHS: Record<ThumbnailKind, string> = {
  food: '🍽',
  recipe: '🍲',
  combo: '🍱',
}

export function FoodThumbnail({
  src,
  icon,
  kind = 'food',
  className = 'h-11 w-11 shrink-0',
  glyphClassName = 'text-sm',
}: {
  src?: string | null
  /** The emoji this food carries, if somebody picked one. */
  icon?: string
  /** Recipes and Combos have no chosen icon, only their type glyph. */
  kind?: ThumbnailKind
  /** The tile's outer layout and dimensions. */
  className?: string
  /** Lets a large tile give its generic glyph proportionate space. */
  glyphClassName?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex items-center justify-center overflow-hidden rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-bg)] ${className}`}
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : icon ? (
        // Full opacity, unlike the glyph below it: this one was chosen, and
        // dimming somebody's answer the way a placeholder is dimmed would say
        // the wrong thing about it.
        <span aria-hidden="true" className="text-xl">
          {icon}
        </span>
      ) : (
        <span aria-hidden="true" className={`${glyphClassName} opacity-40`}>
          {GENERIC_GLYPHS[kind]}
        </span>
      )}
    </span>
  )
}
