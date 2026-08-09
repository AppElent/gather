/**
 * The picture on a row of the add sheet.
 *
 * Always occupies the same square, picture or no picture: a row that collapses
 * to the left when a food has no image makes a list of results harder to read
 * than one with no images at all.
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
export function FoodThumbnail({
  src,
  icon,
  alt,
}: {
  src?: string | null
  /** The emoji this food carries, if somebody picked one. */
  icon?: string
  alt: string
}) {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-bg)]">
      {src ? (
        <img
          src={src}
          alt={alt}
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
        <span aria-hidden="true" className="text-sm opacity-40">
          🍽
        </span>
      )}
    </span>
  )
}
