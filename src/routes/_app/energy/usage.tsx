import { createFileRoute } from '@tanstack/react-router'
import {
  EnergyUsagePage,
  type EnergyUsageRange,
} from '../../../components/energy/EnergyUsagePage'

/** `?range=year` opens Usage on the year, as the costs page links to it. */
export const Route = createFileRoute('/_app/energy/usage')({
  component: UsageRoute,
  validateSearch: (
    search: Record<string, unknown>,
  ): { range?: EnergyUsageRange } =>
    search.range === 'day' || search.range === 'month' || search.range === 'year'
      ? { range: search.range }
      : {},
})

function UsageRoute() {
  const { range } = Route.useSearch()
  return <EnergyUsagePage initialRange={range} />
}
