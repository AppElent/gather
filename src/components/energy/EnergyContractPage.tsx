import { addDays } from '@gather/core/civil-date'
import { parseDecimal } from '@gather/core/decimal'
import {
  checkEnergyContract,
  ENERGY_NET_METERING_ENDS,
  type EnergyContractTerms,
} from '@gather/core/energy'
import { formatEnergyDate } from '@gather/core/energy-present'
import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { type FormEvent, type ReactNode, useId, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { fmt, type Messages, useI18n } from '../../lib/i18n'
import { Breadcrumbs } from '../app/Breadcrumbs'
import { SurfaceCard } from '../app/ShellPrimitives'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import {
  contractSummary,
  energyTrail,
  FIELD,
  PRIMARY,
  SECONDARY,
  Segmented,
  useEnergyRefusal,
} from './energyShared'

type ContractRow = NonNullable<
  FunctionReturnType<typeof api.energyContracts.list>
>[number]

/** The form's fields as typed: decimals as text, money in euros. */
interface Draft {
  kind: 'dynamic' | 'fixed'
  supplierName: string
  validFrom: string
  importMarkup: string
  exportFee: string
  energyTax: string
  tariffT1: string
  tariffT2: string
  tariffExport: string
  gasTariff: string
  gasMarkup: string
  gasTax: string
  monthlyFixed: string
  yearlyCredit: string
  vat: string
  netMetering: boolean
}

const EMPTY_DRAFT: Draft = {
  kind: 'dynamic',
  supplierName: '',
  validFrom: '',
  importMarkup: '',
  exportFee: '',
  energyTax: '',
  tariffT1: '',
  tariffT2: '',
  tariffExport: '',
  gasTariff: '',
  gasMarkup: '',
  gasTax: '',
  monthlyFixed: '',
  yearlyCredit: '',
  vat: '21',
  netMetering: true,
}

/** A number as the field shows it, in the reader's decimal mark. */
function typed(value: number | undefined, locale: string): string {
  if (value === undefined) return ''
  const text = String(value)
  return locale === 'nl' ? text.replace('.', ',') : text
}

function draftOf(terms: EnergyContractTerms, locale: string): Draft {
  const euros = (cents: number | undefined) =>
    cents === undefined ? '' : typed(cents / 100, locale)
  return {
    kind: terms.kind,
    supplierName: terms.supplierName ?? '',
    validFrom: terms.validFrom,
    importMarkup: typed(terms.importMarkupEurPerKwh, locale),
    exportFee: typed(terms.exportFeeEurPerKwh, locale),
    energyTax: typed(terms.energyTaxEurPerKwh, locale),
    tariffT1: typed(terms.fixedTariffs?.t1, locale),
    tariffT2: typed(terms.fixedTariffs?.t2, locale),
    tariffExport: typed(terms.fixedTariffs?.export, locale),
    gasTariff: typed(terms.fixedTariffs?.gas, locale),
    gasMarkup: typed(terms.gasMarkupEurPerM3, locale),
    gasTax: typed(terms.gasTaxEurPerM3, locale),
    monthlyFixed: euros(terms.monthlyFixedCents),
    yearlyCredit: euros(terms.yearlyTaxCreditCents),
    vat: typed(terms.vatPercent, locale),
    netMetering: terms.netMetering,
  }
}

/** Whether net metering can still be chosen for a contract from `validFrom`. */
function netMeteringOffered(validFrom: string): boolean {
  return !validFrom || validFrom < ENERGY_NET_METERING_ENDS
}

/**
 * The terms the draft describes, or the reason it cannot be saved. A blank
 * field the contract needs is a problem; a blank optional one (gas, the tax
 * reduction) is left out.
 */
function termsOf(
  draft: Draft,
): { terms: EnergyContractTerms } | { problem: 'invalid' | 'invalidDate' } {
  const required = (text: string) => parseDecimal(text)
  const optional = (text: string) =>
    text.trim() ? (parseDecimal(text) ?? Number.NaN) : undefined
  const fixed = draft.kind === 'fixed'
  const numbers = {
    importMarkup: fixed ? 0 : required(draft.importMarkup),
    exportFee: fixed ? 0 : required(draft.exportFee),
    energyTax: required(draft.energyTax),
    vat: required(draft.vat),
    monthlyFixed: required(draft.monthlyFixed),
    t1: fixed ? required(draft.tariffT1) : 0,
    t2: fixed ? required(draft.tariffT2) : 0,
    export: fixed ? required(draft.tariffExport) : 0,
  }
  if (!draft.validFrom) return { problem: 'invalidDate' }
  if (Object.values(numbers).some((value) => value === null)) {
    return { problem: 'invalid' }
  }
  const yearly = optional(draft.yearlyCredit)
  const terms: EnergyContractTerms = {
    validFrom: draft.validFrom,
    kind: draft.kind,
    supplierName: draft.supplierName.trim() || undefined,
    importMarkupEurPerKwh: numbers.importMarkup as number,
    exportFeeEurPerKwh: numbers.exportFee as number,
    energyTaxEurPerKwh: numbers.energyTax as number,
    gasMarkupEurPerM3: fixed ? undefined : optional(draft.gasMarkup),
    gasTaxEurPerM3: optional(draft.gasTax),
    fixedTariffs: fixed
      ? {
          t1: numbers.t1 as number,
          t2: numbers.t2 as number,
          export: numbers.export as number,
          gas: optional(draft.gasTariff) ?? 0,
        }
      : undefined,
    vatPercent: numbers.vat as number,
    monthlyFixedCents: Math.round((numbers.monthlyFixed as number) * 100),
    yearlyTaxCreditCents:
      yearly === undefined ? undefined : Math.round(yearly * 100),
    netMetering: netMeteringOffered(draft.validFrom) && draft.netMetering,
  }
  const problem = checkEnergyContract(terms)
  if (problem === 'invalidDate') return { problem: 'invalidDate' }
  if (problem) return { problem: 'invalid' }
  return { terms }
}

/**
 * The contract and its tariffs (APP-494, design section 6).
 *
 * The latest contract is edited in place. New tariffs are a new contract from
 * the day they start, prefilled from the latest, so the months before keep
 * counting with their own; earlier contracts are listed read-only.
 */
export function EnergyContractPage() {
  const group = useRequiredCurrentGroup()
  const { messages } = useI18n()
  const copy = messages.energy.contract
  const contracts = useQuery(api.energyContracts.list, {
    groupSlug: group.slug,
  })
  const [startingNew, setStartingNew] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  if (contracts === undefined) {
    return (
      <Frame messages={messages} title={copy.title}>
        <div className="h-40 animate-pulse rounded-[var(--radius-control)] border border-[var(--hair)] bg-[var(--surface-2)]" />
      </Frame>
    )
  }
  if (contracts === null) {
    return (
      <Frame messages={messages} title={copy.title}>
        <p className="m-0 text-sm">{messages.energy.empty.summary}</p>
      </Frame>
    )
  }

  const latest = contracts[0] ?? null
  const creating = startingNew || latest === null
  return (
    <Frame
      messages={messages}
      title={startingNew ? copy.newContractTitle : copy.title}
    >
      <ContractForm
        // Starting a new contract is a fresh form.
        key={creating ? 'new' : latest?._id}
        groupSlug={group.slug}
        latest={latest}
        creating={creating}
        onSaved={() => {
          setStartingNew(false)
          setJustSaved(true)
        }}
        onEdit={() => setJustSaved(false)}
      />
      {justSaved ? (
        <p role="status" className="m-0 text-sm font-semibold">
          {copy.saved}
        </p>
      ) : null}
      {latest && !startingNew ? (
        <div className="grid gap-2">
          <div>
            <button
              type="button"
              className={SECONDARY}
              onClick={() => {
                setStartingNew(true)
                setJustSaved(false)
              }}
            >
              {copy.newContract}
            </button>
          </div>
          <p className="m-0 text-sm text-[var(--muted)]">
            {copy.earlierHint}
          </p>
        </div>
      ) : null}
      {startingNew ? (
        <div>
          <button
            type="button"
            className={SECONDARY}
            onClick={() => setStartingNew(false)}
          >
            {copy.cancelNew}
          </button>
        </div>
      ) : null}
      <EarlierContracts contracts={contracts} />
    </Frame>
  )
}

function Frame({
  messages,
  title,
  children,
}: {
  messages: Messages
  title: string
  children: ReactNode
}) {
  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <Breadcrumbs
        trail={energyTrail(messages, messages.energy.contract.title)}
        className="mb-0"
      />
      <h2 className="m-0 font-rounded text-2xl font-bold">{title}</h2>
      {children}
    </div>
  )
}

function EarlierContracts({ contracts }: { contracts: readonly ContractRow[] }) {
  const { messages, locale } = useI18n()
  const copy = messages.energy.contract
  const earlier = contracts.slice(1)
  if (earlier.length === 0) return null
  return (
    <section className="grid gap-2">
      <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {copy.earlier}
      </h3>
      <ul className="shell-card m-0 grid list-none divide-y divide-[var(--hair)] p-0">
        {earlier.map((contract, index) => {
          // Newest first: the one before this in the list started after it.
          const next = contracts[index] as ContractRow
          return (
            <li key={contract._id} className="grid gap-0.5 px-4 py-3">
              <span className="text-base">
                {contractSummary(contract.terms, messages, locale)}
              </span>
              <span className="text-sm text-[var(--muted)]">
                {fmt(copy.earlierRange, {
                  from: formatEnergyDate(
                    contract.terms.validFrom,
                    locale,
                    'dayMonthYear',
                  ),
                  to: formatEnergyDate(
                    addDays(next.terms.validFrom, -1),
                    locale,
                    'dayMonthYear',
                  ),
                })}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function ContractForm({
  groupSlug,
  latest,
  creating,
  onSaved,
  onEdit,
}: {
  groupSlug: string
  latest: ContractRow | null
  creating: boolean
  onSaved: () => void
  onEdit: () => void
}) {
  const { messages, locale } = useI18n()
  const copy = messages.energy.contract
  const refusal = useEnergyRefusal()
  const save = useMutation(api.energyContracts.save)
  const ids = useId()
  const [draft, setDraft] = useState<Draft>(() => {
    if (!latest) return EMPTY_DRAFT
    const from = draftOf(latest.terms, locale)
    return creating ? { ...from, validFrom: '' } : from
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    onEdit()
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    onEdit()
    const result = termsOf(draft)
    if ('problem' in result) {
      setError(result.problem === 'invalidDate' ? copy.invalidDate : copy.invalid)
      return
    }
    setError(null)
    setSaving(true)
    try {
      await save({
        groupSlug,
        contractId: creating ? undefined : latest?._id,
        terms: result.terms,
      })
      onSaved()
    } catch (caught) {
      setError(refusal(caught))
    } finally {
      setSaving(false)
    }
  }

  const amount = (
    key: keyof Draft,
    label: string,
    unit: string,
    hint?: string,
  ) => (
    <AmountField
      id={`${ids}-${key}`}
      label={label}
      unit={unit}
      hint={hint}
      value={draft[key] as string}
      onChange={(value) => set(key, value as Draft[typeof key])}
    />
  )
  const fixed = draft.kind === 'fixed'

  return (
    <form className="grid gap-4" onSubmit={submit} noValidate>
      <Segmented
        label={copy.kindLabel}
        value={draft.kind}
        onChange={(kind) => set('kind', kind)}
        options={[
          { value: 'dynamic', label: copy.dynamic },
          { value: 'fixed', label: copy.fixed },
        ]}
      />

      <Group title={copy.groupContract}>
        <label
          className="grid gap-1 text-sm font-medium"
          htmlFor={`${ids}-supplier`}
        >
          {copy.supplier}
          <input
            id={`${ids}-supplier`}
            className={FIELD}
            value={draft.supplierName}
            maxLength={60}
            autoComplete="organization"
            onChange={(event) => set('supplierName', event.target.value)}
          />
        </label>
        <label
          className="grid gap-1 text-sm font-medium"
          htmlFor={`${ids}-validFrom`}
        >
          {copy.validFrom}
          <input
            id={`${ids}-validFrom`}
            type="date"
            className={FIELD}
            value={draft.validFrom}
            required
            onChange={(event) => set('validFrom', event.target.value)}
          />
        </label>
      </Group>

      <Group title={fixed ? copy.groupFixed : copy.groupDynamic}>
        {fixed ? (
          <>
            {amount('tariffT2', copy.tariffT2, copy.unitKwh)}
            {amount('tariffT1', copy.tariffT1, copy.unitKwh)}
            {amount('tariffExport', copy.tariffExport, copy.unitKwh)}
          </>
        ) : (
          <>
            {amount('importMarkup', copy.importMarkup, copy.unitKwh)}
            {amount('exportFee', copy.exportFee, copy.unitKwh, copy.exportFeeHint)}
          </>
        )}
        {amount('energyTax', copy.energyTax, copy.unitKwh)}
      </Group>

      <Group title={copy.groupGas}>
        {fixed
          ? amount('gasTariff', copy.gasTariff, copy.unitM3)
          : amount('gasMarkup', copy.gasMarkup, copy.unitM3)}
        {amount('gasTax', copy.gasTax, copy.unitM3)}
      </Group>

      <Group title={copy.groupFixedCosts}>
        {amount('monthlyFixed', copy.monthlyFixed, copy.unitMonth)}
        {amount('yearlyCredit', copy.yearlyCredit, copy.unitYear)}
        {amount('vat', copy.vat, copy.unitPercent)}
      </Group>

      <p className="m-0 text-sm text-[var(--muted)]">{copy.amountsNote}</p>

      {netMeteringOffered(draft.validFrom) ? (
        <SurfaceCard className="flex items-center justify-between gap-3">
          <span className="grid gap-0.5">
            <span id={`${ids}-net`} className="text-base">
              {copy.netMetering}
            </span>
            <span
              id={`${ids}-net-hint`}
              className="text-sm text-[var(--muted)]"
            >
              {copy.netMeteringHint}
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={draft.netMetering}
            aria-labelledby={`${ids}-net`}
            aria-describedby={`${ids}-net-hint`}
            onClick={() => set('netMetering', !draft.netMetering)}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
              draft.netMetering
                ? 'bg-[var(--accent)]'
                : 'bg-[var(--hair)]'
            }`}
          >
            <span
              aria-hidden="true"
              className={`inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${
                draft.netMetering ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </SurfaceCard>
      ) : null}

      {error ? (
        <p role="alert" className="m-0 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      <div>
        <button type="submit" className={PRIMARY} disabled={saving}>
          {saving ? copy.saving : copy.save}
        </button>
      </div>
    </form>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <SurfaceCard>
      {/* A fieldset, so "Energy tax" under Gas and under Electricity are told apart. */}
      <fieldset className="m-0 grid min-w-0 gap-3 border-0 p-0">
        <legend className="mb-3 p-0 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          {title}
        </legend>
        {children}
      </fieldset>
    </SurfaceCard>
  )
}

function AmountField({
  id,
  label,
  unit,
  hint,
  value,
  onChange,
}: {
  id: string
  label: string
  unit: string
  hint?: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          className={FIELD}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="w-16 shrink-0 text-sm text-[var(--muted)]">
          {unit}
        </span>
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="m-0 text-xs text-[var(--muted)]">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
