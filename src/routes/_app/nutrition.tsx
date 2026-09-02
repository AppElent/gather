import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { useRequiredCurrentGroup } from '#/components/app/useCurrentGroup'
import { JustLoggedProvider } from '../../components/nutrition/JustLogged'
import {
  NutritionPage,
  validateNutritionSearch,
} from '../../components/nutrition/NutritionPage'
import { groupNutritionNav } from '../../components/nutrition/nutritionNav'

/**
 * Nutrition inside a Group — the diary itself, and whatever is open on top of
 * it.
 *
 * The diary is the layout rather than the index route because adding food is
 * its own address (`/nutrition/add`) presented as a sheet over the day you were
 * looking at. Rendering the diary here keeps it mounted while the sheet is
 * open, so closing the sheet is a navigation back to a page that never went
 * away — and the phone's back gesture does exactly that.
 *
 * A food diary is Personal (ADR-0003), so the Group segment picks the
 * navigation context and nothing else: the page is identical in every Group.
 * (There is no flat `/nutrition` route — ADR-0002 removed the flat tree, and
 * `src/lib/legacyPaths.ts` is what still answers for old links.)
 */
export const Route = createFileRoute('/_app/nutrition')({
  component: GroupNutrition,
  validateSearch: validateNutritionSearch,
})

function GroupNutrition() {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const { date } = Route.useSearch()
  const navigate = useNavigate()

  return (
    <JustLoggedProvider>
      <NutritionPage
        date={date}
        onDateChange={(next) =>
          navigate({ to: '.', search: (prev) => ({ ...prev, date: next }) })
        }
        nav={groupNutritionNav(groupSlug)}
      />
      <Outlet />
    </JustLoggedProvider>
  )
}
