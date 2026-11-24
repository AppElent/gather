/**
 * The Energy Module (APP-492, APP-494): the Group's address, or the way to
 * add one.
 *
 * Empty, the wash says there is no address yet and the screen says what the
 * Module is for, with one step: adding an address (ADR-0022). That step opens
 * the form in place, as `designs/energy/Main.dc.html` draws it: a name, an
 * optional House from Finances and how the data comes in. Choosing meter
 * readings saves that source with the address; choosing Home Assistant saves
 * the address alone and goes on to connecting it (APP-495).
 *
 * With an address, the wash names it and its sources, with when the last
 * meter reading was typed so stale figures never look current, and a source's
 * problem in words with when its data is from (ADR-0020). Then the
 * usage card (hours from an hourly source, estimated days from readings, or
 * the first step towards either) and the rows to Usage, Costs per month,
 * Meter readings, Contract and Sources (designs/energy, sections 1 and 11).
 */
import { MenuView } from '@expo/ui/community/menu'
import { amsterdamIsoDate } from '@gather/core/civil-date'
import {
  amsterdamDayOf,
  checkEnergySiteName,
  ENERGY_LIMITS,
  energyMonthDays,
  energyMonthOf,
} from '@gather/core/energy'
import {
  energyHomeSourceLine,
  energyHomeSources,
  formatEnergyDate,
  formatEnergyEuro,
} from '@gather/core/energy-present'
import { readEnergyRefusal } from '@gather/core/refusals'
import { useMutation } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { api, type Id } from '../../convex/api'
import { useQuery } from '../../convex/queries'
import { haptics } from '../../feedback/haptics'
import { useGroup } from '../../group/GroupProvider'
import { fmt, useI18n } from '../../i18n'
import { moduleHref } from '../../modules/moduleDestination'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, SPACE, TYPE, useTokens } from '../../theme/tokens'
import { Button } from '../../ui/button'
import { Card } from '../../ui/card'
import { Field } from '../../ui/field'
import { InsetList, InsetRow } from '../../ui/inset-list'
import { moduleTile } from '../../ui/module-tile'
import { radioProps } from '../../ui/radio-props'
import { washScreenOptions } from '../../ui/screen-header'
import { SectionLabel } from '../../ui/section-label'
import { WashHeader } from '../../ui/wash-header'
import {
  EnergyChartLegend,
  EnergyMirrorChart,
  energySolarColour,
} from './components/energy-mirror-chart'
import {
  daySlots,
  type EnergyHourRow,
  hourSlots,
} from './energy-chart-series'
import {
  dayChartSentence,
  dayTicks,
  HOUR_TICKS,
  hourChartSentence,
} from './energy-chart-text'
import { contractSummary } from './energy-summary-text'

type SourceChoice = 'homeAssistant' | 'manual'

export function EnergyScreen() {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const { t, locale } = useI18n()
  const { group } = useGroup()
  const words = t.energy
  const overview = useQuery(api.energy.overview, { groupSlug: group.slug })
  const [adding, setAdding] = useState(false)
  const tile = moduleTile('energy')
  const today = amsterdamIsoDate()
  const site = overview ? { groupSlug: group.slug } : null
  const readings = useQuery(
    api.energyReadings.form,
    site ? { ...site, day: today } : 'skip',
  )

  const lastReading = readings?.lastReadingAt
    ? formatEnergyDate(amsterdamDayOf(readings.lastReadingAt), locale, 'dayMonth')
    : null
  const shown = energyHomeSources(
    overview?.sources ?? [],
    readings?.channels.length ?? 0,
  )
  const summary =
    overview === null
      ? { count: words.empty.summary, sub: words.empty.sub }
      : overview
        ? {
            count: overview.site.name,
            sub:
              overview.sources.length === 0
                ? words.site.sourceNone
                : shown
                    .map((source) =>
                      source.kind !== 'manual'
                        ? energyHomeSourceLine(source, Date.now(), words, locale)
                        : readings === undefined
                          ? source.label
                          : lastReading
                            ? fmt(words.site.lastReading, {
                                source: source.label,
                                date: lastReading,
                              })
                            : fmt(words.site.noReadingYet, {
                                source: source.label,
                              }),
                    )
                    .join(' · '),
          }
        : null

  return (
    <>
      <Stack.Screen options={washScreenOptions(t.modules.byId.energy.label)} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.ground }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {tile && summary ? (
          <WashHeader group={tile.group} glyph={tile.glyph} summary={summary} />
        ) : null}
        <View style={styles.content}>
          {overview === undefined ? (
            <LoadingSkeleton rows={3} label={t.actions.loading} />
          ) : overview ? (
            <SiteHome
              groupSlug={group.slug}
              today={today}
              hasSources={overview.sources.length > 0}
              connected={shown.some((source) => source.kind !== 'manual')}
              typedMeters={readings ? readings.channels.length : null}
              lastReading={lastReading}
            />
          ) : adding ? (
            <AddressForm groupSlug={group.slug} />
          ) : (
            <Card style={styles.intro}>
              <Text
                accessibilityRole="header"
                style={[TYPE.title3, { color: tokens.ink }]}
              >
                {words.empty.title}
              </Text>
              <Text style={[TYPE.body, { color: tokens.ink }]}>
                {words.empty.body}
              </Text>
              <Text style={[TYPE.subhead, { color: tokens.muted }]}>
                {words.empty.next}
              </Text>
              <Button
                label={words.empty.action}
                group="home"
                onPress={() => setAdding(true)}
                testID="energy-add-first"
              />
            </Card>
          )}
        </View>
      </ScrollView>
    </>
  )
}

/**
 * The home of an address: what to do first, or usage at a glance, then the
 * rows to every Energy screen.
 */
function SiteHome({
  groupSlug,
  today,
  hasSources,
  connected,
  typedMeters,
  lastReading,
}: {
  groupSlug: string
  today: string
  hasSources: boolean
  /** A source other than typed meters feeds the address. */
  connected: boolean
  /** How many meters the Group reads itself; null while loading. */
  typedMeters: number | null
  lastReading: string | null
}) {
  const tokens = useTokens('home')
  const { t, locale } = useI18n()
  const router = useRouter()
  const words = t.energy
  const month = energyMonthOf(today)
  const usage = useQuery(api.energyUsage.month, { groupSlug, month, today })
  const hours = useQuery(
    api.energyUsage.day,
    usage?.hasHourly ? { groupSlug, day: today, today } : 'skip',
  )
  const contracts = useQuery(api.energyContracts.list, { groupSlug })

  if (usage === undefined || typedMeters === null) {
    return <LoadingSkeleton rows={3} label={t.actions.loading} />
  }

  const hourly = usage?.hasHourly ?? false
  const needsFirstReading =
    hasSources && typedMeters === 0 && !hourly && !connected
  const open = (
    path: `/all/energy/${'usage' | 'costs' | 'readings' | 'contract' | 'sources' | 'connect'}`,
  ) => router.push(moduleHref(path))

  const cost = usage?.totals.cost
  const latest = contracts?.[0]?.terms

  return (
    <>
      {!hasSources && !hourly ? (
        <Card style={styles.intro}>
          <Text
            accessibilityRole="header"
            style={[TYPE.title3, { color: tokens.ink }]}
          >
            {words.site.nextTitle}
          </Text>
          <Text style={[TYPE.body, { color: tokens.ink }]}>
            {words.site.nextHomeAssistant}
          </Text>
          <Button
            label={words.site.nextConnect}
            group="home"
            onPress={() => open('/all/energy/connect')}
            testID="energy-connect"
          />
          <Button
            label={words.home.firstReadingAction}
            variant="secondary"
            onPress={() => open('/all/energy/readings')}
            testID="energy-first-reading"
          />
        </Card>
      ) : null}

      {needsFirstReading ? (
        <Card style={styles.intro}>
          <Text
            accessibilityRole="header"
            style={[TYPE.title3, { color: tokens.ink }]}
          >
            {words.home.firstReadingTitle}
          </Text>
          <Text style={[TYPE.body, { color: tokens.ink }]}>
            {words.home.firstReadingBody}
          </Text>
          <Button
            label={words.home.firstReadingAction}
            group="home"
            onPress={() => open('/all/energy/readings')}
            testID="energy-first-reading"
          />
        </Card>
      ) : usage ? (
        <UsageCard
          today={today}
          hourly={hourly}
          usage={usage}
          hours={hours?.hours ?? []}
          onPress={() => open('/all/energy/usage')}
        />
      ) : null}

      <InsetList accessibilityLabel={words.home.navLabel} testID="energy-nav">
        <InsetRow
          key="usage"
          testID="energy-row-usage"
          title={words.home.usage}
          subtitle={
            hourly ? words.home.usageSubHourly : words.home.usageSubDaily
          }
          chevron
          onPress={() => open('/all/energy/usage')}
        />
        <InsetRow
          key="costs"
          testID="energy-row-costs"
          title={words.home.costs}
          subtitle={
            cost && usage?.totals.costStatus === 'ok'
              ? fmt(words.home.costsSub, {
                  amount: formatEnergyEuro(cost.totalCents, locale),
                  month: formatEnergyDate(month, locale, 'month'),
                })
              : words.home.costsSubNone
          }
          chevron
          onPress={() => open('/all/energy/costs')}
        />
        <InsetRow
          key="readings"
          testID="energy-row-readings"
          title={words.home.readings}
          subtitle={
            lastReading
              ? fmt(words.home.readingsSub, { date: lastReading })
              : words.home.readingsSubNone
          }
          chevron
          onPress={() => open('/all/energy/readings')}
        />
        <InsetRow
          key="contract"
          testID="energy-row-contract"
          title={words.home.contract}
          subtitle={
            latest
              ? contractSummary(latest, words, locale)
              : words.home.contractSubNone
          }
          chevron
          onPress={() => open('/all/energy/contract')}
        />
        <InsetRow
          key="sources"
          testID="energy-row-sources"
          title={words.sources.title}
          subtitle={words.sources.homeRowSub}
          chevron
          onPress={() => open('/all/energy/sources')}
        />
      </InsetList>
    </>
  )
}

type MonthUsage = NonNullable<FunctionReturnType<typeof api.energyUsage.month>>

/**
 * Usage at a glance (designs/energy 11.1): today per hour from an hourly
 * source, or this month's estimated days from typed readings. Opens Usage.
 */
function UsageCard({
  today,
  hourly,
  usage,
  hours,
  onPress,
}: {
  today: string
  hourly: boolean
  usage: MonthUsage
  hours: readonly EnergyHourRow[]
  onPress: () => void
}) {
  const tokens = useTokens('home')
  const { t, locale } = useI18n()
  const words = t.energy
  const withSolar = usage.channels.solar
  const month = energyMonthOf(today)

  const chart = hourly
    ? (() => {
        const slots = hourSlots(today, hours, Date.now(), withSolar)
        return {
          title: words.home.hourCard,
          slots,
          sentence: hourChartSentence(slots, today, words, locale),
          ticks: HOUR_TICKS,
        }
      })()
    : (() => {
        const slots = daySlots(usage.days, today, withSolar)
        return {
          title: words.home.dayCard,
          slots,
          sentence: dayChartSentence(slots, month, words, locale),
          ticks: dayTicks(energyMonthDays(month).length),
        }
      })()

  return (
    <Pressable
      testID="energy-usage-card"
      accessibilityRole="button"
      accessibilityLabel={`${chart.title}. ${chart.sentence}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chartCard,
        { backgroundColor: pressed ? tokens.surface2 : tokens.surface },
      ]}
    >
      <View style={styles.chartHead}>
        <Text style={[TYPE.bodyStrong, styles.flex, { color: tokens.ink }]}>
          {chart.title}
        </Text>
        <View style={styles.chartLink}>
          <Text style={[TYPE.footnote, { color: tokens.muted }]}>
            {words.home.openUsage}
          </Text>
          <UI_ICONS.ChevronRight size={14} color={tokens.muted} strokeWidth={2.6} />
        </View>
      </View>
      <EnergyMirrorChart
        testID={hourly ? 'energy-home-hours' : 'energy-home-days'}
        slots={chart.slots}
        upHeight={56}
        downHeight={52}
        label={chart.sentence}
        ticks={chart.ticks}
      />
      {withSolar ? (
        <EnergyChartLegend
          items={[
            { label: words.home.legendUsage, kind: 'fill', colour: tokens.ink },
            {
              label: words.home.legendSolar,
              kind: 'fill',
              colour: energySolarColour(tokens),
            },
          ]}
        />
      ) : null}
      <Text style={[TYPE.subhead, { color: tokens.ink }]}>{chart.sentence}</Text>
      {!hourly && usage.totals.estimated ? (
        <Text style={[TYPE.footnote, { color: tokens.muted }]}>
          {words.usage.estimatedNote}
        </Text>
      ) : null}
    </Pressable>
  )
}

function AddressForm({ groupSlug }: { groupSlug: string }) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const words = t.energy
  const houses = useQuery(api.houses.list, { groupSlug })
  const createSite = useMutation(api.energy.createSite)
  const router = useRouter()
  const [name, setName] = useState(words.form.defaultName)
  const [houseId, setHouseId] = useState<Id<'houses'> | null>(null)
  const [source, setSource] = useState<SourceChoice>('homeAssistant')
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const house = houses?.find((each) => each._id === houseId)

  const submit = async () => {
    const checked = checkEnergySiteName(name)
    if ('problem' in checked) {
      haptics.actionFailed()
      setProblem(words.refusals[checked.problem])
      return
    }
    setSaving(true)
    setProblem(null)
    try {
      await createSite({
        groupSlug,
        name: checked.name,
        houseId: houseId ?? undefined,
        source:
          source === 'manual'
            ? { kind: 'manual', label: words.site.manualSourceLabel }
            : { kind: 'homeAssistant' },
      })
      haptics.itemSaved()
      if (source === 'homeAssistant') {
        router.push(moduleHref('/all/energy/connect'))
      }
    } catch (caught) {
      haptics.actionFailed()
      const code = readEnergyRefusal(caught)
      setProblem(code ? words.refusals[code] : t.common.errors.didNotWork)
      setSaving(false)
    }
  }

  const options: { value: SourceChoice; label: string; hint: string }[] = [
    {
      value: 'homeAssistant',
      label: words.form.homeAssistant,
      hint: words.form.homeAssistantHint,
    },
    { value: 'manual', label: words.form.manual, hint: words.form.manualHint },
  ]

  return (
    <View style={styles.form}>
      <View style={styles.section}>
        <SectionLabel>{words.form.addressHeading}</SectionLabel>
        <Field
          label={words.form.name}
          value={name}
          onChangeText={setName}
          maxLength={ENERGY_LIMITS.siteName}
          autoCapitalize="sentences"
          returnKeyType="done"
          testID="energy-name"
        />
        <MenuView
          testID="energy-house-menu"
          title={words.form.house}
          shouldOpenOnLongPress={false}
          onOpenMenu={() => haptics.menuOpened()}
          actions={[
            {
              id: '',
              title: words.form.houseNone,
              state: houseId === null ? ('on' as const) : ('off' as const),
            },
            ...(houses ?? []).map((each) => ({
              id: each._id,
              title: each.name,
              state: each._id === houseId ? ('on' as const) : ('off' as const),
            })),
          ]}
          onPressAction={({ nativeEvent }) => {
            const picked = houses?.find(
              (each) => each._id === nativeEvent.event,
            )
            setHouseId(picked ? picked._id : null)
          }}
        >
          <View
            accessibilityRole="button"
            accessibilityLabel={`${words.form.house}, ${house?.name ?? words.form.houseNone}`}
            style={[
              styles.picker,
              { backgroundColor: tokens.surface, borderColor: tokens.hair },
            ]}
          >
            <Text style={[TYPE.body, styles.flex, { color: tokens.ink }]}>
              {words.form.house}
            </Text>
            <Text style={[TYPE.body, { color: tokens.muted }]}>
              {house?.name ?? words.form.houseNone}
            </Text>
            <UI_ICONS.ChevronsUpDown size={16} color={tokens.muted} />
          </View>
        </MenuView>
        <Text style={[TYPE.footnote, styles.hint, { color: tokens.muted }]}>
          {words.form.houseHint}
        </Text>
      </View>

      <View style={styles.section}>
        <SectionLabel>{words.form.sourceHeading}</SectionLabel>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={words.form.sourceLabel}
          style={styles.options}
        >
          {options.map((option) => {
            const selected = source === option.value
            return (
              <Pressable
                key={option.value}
                {...radioProps(selected, words.form.sourceRadio)}
                accessibilityLabel={`${option.label}. ${option.hint}`}
                testID={`energy-source-${option.value}`}
                onPress={() => {
                  haptics.selectionChanged()
                  setSource(option.value)
                }}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: tokens.surface,
                    borderColor: selected ? tokens.accent : tokens.hair,
                  },
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
                    <View
                      style={[styles.radioDot, { backgroundColor: tokens.accent }]}
                    />
                  ) : null}
                </View>
                <View style={styles.flex}>
                  <Text style={[TYPE.bodyStrong, { color: tokens.ink }]}>
                    {option.label}
                  </Text>
                  <Text style={[TYPE.footnote, { color: tokens.muted }]}>
                    {option.hint}
                  </Text>
                </View>
              </Pressable>
            )
          })}
        </View>
      </View>

      {problem ? (
        <Text
          accessibilityRole="alert"
          style={[TYPE.subhead, { color: tokens.danger }]}
        >
          {problem}
        </Text>
      ) : null}

      <Button
        label={saving ? words.form.saving : words.form.submit}
        group="home"
        busy={saving}
        onPress={submit}
        testID="energy-submit"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACE[4], gap: SPACE[4] },
  chartCard: {
    borderRadius: RADIUS.card,
    paddingHorizontal: SPACE[4],
    paddingTop: 14,
    paddingBottom: SPACE[3],
    gap: SPACE[2],
  },
  chartHead: { flexDirection: 'row', alignItems: 'baseline', gap: SPACE[2] },
  chartLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  intro: { gap: SPACE[3], paddingVertical: SPACE[4] },
  form: { gap: SPACE[5] },
  section: { gap: SPACE[2] },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[2],
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: RADIUS.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  hint: { paddingHorizontal: 4 },
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
  pressed: { opacity: 0.7 },
})
