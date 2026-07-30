import { createFileRoute } from '@tanstack/react-router'
import {
  NutritionPage,
  validateNutritionSearch,
} from '../../../components/nutrition/NutritionPage'
import { flatNutritionNav } from '../../../components/nutrition/nutritionNav'

export const Route = createFileRoute('/_app/nutrition/')({
  component: NutritionDay,
  validateSearch: validateNutritionSearch,
})

function NutritionDay() {
  const { date } = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <NutritionPage
      date={date}
      onDateChange={(next) => navigate({ search: { date: next } })}
      nav={flatNutritionNav}
    />
  )
}
