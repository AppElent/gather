/**
 * Every day since an asset could first have paid itself back, one
 * `energySolar.month` answer per month, because no query reads a year of
 * hours. `null` while a month is still loading.
 */
import {
  type EnergyPaybackDay,
  energyMonthToday,
  energyPaybackMonths,
} from '@gather/core/energy'
import type { FunctionReturnType } from 'convex/server'
import { useMemo } from 'react'

import { api } from '../../convex/api'
import { useQueries } from '../../convex/queries'

export type EnergySolarMonth = NonNullable<
  FunctionReturnType<typeof api.energySolar.month>
>

export function useEnergyPaybackDays(
  groupSlug: string,
  solar: EnergySolarMonth,
  today: string,
): { days: EnergyPaybackDay[]; partial: boolean } | null {
  const months = energyPaybackMonths(
    solar.assets.map((each) => each.asset),
    solar.firstDay,
    today,
  ).join(',')
  const requests = useMemo(
    () =>
      Object.fromEntries(
        (months ? months.split(',') : []).map((month) => [
          month,
          {
            query: api.energySolar.month,
            args: { groupSlug, month, today: energyMonthToday(month, today) },
          },
        ]),
      ),
    [groupSlug, months, today],
  )
  const answers = Object.values(useQueries(requests)) as (
    | EnergySolarMonth
    | null
    | undefined
    | Error
  )[]
  if (answers.some((answer) => answer === undefined)) return null
  return {
    days: answers.flatMap((answer) =>
      answer instanceof Error || !answer
        ? []
        : answer.days.map((day) => ({
            day: day.day,
            solarEur: day.solarEur,
            batteryEur: day.batteryEur,
            solarMeasured: day.selfUsedKwh !== null,
            batteryMeasured: day.battery !== null,
          })),
    ),
    partial: answers.some((answer) => answer instanceof Error || answer === null),
  }
}
