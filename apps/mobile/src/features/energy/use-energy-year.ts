/**
 * A year of months next to the year before (Usage › Year, Costs' month
 * chart): 24 `energyUsage.month` answers, one per month, because no query
 * reads a year of hours (`convex/energyUsage.ts`). The request object only
 * changes with the Group, the year or the day, so `useQueries` keeps the
 * subscriptions open.
 */
import {
  energyMonthCost,
  energyMonthOf,
  energyYearMonths,
} from '@gather/core/energy'
import { useMemo } from 'react'

import { api } from '../../convex/api'
import { useQueries } from '../../convex/queries'

type MonthAnswer = {
  totals: {
    consumptionKwh: number
    daysWithData: number
    costStatus: 'ok' | 'noData' | 'noContract' | 'noPrices'
    cost: { totalCents: number } | null
    costWithoutNet: { totalCents: number } | null
  }
} | null

export interface EnergyYearSeries {
  /** Each month's kWh; null for a month without usage. */
  kwh: { previous: (number | null)[]; current: (number | null)[] }
  /**
   * Each month's cents, with net metering where the month had it; a month
   * without priced usage counts its fixed costs.
   */
  cents: { previous: (number | null)[]; current: (number | null)[] }
  /** The same, always without net metering. */
  centsWithoutNet: { previous: (number | null)[]; current: (number | null)[] }
  /** The running month's index this year, or null for a year that is over. */
  runningIndex: number | null
  loading: boolean
}

export function useEnergyYear(
  groupSlug: string,
  year: number,
  today: string,
): EnergyYearSeries {
  const months = useMemo(
    () => [...energyYearMonths(year - 1), ...energyYearMonths(year)],
    [year],
  )
  const requests = useMemo(
    () =>
      Object.fromEntries(
        months.map((month) => [
          month,
          { query: api.energyUsage.month, args: { groupSlug, month, today } },
        ]),
      ),
    [months, groupSlug, today],
  )
  const answers = useQueries(requests) as Record<
    string,
    MonthAnswer | undefined | Error
  >

  return useMemo(() => {
    const read = (
      list: readonly string[],
      pick: (totals: NonNullable<MonthAnswer>['totals']) => number | null,
    ) =>
      list.map((month) => {
        const answer = answers[month]
        if (!answer || answer instanceof Error) return null
        return pick(answer.totals)
      })
    const previous = energyYearMonths(year - 1)
    const current = energyYearMonths(year)
    const series = (
      pick: (totals: NonNullable<MonthAnswer>['totals']) => number | null,
    ) => ({ previous: read(previous, pick), current: read(current, pick) })
    const thisMonth = energyMonthOf(today)
    const running = current.indexOf(thisMonth)
    return {
      kwh: series((totals) =>
        totals.daysWithData === 0 ? null : totals.consumptionKwh,
      ),
      // A month with only fixed costs gets its bar too (APP-741).
      cents: series(
        (totals) =>
          energyMonthCost({ costStatus: totals.costStatus, cost: totals.cost })
            ?.cents ?? null,
      ),
      centsWithoutNet: series(
        (totals) =>
          energyMonthCost({
            costStatus: totals.costStatus,
            cost: totals.costWithoutNet,
          })?.cents ?? null,
      ),
      runningIndex: running >= 0 ? running : null,
      loading: months.some((month) => answers[month] === undefined),
    }
  }, [answers, months, year, today])
}
