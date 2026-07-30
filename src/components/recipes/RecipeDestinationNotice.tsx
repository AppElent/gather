import type { RecipeDestination } from './recipeDestination'

/**
 * Where this recipe is about to land, said before it lands there.
 *
 * Both actions on the new-recipe page commit to a Group — the import fetches
 * *for* one and the save writes *into* one — so this sits next to each of them
 * rather than once at the top where it would scroll away. It is the same
 * component in both places and on both routes; only the Group differs, and the
 * one that was chosen rather than asked for says so.
 */
export function RecipeDestinationNotice({
  destination,
}: {
  destination: RecipeDestination
}) {
  return (
    <p className="m-0 text-xs text-[var(--app-muted)]">
      Adding to{' '}
      <span className="font-semibold text-[var(--app-fg)]">
        {destination.groupName}
      </span>
      {destination.fallback
        ? ' — your personal group, because this page is not inside one.'
        : '.'}
    </p>
  )
}
