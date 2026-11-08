import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { JustLoggedProvider } from '../../components/nutrition/JustLogged'
import {
  NutritionPage,
  validateNutritionSearch,
} from '../../components/nutrition/NutritionPage'

/**
 * Nutrition — the diary itself, and whatever is open on top of it.
 *
 * The diary is the layout rather than the index route because adding food is
 * its own address (`/nutrition/add`) presented as a sheet over the day you were
 * looking at. Rendering the diary here keeps it mounted while the sheet is
 * open, so closing the sheet is a navigation back to a page that never went
 * away — and the phone's back gesture does exactly that.
 */
export const Route = createFileRoute('/_app/nutrition')({
  component: Nutrition,
  validateSearch: validateNutritionSearch,
})

function Nutrition() {
  const { date } = Route.useSearch()
  const navigate = useNavigate()

  return (
    <JustLoggedProvider>
      <NutritionPage
        date={date}
        onDateChange={(next) =>
          navigate({ to: '.', search: (prev) => ({ ...prev, date: next }) })
        }
      />
      <Outlet />
    </JustLoggedProvider>
  )
}
