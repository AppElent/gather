import {
  checkEnergyAsset,
  ENERGY_ASSET_LIMITS,
  type EnergyAssetTerms,
  energyAssetFromText,
} from '@gather/core/energy'
import { useMutation } from 'convex/react'
import { type FormEvent, useId, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { fmt, useI18n } from '../../lib/i18n'
import { useConfirmAction } from '../app/ConfirmAction'
import { SurfaceCard } from '../app/ShellPrimitives'
import { AmountField } from './EnergyContractPage'
import {
  FIELD,
  PRIMARY,
  SECONDARY,
  Segmented,
  useEnergyRefusal,
} from './energyShared'
import type { EnergyAssetRow } from './energySolarCharts'

/** Panels or a battery (APP-496): add one, change one, or remove it. */
export function EnergyAssetForm({
  groupSlug,
  row,
  today,
  onDone,
}: {
  groupSlug: string
  /** Null adds a new one. */
  row: EnergyAssetRow | null
  today: string
  onDone: () => void
}) {
  const { messages, locale } = useI18n()
  const copy = messages.energy.solar
  const refusal = useEnergyRefusal()
  const save = useMutation(api.energyAssets.save)
  const remove = useMutation(api.energyAssets.remove)
  const { confirm, dialog } = useConfirmAction()
  const ids = useId()
  const typed = (value: number | undefined) => {
    if (value === undefined) return ''
    const text = String(value)
    return locale === 'nl' ? text.replace('.', ',') : text
  }
  const asset = row?.asset
  const [kind, setKind] = useState<EnergyAssetTerms['kind']>(
    asset?.kind ?? 'solar',
  )
  const [name, setName] = useState(asset?.name ?? '')
  const [peakWatt, setPeakWatt] = useState(typed(asset?.peakWatt))
  const [capacity, setCapacity] = useState(typed(asset?.capacityKwh))
  const [installedOn, setInstalledOn] = useState(asset?.installedOn ?? '')
  const [purchase, setPurchase] = useState(
    typed(asset?.purchaseCents && asset.purchaseCents / 100),
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const terms = energyAssetFromText({
      kind,
      name,
      peakWatt,
      capacityKwh: capacity,
      installedOn,
      purchaseEur: purchase,
    })
    const checked = checkEnergyAsset(terms, today)
    if ('problem' in checked) {
      setError(messages.energy.refusals[checked.problem])
      return
    }
    setError(null)
    setSaving(true)
    try {
      await save({ groupSlug, assetId: row?._id, asset: checked.asset, today })
      onDone()
    } catch (caught) {
      setError(refusal(caught))
      setSaving(false)
    }
  }

  return (
    <form className="grid gap-4" onSubmit={submit} noValidate>
      <h2 className="m-0 text-lg font-semibold">
        {row ? copy.editTitle : copy.add}
      </h2>
      <Segmented
        label={copy.kindLabel}
        value={kind}
        onChange={setKind}
        options={[
          { value: 'solar', label: copy.kindSolar },
          { value: 'battery', label: copy.kindBattery },
        ]}
      />
      <SurfaceCard className="grid gap-3">
        <label className="grid gap-1 text-sm font-medium" htmlFor={`${ids}-name`}>
          {copy.name}
          <input
            id={`${ids}-name`}
            className={FIELD}
            value={name}
            maxLength={ENERGY_ASSET_LIMITS.name}
            placeholder={
              kind === 'solar'
                ? copy.namePlaceholderSolar
                : copy.namePlaceholderBattery
            }
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        {kind === 'solar' ? (
          <AmountField
            id={`${ids}-watt`}
            label={copy.peakWattLabel}
            unit={copy.unitWatt}
            value={peakWatt}
            onChange={setPeakWatt}
          />
        ) : (
          <AmountField
            id={`${ids}-capacity`}
            label={copy.capacityLabel}
            unit={messages.energy.units.kWh}
            value={capacity}
            onChange={setCapacity}
          />
        )}
        <label className="grid gap-1 text-sm font-medium" htmlFor={`${ids}-date`}>
          {copy.installedOn}
          <input
            id={`${ids}-date`}
            type="date"
            className={FIELD}
            value={installedOn}
            max={today}
            onChange={(event) => setInstalledOn(event.target.value)}
          />
        </label>
        <AmountField
          id={`${ids}-purchase`}
          label={copy.purchase}
          unit={copy.unitEuro}
          value={purchase}
          onChange={setPurchase}
        />
      </SurfaceCard>
      <p className="m-0 text-sm text-[var(--muted)]">{copy.optionalNote}</p>
      {error ? (
        <p role="alert" className="m-0 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={PRIMARY} disabled={saving}>
          {saving ? copy.saving : copy.save}
        </button>
        <button type="button" className={SECONDARY} onClick={onDone}>
          {copy.cancel}
        </button>
        {row ? (
          <button
            type="button"
            className={SECONDARY}
            disabled={saving}
            onClick={() =>
              confirm({
                title: fmt(copy.removeTitle, { name: row.asset.name }),
                body: copy.removeBody,
                confirmLabel: copy.remove,
                run: async () => {
                  await remove({ groupSlug, assetId: row._id })
                  onDone()
                },
              })
            }
          >
            {copy.remove}
          </button>
        ) : null}
      </div>
      {dialog}
    </form>
  )
}
