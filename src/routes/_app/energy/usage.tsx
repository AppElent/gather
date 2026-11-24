import { createFileRoute } from '@tanstack/react-router'
import {
  EnergyUsagePage,
  type EnergyUsageRange,
} from '../../../components/energy/EnergyUsagePage'

/** `?range=year&year=2025` opens Usage on that year, as the costs page links to it. */
export const Route = createFileRoute('/_app/energy/usage')({
  component: UsageRoute,
  validateSearch: (
    search: Record<string, unknown>,
  ): { range?: EnergyUsageRange; year?: number } => {
    const range =
      search.range === 'day' ||
      search.range === 'month' ||
      search.range === 'year'
        ? search.range
        : undefined
    const year = Number(search.year)
    return {
      ...(range ? { range } : {}),
      ...(Number.isInteger(year) && year >= 2000 && year <= 2100
        ? { year }
        : {}),
    }
  },
})

function UsageRoute() {
  const { range, year } = Route.useSearch()
  return <EnergyUsagePage initialRange={range} initialYear={year} />
}
