/**
 * The picture on a recipe, or the recipe glyph where there is none.
 *
 * Always occupies the same square, picture or no picture: a row that collapses
 * to the left when a recipe has no image makes a list harder to read than one
 * with no images at all. Every caller puts the tile beside the recipe's name,
 * making it decoration rather than a second label for assistive technology.
 */
export function RecipeThumbnail({
  src,
  className = 'h-11 w-11 shrink-0',
  glyphClassName = 'text-sm',
}: {
  src?: string | null
  /** The tile's outer layout and dimensions. */
  className?: string
  /** Lets a large tile give its glyph proportionate space. */
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
      ) : (
        <span aria-hidden="true" className={`${glyphClassName} opacity-40`}>
          🍲
        </span>
      )}
    </span>
  )
}
