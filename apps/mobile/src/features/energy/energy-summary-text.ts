/**
 * Sentences more than one Energy screen says: a contract in one line, and
 * why a month has no costs. Pure; the words come from `@gather/core`.
 */
import { capitalise, formatEnergyDate } from '@gather/core/energy-present'
import { fmt } from '@gather/core/i18n'
import type { Messages } from '@gather/core/messages'

type EnergyWords = Messages['energy']

/** "Zonneplan, dynamic · since 1 January 2026". */
export function contractSummary(
  contract: { kind: 'dynamic' | 'fixed'; supplierName?: string; validFrom: string },
  words: EnergyWords,
  locale: string,
): string {
  const kind = words.contract[contract.kind].toLocaleLowerCase(locale)
  const date = formatEnergyDate(contract.validFrom, locale, 'dayMonthYear')
  return contract.supplierName
    ? fmt(words.contract.summary, {
        supplier: contract.supplierName,
        kind,
        date,
      })
    : fmt(words.contract.summaryNoSupplier, { kind: capitalise(kind), date })
}

/** Why a month shows no costs, in words: never a made-up figure. */
export function costStatusSentence(
  status: 'noData' | 'noContract' | 'noPrices',
  month: string,
  words: EnergyWords,
  locale: string,
): string {
  const name = formatEnergyDate(month, locale, 'month')
  if (status === 'noContract') return words.costs.noContract
  if (status === 'noPrices') return fmt(words.costs.noPrices, { month: name })
  return fmt(words.costs.noData, { month: name })
}
