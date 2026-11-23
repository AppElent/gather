import { useLocalSearchParams } from 'expo-router'

import {
  type EnergyUsageRange,
  EnergyUsageScreen,
  type EnergyUsageUnit,
} from '../../../../../src/features/energy/energy-usage-screen'

/**
 * `?range=day|month|year`, `?unit=kwh|euro` and `?year=YYYY` open Usage on
 * that view (the costs screen links to the year in euro); anything else is
 * ignored.
 */
export default function EnergyUsage() {
  const { range, unit, year } = useLocalSearchParams<{
    range?: string
    unit?: string
    year?: string
  }>()
  return (
    <EnergyUsageScreen
      initialRange={
        range === 'day' || range === 'month' || range === 'year'
          ? (range satisfies EnergyUsageRange)
          : undefined
      }
      initialUnit={
        unit === 'kwh' || unit === 'euro'
          ? (unit satisfies EnergyUsageUnit)
          : undefined
      }
      initialYear={year && /^\d{4}$/.test(year) ? Number(year) : undefined}
    />
  )
}
