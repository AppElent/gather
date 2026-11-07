import { useMessages } from '../../lib/i18n'
import type { RecipeDestination } from './recipeDestination'

/**
 * Where this recipe is about to land, said before it lands there.
 *
 * Both actions on the new-recipe page commit to a Group — the import fetches
 * *for* one and the save writes *into* one — so this sits next to each of them
 * rather than once at the top where it would scroll away.
 */
export function RecipeDestinationNotice({
  destination,
}: {
  destination: RecipeDestination
}) {
  const notice = useMessages().recipes.destination

  return (
    <p className="m-0 text-xs text-[var(--app-muted)]">
      {notice.prefix}{' '}
      <span className="font-semibold text-[var(--app-fg)]">
        {destination.groupName}
      </span>
      {notice.suffix}
    </p>
  )
}
