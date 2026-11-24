import { isIsoDate } from '@gather/core/civil-date'
import { isEnergyMonth } from '@gather/core/energy'
import { useLocalSearchParams } from 'expo-router'

import {
  type EnergyUsageRange,
  EnergyUsageScreen,
  type EnergyUsageUnit,
} from '../../../../../src/features/energy/energy-usage-screen'

/**
 * `?range=day|month|year`, `?unit=kwh|euro`, `?day=YYYY-MM-DD`, `?month=YYYY-MM`
 * and `?year=YYYY` open Usage on that view (Home's month card opens the month,
 * and Costs links to the year in euro with its month); anything else is ignored.
 */
export default function EnergyUsage() {
  const { range, unit, day, month, year } = useLocalSearchParams<{
    range?: string
    unit?: string
    day?: string
    month?: string
    year?: string
  }>()
  return (
    <EnergyUsageScreen
      // A link that reaches a Usage screen already open starts it on its period.
      key={[range, unit, day, month, year].join('|')}
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
      initialDay={day && isIsoDate(day) ? day : undefined}
      initialMonth={month && isEnergyMonth(month) ? month : undefined}
      initialYear={year && /^\d{4}$/.test(year) ? Number(year) : undefined}
    />
  )
}
