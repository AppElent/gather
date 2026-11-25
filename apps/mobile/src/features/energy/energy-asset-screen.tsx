/**
 * Panels or a battery (APP-496): add one, change one, or remove it. Only the
 * name is needed; a purchase price makes it count what it pays back.
 */
import { amsterdamIsoDate, localIsoDate, localMidnight } from '@gather/core/civil-date'
import {
  checkEnergyAsset,
  ENERGY_ASSET_LIMITS,
  type EnergyAssetTerms,
  energyAssetFromText,
  energyMonthOf,
} from '@gather/core/energy'
import { readEnergyRefusal } from '@gather/core/refusals'
import { useMutation } from 'convex/react'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { DateTimeChip, DateTimeWheel } from '../../components/DateTimeField'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { Segmented } from '../../components/Segmented'
import { api, type Id } from '../../convex/api'
import { useQuery } from '../../convex/queries'
import { confirmDestructive } from '../../feedback/confirmDestructive'
import { haptics } from '../../feedback/haptics'
import { useGroup } from '../../group/GroupProvider'
import { fmt, useI18n } from '../../i18n'
import { SPACE, TYPE, useTokens } from '../../theme/tokens'
import { Button } from '../../ui/button'
import { InsetList, InsetRow } from '../../ui/inset-list'
import { EnergyNumberRow } from './components/energy-number-row'
import { decimalsOf, editableNumber } from './energy-number-text'

export function EnergyAssetScreen({ assetId }: { assetId?: string }) {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const { t } = useI18n()
  const { group } = useGroup()
  const words = t.energy
  const today = amsterdamIsoDate()
  const data = useQuery(api.energySolar.month, {
    groupSlug: group.slug,
    month: energyMonthOf(today),
    today,
  })
  const row = data?.assets.find((each) => each._id === assetId)

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: assetId ? words.solar.editTitle : words.solar.addTitle,
          headerLargeTitle: false,
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        style={{ backgroundColor: tokens.ground }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        {data === undefined ? (
          <LoadingSkeleton rows={4} label={t.actions.loading} />
        ) : data === null || (assetId && !row) ? (
          <Text style={[TYPE.body, { color: tokens.muted }]}>
            {data === null ? words.refusals.notFound : words.solar.gone}
          </Text>
        ) : (
          <AssetForm
            groupSlug={group.slug}
            assetId={row?._id}
            initial={row?.asset ?? null}
            today={today}
          />
        )}
      </ScrollView>
    </>
  )
}

function AssetForm({
  groupSlug,
  assetId,
  initial,
  today,
}: {
  groupSlug: string
  assetId?: Id<'energyAssets'>
  initial: EnergyAssetTerms | null
  today: string
}) {
  const tokens = useTokens('home')
  const { t, locale } = useI18n()
  const router = useRouter()
  const words = t.energy
  const copy = words.solar
  const save = useMutation(api.energyAssets.save)
  const remove = useMutation(api.energyAssets.remove)
  const text = (value: number | undefined) =>
    value === undefined
      ? ''
      : editableNumber(value, locale, decimalsOf(value, 3))
  const [kind, setKind] = useState<EnergyAssetTerms['kind']>(
    initial?.kind ?? 'solar',
  )
  const [name, setName] = useState(initial?.name ?? '')
  const [peakWatt, setPeakWatt] = useState(text(initial?.peakWatt))
  const [capacityKwh, setCapacityKwh] = useState(text(initial?.capacityKwh))
  const [installedOn, setInstalledOn] = useState(initial?.installedOn ?? null)
  const [picking, setPicking] = useState(false)
  const [purchaseEur, setPurchaseEur] = useState(
    text(
      initial?.purchaseCents === undefined
        ? undefined
        : initial.purchaseCents / 100,
    ),
  )
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const fail = (caught: unknown) => {
    haptics.actionFailed()
    const code = readEnergyRefusal(caught)
    setProblem(code ? words.refusals[code] : t.common.errors.didNotWork)
    setBusy(false)
  }

  const submit = async () => {
    const checked = checkEnergyAsset(
      energyAssetFromText({
        kind,
        name,
        peakWatt,
        capacityKwh,
        installedOn,
        purchaseEur,
      }),
      today,
    )
    if ('problem' in checked) {
      haptics.actionFailed()
      setProblem(words.refusals[checked.problem])
      return
    }
    setBusy(true)
    setProblem(null)
    try {
      await save({ groupSlug, assetId, asset: checked.asset, today })
      haptics.itemSaved()
      router.back()
    } catch (caught) {
      fail(caught)
    }
  }

  const askRemove = (id: Id<'energyAssets'>) =>
    confirmDestructive({
      title: fmt(copy.removeTitle, { name: initial?.name ?? '' }),
      message: copy.removeBody,
      confirm: copy.remove,
      cancel: copy.cancel,
      onConfirm: async () => {
        setBusy(true)
        setProblem(null)
        try {
          await remove({ groupSlug, assetId: id })
          router.back()
        } catch (caught) {
          fail(caught)
        }
      },
    })

  return (
    <View style={styles.form}>
      <Segmented<EnergyAssetTerms['kind']>
        options={[
          { value: 'solar', label: copy.kindSolar },
          { value: 'battery', label: copy.kindBattery },
        ]}
        value={kind}
        onChange={setKind}
      />
      <View style={styles.section}>
        <InsetList>
          <EnergyNumberRow
            key="name"
            testID="energy-asset-name"
            label={copy.name}
            unit=""
            keyboardType="default"
            wide
            maxLength={ENERGY_ASSET_LIMITS.name}
            placeholder={
              kind === 'solar'
                ? copy.namePlaceholderSolar
                : copy.namePlaceholderBattery
            }
            value={name}
            onChangeText={setName}
          />
          {kind === 'solar' ? (
            <EnergyNumberRow
              key="peakWatt"
              testID="energy-asset-peak"
              label={copy.peakWattLabel}
              unit={copy.unitWatt}
              value={peakWatt}
              onChangeText={setPeakWatt}
            />
          ) : (
            <EnergyNumberRow
              key="capacity"
              testID="energy-asset-capacity"
              label={copy.capacityLabel}
              unit={words.units.kWh}
              value={capacityKwh}
              onChangeText={setCapacityKwh}
            />
          )}
          <InsetRow
            key="installed"
            title={copy.installedOn}
            subtitle={installedOn ? undefined : copy.installedNone}
            trailing={
              <DateTimeChip
                mode="date"
                value={localMidnight(installedOn ?? today)}
                open={picking}
                onPress={() => {
                  // The chip opens on the day it shows, which is then the answer.
                  if (!installedOn) setInstalledOn(today)
                  setPicking((open) => !open)
                }}
                accessibilityLabel={copy.installedOn}
                testID="energy-asset-installed"
              />
            }
          />
          <EnergyNumberRow
            key="purchase"
            testID="energy-asset-purchase"
            label={copy.purchase}
            unit={copy.unitEuro}
            value={purchaseEur}
            onChangeText={setPurchaseEur}
          />
        </InsetList>
        {picking ? (
          <DateTimeWheel
            mode="date"
            value={localMidnight(installedOn ?? today)}
            maximumDate={localMidnight(today)}
            onClose={() => setPicking(false)}
            onChange={(next) => setInstalledOn(localIsoDate(next))}
          />
        ) : null}
        {installedOn ? (
          <Button
            testID="energy-asset-clear-date"
            variant="ghost"
            label={copy.clearDate}
            onPress={() => {
              setInstalledOn(null)
              setPicking(false)
            }}
          />
        ) : null}
        <Text style={[TYPE.footnote, styles.hint, { color: tokens.muted }]}>
          {copy.optionalNote}
        </Text>
      </View>
      {problem ? (
        <Text
          accessibilityRole="alert"
          testID="energy-asset-problem"
          style={[TYPE.subhead, { color: tokens.danger }]}
        >
          {problem}
        </Text>
      ) : null}
      <Button
        testID="energy-asset-save"
        label={busy ? copy.saving : copy.save}
        group="home"
        busy={busy}
        onPress={submit}
      />
      {assetId ? (
        <Button
          testID="energy-asset-remove"
          variant="ghost"
          label={copy.remove}
          disabled={busy}
          onPress={() => askRemove(assetId)}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACE[4], paddingTop: SPACE[3], gap: SPACE[4] },
  form: { gap: SPACE[5] },
  section: { gap: SPACE[2] },
  hint: { paddingHorizontal: 4 },
})
