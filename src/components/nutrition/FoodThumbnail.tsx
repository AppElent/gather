/**
 * The picture on a row of the add sheet.
 *
 * Always occupies the same square, picture or no picture: a row that collapses
 * to the left when a food has no image makes a list of results harder to read
 * than one with no images at all.
 *
 * The source is a URL either way, but not from the same place. A food of your
 * own has its picture stored with it and this is a Convex storage URL; a live
 * Open Food Facts result has nothing stored, so it renders theirs directly and
 * the row stops existing when the search does (#69).
 */
export function FoodThumbnail({
  src,
  alt,
}: {
  src?: string | null
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
      ) : (
        <span aria-hidden="true" className="text-sm opacity-40">
          🍽
        </span>
      )}
    </span>
  )
}
