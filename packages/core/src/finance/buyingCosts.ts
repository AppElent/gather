/**
 * What buying a house in the Netherlands costs beyond the price of it.
 *
 * Netherlands-specific by design (ADR-0025), and every fee is a figure the
 * Member entered: Gather knows no notary's tariff and no lender's advice fee.
 * The one thing it does know is the shape of the sum — transfer tax on the
 * price, the fees on top, and the part of the price the mortgage does not
 * cover — because that shape is what people get wrong.
 *
 * It says what a purchase needs in cash. It does not assess what a household
 * can afford, and the copy on the screen says so.
 */

import { type Cents, monthlyRate, roundCents } from './money'
import { annuityPayment } from './mortgage'

/**
 * The transfer-tax rates a Dutch buyer picks between. Rates change by act of
 * parliament, so the percentage is stored on the record rather than derived
 * from the band — the band is what the Member chose, the percent is what
 * applied when they chose it.
 */
export const TRANSFER_TAX_BANDS = ['starter', 'ownHome', 'other'] as const
export type TransferTaxBand = (typeof TRANSFER_TAX_BANDS)[number]

/** The cost lines the form asks about, in the order the screen shows them. */
export const BUYING_COST_LINES = [
  'notary',
  'valuation',
  'mortgageAdvice',
  'structuralSurvey',
  'buyingAgent',
] as const
export type BuyingCostLine = (typeof BUYING_COST_LINES)[number]

export interface HomeBuyingCosts {
  purchasePriceCents: Cents
  /** What the household is putting in themselves. */
  ownMoneyCents: Cents
  mortgageCents: Cents
  mortgageRatePercent: number
  mortgageTermMonths: number
  transferTaxBand: TransferTaxBand
  /** As applied on the day the Member entered it — `2` means 2 %. */
  transferTaxPercent: number
  /** Absent lines are simply not charged. */
  lines?: Partial<Record<BuyingCostLine, Cents>>
  /** NHG, as a percent of the mortgage. Absent means the household is not using it. */
  nhgPercent?: number
}

export interface BuyingCostsResult {
  transferTaxCents: Cents
  nhgCents: Cents
  /** Every fee line plus the tax and NHG. */
  feesCents: Cents
  /** The part of the price the mortgage does not cover. */
  shortfallOnPriceCents: Cents
  /** Everything the household has to bring: fees plus that shortfall. */
  cashNeededCents: Cents
  /** Cash needed minus own money. Positive means short. */
  shortCents: Cents
  /** An annuity payment on the mortgage, for comparison between homes. */
  estimatedMonthlyCents: Cents
}

export function homeBuyingCosts(input: HomeBuyingCosts): BuyingCostsResult {
  const transferTax = roundCents(
    (input.purchasePriceCents * input.transferTaxPercent) / 100,
  )
  const nhg = input.nhgPercent
    ? roundCents((input.mortgageCents * input.nhgPercent) / 100)
    : 0
  const lineTotal = Object.values(input.lines ?? {}).reduce<number>(
    (sum, amount) => sum + (amount ?? 0),
    0,
  )
  const fees = transferTax + nhg + lineTotal
  const shortfallOnPrice = Math.max(
    0,
    input.purchasePriceCents - input.mortgageCents,
  )
  const cashNeeded = fees + shortfallOnPrice

  return {
    transferTaxCents: transferTax,
    nhgCents: nhg,
    feesCents: fees,
    shortfallOnPriceCents: shortfallOnPrice,
    cashNeededCents: cashNeeded,
    shortCents: cashNeeded - input.ownMoneyCents,
    estimatedMonthlyCents: annuityPayment(
      input.mortgageCents,
      monthlyRate(input.mortgageRatePercent),
      input.mortgageTermMonths,
    ),
  }
}
