/**
 * Every day since an asset could first have paid itself back: this month from
 * the screen's own `energySolar.month`, each month before it from one
 * `energySolar.paybackMonth`, because no query reads a year of hours. Those
 * read no assets, so editing one leaves the past months be (APP-962). `null`
 * while a month is still loading.
 */
import {
  type EnergyPaybackDay,
  energyMonthOf,
  energyMonthToday,
  energyPaybackDayOf,
  energyPaybackMonths,
} from '@gather/core/energy'
import type { FunctionReturnType } from 'convex/server'
import { useMemo } from 'react'

import { api } from '../../convex/api'
import { useQueries } from '../../convex/queries'

export type EnergySolarMonth = NonNullable<
  FunctionReturnType<typeof api.energySolar.month>
>

/** `solar` is this month's answer, up to `today`. */
export function useEnergyPaybackDays(
  groupSlug: string,
  solar: EnergySolarMonth,
  today: string,
): { days: EnergyPaybackDay[]; partial: boolean } | null {
  const all = energyPaybackMonths(
    solar.assets.map((each) => each.asset),
    solar.firstDay,
    today,
  )
  const thisMonth = all.includes(energyMonthOf(today))
  const months = all.filter((month) => month !== energyMonthOf(today)).join(',')
  const requests = useMemo(
    () =>
      Object.fromEntries(
        (months ? months.split(',') : []).map((month) => [
          month,
          {
            query: api.energySolar.paybackMonth,
            args: { groupSlug, month, today: energyMonthToday(month, today) },
          },
        ]),
      ),
    [groupSlug, months, today],
  )
  const answers = Object.values(useQueries(requests)) as (
    | EnergyPaybackDay[]
    | null
    | undefined
    | Error
  )[]
  if (answers.some((answer) => answer === undefined)) return null
  return {
    days: [
      ...answers.flatMap((answer) =>
        answer instanceof Error || !answer ? [] : answer,
      ),
      ...(thisMonth ? solar.days.map(energyPaybackDayOf) : []),
    ],
    partial: answers.some((answer) => answer instanceof Error || answer === null),
  }
}
