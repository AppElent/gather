/**
 * The price source (APP-493, designs/energy section 4). Admins choose a
 * provider and type its key; everyone sees which one it is and how it is
 * doing. The stored key never comes back to the phone: left empty, it is kept.
 */
import {
  amsterdamDayOf,
  ENERGY_PRICE_PROVIDER_NAMES,
  ENERGY_PRICE_PROVIDERS,
  type EnergyPriceProvider,
  energyPriceNeedsKey,
} from '@gather/core/energy'
import {
  type EnergyPriceView,
  energyPriceStateLine,
} from '@gather/core/energy-present'
import { readEnergyRefusal } from '@gather/core/refusals'
import { useMutation } from 'convex/react'
import { Stack } from 'expo-router'
import { useState } from 'react'
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { api } from '../../convex/api'
import { useQuery } from '../../convex/queries'
import { haptics } from '../../feedback/haptics'
import { useGroup } from '../../group/GroupProvider'
import { useI18n } from '../../i18n'
import { RADIUS, SPACE, TYPE, useTokens } from '../../theme/tokens'
import { Button } from '../../ui/button'
import { Field } from '../../ui/field'
import { moduleTile } from '../../ui/module-tile'
import { radioProps } from '../../ui/radio-props'
import { washScreenOptions } from '../../ui/screen-header'
import { SectionLabel } from '../../ui/section-label'
import { WashHeader } from '../../ui/wash-header'
import { useEnergyMinute } from './use-energy-minute'

export function EnergyPriceFeedScreen() {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const { t } = useI18n()
  const { group } = useGroup()
  const words = t.energy
  const now = useEnergyMinute()
  const view = useQuery(api.energyPrices.view, {
    groupSlug: group.slug,
    day: amsterdamDayOf(now),
  })
  const tile = moduleTile('energy')

  return (
    <>
      <Stack.Screen options={washScreenOptions(words.feed.title)} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        style={{ backgroundColor: tokens.ground }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {tile && view ? (
          <WashHeader
            group={tile.group}
            glyph={tile.glyph}
            summary={{ count: view.siteName, sub: words.feed.sub }}
          />
        ) : null}
        <View style={styles.content}>
          {view === undefined ? (
            <LoadingSkeleton rows={4} label={t.actions.loading} />
          ) : view === null ? (
            <Text style={[TYPE.body, { color: tokens.muted }]}>
              {words.empty.summary}
            </Text>
          ) : (
            <FeedForm
              // A source somebody else saved replaces what was chosen here.
              key={`${group.slug}:${view.provider}`}
              groupSlug={group.slug}
              view={view}
              now={now}
            />
          )}
        </View>
      </ScrollView>
    </>
  )
}

function FeedForm({
  groupSlug,
  view,
  now,
}: {
  groupSlug: string
  view: EnergyPriceView
  now: number
}) {
  const tokens = useTokens('home')
  const { t, locale } = useI18n()
  const words = t.energy
  const copy = words.feed
  const save = useMutation(api.energyPrices.saveFeed)
  const [provider, setProvider] = useState<EnergyPriceProvider>(view.provider)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const chosen = provider === view.provider
  const needsKey = energyPriceNeedsKey(provider)
  const stored = chosen && view.hasKey
  const state = energyPriceStateLine(view, now, words, locale)
  const submittable = needsKey ? Boolean(key.trim()) : !chosen

  const submit = async () => {
    Keyboard.dismiss()
    setBusy(true)
    setProblem(null)
    try {
      await save({ groupSlug, provider, ...(key.trim() ? { key } : {}) })
      haptics.itemSaved()
    } catch (caught) {
      haptics.actionFailed()
      const code = readEnergyRefusal(caught)
      setProblem(code ? words.refusals[code] : t.common.errors.didNotWork)
    } finally {
      // The server has the key, or refused it: it is typed again either way.
      setKey('')
      setBusy(false)
    }
  }

  return (
    <>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={copy.choices}
        style={styles.options}
      >
        {ENERGY_PRICE_PROVIDERS.map((each) => (
          <Choice
            key={each}
            testID={`energy-feed-${each}`}
            label={ENERGY_PRICE_PROVIDER_NAMES[each]}
            hint={copy[each]}
            selected={provider === each}
            disabled={!view.canManage || busy}
            onPress={() => {
              haptics.selectionChanged()
              setProvider(each)
              setKey('')
              setProblem(null)
            }}
          />
        ))}
        <Choice
          testID="energy-feed-more"
          label={copy.more}
          hint={copy.moreSub}
          selected={false}
          disabled
          dimmed
        />
      </View>

      <Text
        testID="energy-feed-state"
        accessibilityLiveRegion="polite"
        style={[
          TYPE.subhead,
          styles.note,
          { color: state.problem ? tokens.danger : tokens.muted },
        ]}
      >
        {state.text}
      </Text>

      {view.canManage && needsKey ? (
        <View style={styles.section}>
          <SectionLabel>
            {provider === 'tibber' ? copy.tibberHeading : copy.entsoeHeading}
          </SectionLabel>
          <Field
            label={copy.key}
            value={key}
            onChangeText={(text) => {
              setKey(text)
              setProblem(null)
            }}
            placeholder={stored ? copy.keyStored : undefined}
            secure
            // Not this person's password, so nothing should offer to fill it.
            textContentType="none"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect={false}
            testID="energy-feed-key"
          />
          <Text style={[TYPE.footnote, styles.note, { color: tokens.muted }]}>
            {provider === 'tibber' ? copy.tibberHelp : copy.entsoeHelp}{' '}
            {copy.keyNote}
          </Text>
          {provider === 'tibber' ? (
            <Text style={[TYPE.footnote, styles.note, { color: tokens.ink }]}>
              {copy.tibberNote}
            </Text>
          ) : null}
        </View>
      ) : stored ? (
        <Text style={[TYPE.subhead, styles.note, { color: tokens.ink }]}>
          {copy.keyInPlace}
        </Text>
      ) : null}

      {problem ? (
        <Text
          accessibilityRole="alert"
          style={[TYPE.subhead, styles.note, { color: tokens.danger }]}
        >
          {problem}
        </Text>
      ) : null}
      {view.canManage ? (
        <Button
          label={busy ? copy.saving : copy.save}
          group="home"
          busy={busy}
          disabled={busy || !submittable}
          onPress={submit}
          testID="energy-feed-save"
        />
      ) : (
        <Text style={[TYPE.subhead, styles.note, { color: tokens.ink }]}>
          {copy.adminsOnly}
        </Text>
      )}
      <Text style={[TYPE.footnote, styles.note, { color: tokens.muted }]}>
        {copy.footer}
      </Text>
    </>
  )
}

function Choice({
  label,
  hint,
  selected,
  disabled,
  dimmed = false,
  onPress,
  testID,
}: {
  label: string
  hint: string
  selected: boolean
  disabled: boolean
  dimmed?: boolean
  onPress?: () => void
  testID: string
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const radio = radioProps(selected, t.energy.feed.choice)
  return (
    <Pressable
      {...radio}
      accessibilityState={{ ...radio.accessibilityState, disabled }}
      accessibilityLabel={`${label}. ${hint}`}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor: tokens.surface,
          borderColor: selected ? tokens.accent : tokens.hair,
        },
        dimmed && styles.dimmed,
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.radio,
          { borderColor: selected ? tokens.accent : tokens.muted },
        ]}
      >
        {selected ? (
          <View style={[styles.radioDot, { backgroundColor: tokens.accent }]} />
        ) : null}
      </View>
      <View style={styles.flex}>
        <Text style={[TYPE.bodyStrong, { color: tokens.ink }]}>{label}</Text>
        <Text style={[TYPE.footnote, { color: tokens.muted }]}>{hint}</Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACE[4], gap: SPACE[4] },
  section: { gap: SPACE[2] },
  options: { gap: SPACE[2] },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACE[3],
    padding: 14,
    borderRadius: RADIUS.card,
    borderWidth: 1.5,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  radioDot: { width: 11, height: 11, borderRadius: 6 },
  flex: { flex: 1 },
  note: { paddingHorizontal: 4 },
  dimmed: { opacity: 0.55 },
  pressed: { opacity: 0.7 },
})
