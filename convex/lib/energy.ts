/**
 * Energy's validators (APP-491 data model, `designs/energy/APP-491-data-model.md`).
 *
 * One literal union per field the model names, so the schema and the
 * functions that write it share them. A new provider is a new literal here.
 */
import { v } from 'convex/values'

export const energyContractKindValidator = v.union(
  v.literal('dynamic'),
  v.literal('fixed'),
)

/** Only for a `fixed` contract: euros per kWh (and per m³ for gas), excl. VAT. */
export const energyFixedTariffsValidator = v.object({
  t1: v.number(),
  t2: v.number(),
  export: v.number(),
  gas: v.number(),
})

export const energySourceKindValidator = v.union(
  v.literal('manual'),
  v.literal('homeAssistant'),
  v.literal('enelogic'),
  v.literal('homeWizard'),
)

/** An explicit state, never inferred from a stale cache (ADR-0020). */
export const energySourceStatusValidator = v.union(
  v.literal('ok'),
  v.literal('syncing'),
  v.literal('error'),
  v.literal('needsReconnect'),
)

export const energyChannelKindValidator = v.union(
  v.literal('gridImport'),
  v.literal('gridExport'),
  v.literal('solar'),
  v.literal('batteryCharge'),
  v.literal('batteryDischarge'),
  v.literal('batterySoc'),
  v.literal('gas'),
)

export const energyTariffValidator = v.union(v.literal('t1'), v.literal('t2'))

export const energyUnitValidator = v.union(
  v.literal('kWh'),
  v.literal('m3'),
  v.literal('percent'),
)

export const energyAssetKindValidator = v.union(
  v.literal('solar'),
  v.literal('battery'),
)

export const energyPriceProviderValidator = v.union(
  v.literal('energyzero'),
  v.literal('entsoe'),
  v.literal('tibber'),
)

export const energyPriceScopeValidator = v.union(
  v.literal('market'),
  v.literal('account'),
)

export const energyPriceFeedStatusValidator = v.union(
  v.literal('ok'),
  v.literal('error'),
  v.literal('needsKey'),
)

export const energyCarrierValidator = v.union(
  v.literal('electricity'),
  v.literal('gas'),
)

/**
 * A contract's terms as a Member types them (APP-494): every field of an
 * `energyContracts` row except its owner and site.
 */
export const energyContractTermsValidator = v.object({
  validFrom: v.string(), // YYYY-MM-DD
  kind: energyContractKindValidator,
  supplierName: v.optional(v.string()),
  importMarkupEurPerKwh: v.number(),
  exportFeeEurPerKwh: v.number(),
  energyTaxEurPerKwh: v.number(),
  gasMarkupEurPerM3: v.optional(v.number()),
  gasTaxEurPerM3: v.optional(v.number()),
  fixedTariffs: v.optional(energyFixedTariffsValidator),
  vatPercent: v.number(),
  monthlyFixedCents: v.number(),
  yearlyTaxCreditCents: v.optional(v.number()),
  netMetering: v.boolean(),
})
