/**
 * Meter readings (APP-494, designs/energy section 10): a day, then per meter
 * the reading before it and a field for the count on the meter.
 *
 * A meter counts up, so a value lower than the previous reading is refused
 * in the row, in words, before anything is sent: a new meter is a new
 * channel under Sources, never a correction. A blank field is skipped; at
 * least one must be filled in. The server checks the same and answers in
 * words too (`t.energy.refusals`).
 *
 * A Group that has not named its meters yet first says which it reads
 * (`energyReadings.setupChannels`).
 */
import { amsterdamIsoDate, localIsoDate, localMidnight } from '@gather/core/civil-date'
import {
  amsterdamDayOf,
  checkEnergyReading,
  type EnergyReadingProblem,
  parseMeterReading,
} from '@gather/core/energy'
import {
  energyChannelName,
  energyUnitName,
  formatEnergyDate,
  formatEnergyNumber,
} from '@gather/core/energy-present'
import { readEnergyRefusal } from '@gather/core/refusals'
import { useMutation } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { Stack, useRouter } from 'expo-router'
import { useId, useRef, useState } from 'react'
import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  type TextInputInstance,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { DateTimeChip, DateTimeWheel } from '../../components/DateTimeField'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { api } from '../../convex/api'
import { useLiveQuery } from '../../convex/queries'
import { haptics } from '../../feedback/haptics'
import { useGroup } from '../../group/GroupProvider'
import { fmt, useI18n } from '../../i18n'
import { SPACE, TYPE, useTokens } from '../../theme/tokens'
import { Button } from '../../ui/button'
import { Card } from '../../ui/card'
import { InsetList, InsetRow } from '../../ui/inset-list'
import { SectionLabel } from '../../ui/section-label'
import {
  EnergyNumberRow,
  KeyboardDoneBar,
} from './components/energy-number-row'
import { decimalsOf } from './energy-number-text'

type Form = NonNullable<FunctionReturnType<typeof api.energyReadings.form>>
type Channel = Form['channels'][number]

export function EnergyReadingsScreen() {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const { t } = useI18n()
  const { group } = useGroup()
  const words = t.energy
  const today = amsterdamIsoDate()
  const [day, setDay] = useState(today)
  const live = useLiveQuery(api.energyReadings.form, {
    groupSlug: group.slug,
    day,
  })
  // Picking another day keeps the form on screen until that day's answer
  // arrives, rather than flashing the skeleton under an open picker.
  const last = useRef(live)
  if (live !== undefined) last.current = live
  const form = live ?? last.current

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: words.readings.title,
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
        {form === undefined ? (
          <LoadingSkeleton rows={4} label={t.actions.loading} />
        ) : form === null ? (
          <Text style={[TYPE.body, { color: tokens.muted }]}>
            {words.refusals.notFound}
          </Text>
        ) : form.channels.length === 0 ? (
          <MeterSetup groupSlug={group.slug} measured={form.measured} />
        ) : (
          <ReadingsForm
            groupSlug={group.slug}
            day={day}
            today={today}
            onDay={setDay}
            channels={form.channels}
          />
        )}
      </ScrollView>
    </>
  )
}

function ReadingsForm({
  groupSlug,
  day,
  today,
  onDay,
  channels,
}: {
  groupSlug: string
  day: string
  today: string
  onDay: (day: string) => void
  channels: readonly Channel[]
}) {
  const tokens = useTokens('home')
  const { t, locale } = useI18n()
  const router = useRouter()
  const words = t.energy
  const save = useMutation(api.energyReadings.save)
  const [picking, setPicking] = useState(false)
  const [texts, setTexts] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const fields = useRef<(TextInputInstance | null)[]>([])
  const keyboardDoneId = `energy-readings-done-${useId().replaceAll(':', '')}`

  const number = (value: number) =>
    formatEnergyNumber(value, locale, decimalsOf(value))
  const dateOf = (at: number) =>
    formatEnergyDate(amsterdamDayOf(at), locale, 'dayMonth')

  const problemOf = (channel: Channel): EnergyReadingProblem | null => {
    const text = texts[channel._id] ?? ''
    if (!text.trim()) return null
    return checkEnergyReading(parseMeterReading(text), {
      previous: channel.previous?.value,
      next: channel.next?.value,
    })
  }
  const sentence = (channel: Channel, code: EnergyReadingProblem) => {
    if (code === 'lowerThanPrevious' && channel.previous) {
      return fmt(words.readings.lower, { value: number(channel.previous.value) })
    }
    if (code === 'higherThanNext' && channel.next) {
      return fmt(words.readings.higher, {
        value: number(channel.next.value),
        date: dateOf(channel.next.at),
      })
    }
    if (code === 'negative') return words.readings.negative
    return words.readings.notANumber
  }

  const submit = async () => {
    setChecked(new Set(channels.map((channel) => channel._id)))
    const typed = channels.filter((channel) => (texts[channel._id] ?? '').trim())
    if (typed.length === 0) {
      haptics.actionFailed()
      setProblem(words.readings.nothingTyped)
      return
    }
    if (typed.some((channel) => problemOf(channel) !== null)) {
      haptics.actionFailed()
      setProblem(null)
      return
    }
    setSaving(true)
    setProblem(null)
    try {
      await save({
        groupSlug,
        day,
        readings: typed.map((channel) => ({
          channelId: channel._id,
          value: parseMeterReading(texts[channel._id] ?? '') as number,
        })),
      })
      haptics.itemSaved()
      if (router.canGoBack()) router.back()
      else {
        setTexts({})
        setChecked(new Set())
        setSaving(false)
      }
    } catch (caught) {
      haptics.actionFailed()
      const code = readEnergyRefusal(caught)
      setProblem(code ? words.refusals[code] : t.common.errors.didNotWork)
      setSaving(false)
    }
  }

  return (
    <View style={styles.form}>
      <Card style={styles.dateCard}>
        <View style={styles.dateRow}>
          <Text style={[TYPE.body, styles.flex, { color: tokens.ink }]}>
            {words.readings.date}
          </Text>
          <DateTimeChip
            mode="date"
            value={localMidnight(day)}
            open={picking}
            onPress={() => setPicking((open) => !open)}
            accessibilityLabel={words.readings.date}
            testID="energy-readings-date"
          />
        </View>
        {picking ? (
          <DateTimeWheel
            mode="date"
            value={localMidnight(day)}
            maximumDate={localMidnight(today)}
            onClose={() => setPicking(false)}
            onChange={(next) => {
              const picked = localIsoDate(next)
              onDay(picked > today ? today : picked)
            }}
          />
        ) : null}
      </Card>

      <View style={styles.section}>
        <SectionLabel>{words.readings.heading}</SectionLabel>
        <InsetList>
          {channels.map((channel, index) => {
            const unit = energyUnitName(channel.unit, words)
            const code = checked.has(channel._id) ? problemOf(channel) : null
            const previous = channel.previous
              ? fmt(words.readings.previous, {
                  value: number(channel.previous.value),
                  unit,
                  date: dateOf(channel.previous.at),
                })
              : words.readings.previousNone
            const replaces = channel.onDay
              ? fmt(words.readings.replaces, {
                  value: number(channel.onDay.value),
                  unit,
                })
              : null
            return (
              <EnergyNumberRow
                key={channel._id}
                ref={(field) => {
                  fields.current[index] = field
                }}
                testID={`energy-reading-${channel._id}`}
                label={energyChannelName(channel, words)}
                sub={replaces ? `${previous}\n${replaces}` : previous}
                unit={unit}
                value={texts[channel._id] ?? ''}
                autoFocus={index === 0}
                returnKeyType={index === channels.length - 1 ? 'done' : 'next'}
                inputAccessoryViewID={
                  Platform.OS === 'ios' ? keyboardDoneId : undefined
                }
                onSubmitEditing={() =>
                  index === channels.length - 1
                    ? submit()
                    : fields.current[index + 1]?.focus()
                }
                onChangeText={(text) =>
                  setTexts((current) => ({ ...current, [channel._id]: text }))
                }
                onBlur={() =>
                  setChecked((current) => new Set(current).add(channel._id))
                }
                problem={code ? sentence(channel, code) : null}
              />
            )
          })}
        </InsetList>
        <Text style={[TYPE.footnote, styles.hint, { color: tokens.muted }]}>
          {words.readings.footnote}
        </Text>
      </View>

      {problem ? (
        <Text
          accessibilityRole="alert"
          testID="energy-readings-problem"
          style={[TYPE.subhead, { color: tokens.danger }]}
        >
          {problem}
        </Text>
      ) : null}

      <Button
        label={saving ? words.readings.saving : words.readings.save}
        group="home"
        busy={saving}
        onPress={submit}
        testID="energy-readings-save"
      />
      <KeyboardDoneBar nativeID={keyboardDoneId} />
    </View>
  )
}

/** Which meters the Group reads, before the first reading. */
function MeterSetup({
  groupSlug,
  measured,
}: {
  groupSlug: string
  measured: Form['measured']
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const words = t.energy
  const setup = useMutation(api.energyReadings.setupChannels)
  const [split, setSplit] = useState(true)
  const covered = measured.includes('gridImport')
  const [exported, setExported] = useState(false)
  const [gas, setGas] = useState(!measured.includes('gas') && !covered)
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const submit = async () => {
    setSaving(true)
    setProblem(null)
    try {
      await setup({
        groupSlug,
        split,
        export: exported,
        gas,
        sourceLabel: words.site.manualSourceLabel,
      })
      haptics.itemSaved()
    } catch (caught) {
      haptics.actionFailed()
      const code = readEnergyRefusal(caught)
      setProblem(code ? words.refusals[code] : t.common.errors.didNotWork)
    }
    setSaving(false)
  }

  const switches = [
    {
      key: 'split',
      // A connected source measures these already (APP-495).
      hidden: covered,
      title: words.readings.setupSplit,
      hint: words.readings.setupSplitHint,
      value: split,
      set: setSplit,
    },
    {
      key: 'export',
      hidden: measured.includes('gridExport'),
      title: words.readings.setupExport,
      hint: words.readings.setupExportHint,
      value: exported,
      set: setExported,
    },
    {
      key: 'gas',
      hidden: measured.includes('gas'),
      title: words.readings.setupGas,
      hint: words.readings.setupGasHint,
      value: gas,
      set: setGas,
    },
  ].filter((each) => !each.hidden)

  return (
    <View style={styles.form} testID="energy-meter-setup">
      <View style={styles.setupText}>
        <Text
          accessibilityRole="header"
          style={[TYPE.title3, { color: tokens.ink }]}
        >
          {covered ? words.readings.measuredTitle : words.readings.setupTitle}
        </Text>
        <Text style={[TYPE.body, { color: tokens.ink }]}>
          {covered ? words.readings.measuredBody : words.readings.setupBody}
        </Text>
      </View>
      {switches.length > 0 ? (
        <InsetList>
          {switches.map((each) => (
            <InsetRow
              key={each.key}
              title={each.title}
              subtitle={each.hint}
              trailing={
                <Switch
                  testID={`energy-setup-${each.key}`}
                  value={each.value}
                  accessibilityLabel={each.title}
                  accessibilityHint={each.hint}
                  onValueChange={(next) => {
                    haptics.selectionChanged()
                    each.set(next)
                  }}
                  trackColor={{ false: tokens.surface2 }}
                />
              }
            />
          ))}
        </InsetList>
      ) : null}
      {problem ? (
        <Text
          accessibilityRole="alert"
          style={[TYPE.subhead, { color: tokens.danger }]}
        >
          {problem}
        </Text>
      ) : null}
      {covered && switches.length === 0 ? null : (
        <Button
          label={words.readings.setupSubmit}
          group="home"
          busy={saving}
          onPress={submit}
          disabled={covered && !switches.some((each) => each.value)}
          testID="energy-setup-submit"
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACE[4], paddingTop: SPACE[3], gap: SPACE[4] },
  form: { gap: SPACE[5] },
  section: { gap: SPACE[2] },
  setupText: { gap: SPACE[2] },
  dateCard: { paddingVertical: SPACE[2], gap: SPACE[2] },
  dateRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: SPACE[3] },
  flex: { flex: 1 },
  hint: { paddingHorizontal: 4 },
})
