import { createFileRoute } from '@tanstack/react-router'
import {
  NutritionPage,
  validateNutritionSearch,
} from '../../../../../components/nutrition/NutritionPage'

/**
 * Nutrition inside a Group. It renders the very same component as the flat
 * `/nutrition` route, because a food diary is Personal: the Group segment picks
 * the navigation context and nothing else, so the page must look identical in
 * every Group (ADR-0002).
 */
export const Route = createFileRoute('/_app/g/$groupSlug/nutrition/')({
  component: GroupNutritionDay,
  validateSearch: validateNutritionSearch,
})

function GroupNutritionDay() {
  const { date } = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <NutritionPage
      date={date}
      onDateChange={(next) => navigate({ search: { date: next } })}
    />
  )
}
