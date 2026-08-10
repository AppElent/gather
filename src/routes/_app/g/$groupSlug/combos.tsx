import { createFileRoute } from '@tanstack/react-router'
import { CombosPage } from '../../../../components/nutrition/CombosPage'
import { groupNutritionNav } from '../../../../components/nutrition/nutritionNav'

/**
 * The Combos library inside a Group.
 *
 * A Combo is Personal (ADR-0012) — it belongs to a person and to no Group — so
 * this shows the same combos whichever Group is in the URL, exactly as the
 * diary next to it does. The segment is here for the same reason Nutrition's
 * is: it governs navigation, not ownership (ADR-0002), and it is what keeps
 * whoever follows a link inside the Group they were reading.
 *
 * A sibling of `/nutrition` rather than a page beneath it: that route is a
 * layout rendering the diary itself, so the add sheet can sit over a page that
 * never went away, and a library nested under it would open below the whole
 * day.
 */
export const Route = createFileRoute('/_app/g/$groupSlug/combos')({
  component: GroupCombos,
})

function GroupCombos() {
  const { groupSlug } = Route.useParams()

  return <CombosPage nav={groupNutritionNav(groupSlug)} />
}
