import { moduleById } from '@gather/core/modules'
import { ModuleTile, type TileSize } from '../app/ModuleTile'

/** The Recipes Module's glyph, from the shared catalogue. */
export const RECIPES_ICON = moduleById('recipes')?.icon ?? 'ChefHat'

/**
 * The picture on a recipe, or the Kitchen tile where there is none — never a
 * placeholder picture (web-shell_final.md, "Records without a photo").
 *
 * Always occupies the same box, picture or no picture: a row that collapses
 * to the left when a recipe has no image makes a list harder to read than one
 * with no images at all. Every caller puts it beside the recipe's name,
 * making it decoration rather than a second label for assistive technology.
 */
export function RecipeThumbnail({
  src,
  className = 'h-11 w-11 shrink-0',
  tileSize = 's',
}: {
  src?: string | null
  /** The box's outer layout and dimensions. */
  className?: string
  /** How large the tile is in a box with no picture. */
  tileSize?: TileSize
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex items-center justify-center overflow-hidden rounded-[var(--radius-thumb)] ${
        src ? '' : 'bg-[var(--surface-2)]'
      } ${className}`}
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <ModuleTile group="kitchen" icon={RECIPES_ICON} size={tileSize} />
      )}
    </span>
  )
}

/**
 * A recipe's rating as five stars, filled up to the rating, in `ink`. The
 * glyphs are hidden; a reader hears the number of stars instead.
 */
export function RecipeStars({
  rating,
  label,
}: {
  rating?: number
  /** "4 stars", already in the reader's language. */
  label?: string
}) {
  if (rating == null) return null
  return (
    <>
      <span
        aria-hidden="true"
        className="tracking-[1px] text-[var(--ink)]"
        data-stars={rating}
      >
        {'★'.repeat(rating)}
        {'☆'.repeat(Math.max(0, 5 - rating))}
      </span>
      {label ? <span className="sr-only">{label}</span> : null}
    </>
  )
}
