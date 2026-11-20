/**
 * Plan mijn week's start sheet (designs/meal-planner §3, direction A): which
 * days to fill, which slots, an optional wish, what Gather takes into
 * account, and one button that asks for a proposal. Over the day's cap of
 * slimme acties it shows the Limit card instead of the form, and Zelf kiezen
 * opens Pick.
 */
import { localIsoDate } from '@gather/core/civil-date'
import type { MealSlot } from '@gather/core/meal-planner'
import { WEEK_PLAN_WISHES, type WeekPlanWish, WISH_MAX } from '@gather/core/week-plan'
import { useAction, useConvexConnectionState } from 'convex/react'
import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { NativeSheet } from '../../../components/NativeSheet'
import { api } from '../../../convex/api'
import { useQuery } from '../../../convex/queries'
import { haptics } from '../../../feedback/haptics'
import { useGroup } from '../../../group/GroupProvider'
import { fmt, plural, useI18n } from '../../../i18n'
import { UI_ICONS } from '../../../theme/icons'
import { RADIUS, SIZE, SPACE, TYPE, useTokens } from '../../../theme/tokens'
import { InsetList, InsetRow } from '../../../ui/inset-list'
import { Chip } from './parts'
import { type WeekData, weekRange } from './week'
import {
  defaultPlanSlots,
  emptyTargets,
  type PlanUse,
  planDays,
  planSlotChoices,
  planUses,
  slotChipLabel,
} from './week-plan'

export type PlanOutcome =
  | {
      status: 'ai' | 'fallback'
      count: number
      /** What the plan was asked with, for Ander voorstel (APP-460). */
      wishes: WeekPlanWish[]
      wish?: string
    }
  | { status: 'empty' }

const USE_ICONS: Record<PlanUse['kind'], (typeof UI_ICONS)[keyof typeof UI_ICONS]> = {
  preferences: UI_ICONS.Sliders,
  calendar: UI_ICONS.Calendar,
  eaters: UI_ICONS.Users,
  stock: UI_ICONS.House,
}

export function PlanSheet({
  weekStart,
  data,
  onClose,
  onPlanned,
  onChooseYourself,
  onPreferences,
}: {
  weekStart: string
  data: WeekData
  onClose: () => void
  onPlanned: (outcome: PlanOutcome) => void
  /** Zelf kiezen from the Limit card: Pick for the first empty slot. */
  onChooseYourself: (date: string, slot: MealSlot) => void
  onPreferences: () => void
}) {
  const { group } = useGroup()
  const { t, locale } = useI18n()
  const words = t.mealPlanner
  const plan = words.plan
  const tokens = useTokens('kitchen')
  const tint = tokens.tintOf('kitchen')
  const usage = useQuery(api.aiUsage.today, {})
  const staples = useQuery(api.groceryStaples.list, { groupSlug: group.slug })
  const propose = useAction(api.mealPlanDrafts.propose)
  const online = useConvexConnectionState().isWebSocketConnected

  const choices = useMemo(() => planSlotChoices(data.preferences), [data.preferences])
  const [slots, setSlots] = useState<MealSlot[]>(() => defaultPlanSlots(choices))
  const [flipped, setFlipped] = useState<ReadonlySet<string>>(new Set())
  const [wish, setWish] = useState('')
  const [wishes, setWishes] = useState<WeekPlanWish[]>([])
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const [overCap, setOverCap] = useState(false)

  const today = localIsoDate()
  const days = planDays(weekStart, data, choices, slots, flipped, today)
  const fillDates = days.filter((day) => day.state === 'fill').map((day) => day.date)
  const targets = emptyTargets(data, choices, slots, fillDates)
  const lowNames = (staples?.staples ?? []).filter((s) => s.low).map((s) => s.name)
  const stockNames = (staples?.staples ?? []).filter((s) => !s.low).map((s) => s.name)
  const uses = planUses({
    data,
    dates: fillDates,
    lowNames,
    stockNames,
    words,
    prefWords: t.mealPreferences,
    locale,
  })
  const limited = overCap || usage?.left === 0
  const wishChips = WEEK_PLAN_WISHES.filter((key) => key !== 'useLow' || lowNames.length > 0)

  const toggleDay = (date: string) =>
    setFlipped((current) => {
      const next = new Set(current)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })

  const submit = () => {
    if (busy || targets.length === 0) return
    setBusy(true)
    setFailed(null)
    const asked = {
      wishes,
      wish: wish.trim() ? wish.trim().slice(0, WISH_MAX) : undefined,
    }
    propose({
      groupSlug: group.slug,
      weekStart,
      dates: fillDates,
      slots,
      locale,
      ...asked,
    })
      .then((result) => {
        if (result.status === 'limit') {
          haptics.actionFailed()
          setOverCap(true)
          return
        }
        if (result.status === 'empty' || result.count === 0) haptics.actionFailed()
        else haptics.itemSaved()
        onPlanned(result.status === 'empty' ? result : { ...result, ...asked })
      })
      .catch(() => {
        haptics.actionFailed()
        setFailed(plan.failed)
      })
      .finally(() => setBusy(false))
  }

  const firstEmpty = () => {
    const [first] = emptyTargets(
      data,
      choices,
      choices.map((choice) => choice.slot),
      days.filter((day) => day.date >= today).map((day) => day.date),
    )
    return first ?? { date: today < weekStart ? weekStart : today, slot: 'dinner' as const }
  }

  return (
    <NativeSheet
      title={plan.title}
      subtitle={fmt(plan.subhead, { range: weekRange(weekStart, locale) })}
      onClose={onClose}
      maxHeight={0.92}
      fill
      background="ground"
    >
      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.body}
        testID="plan-sheet"
      >
        {limited ? (
          <LimitCard
            used={usage?.used ?? usage?.limit ?? 0}
            limit={usage?.limit ?? 0}
            testID="plan-limit"
            onChooseYourself={() => {
              const target = firstEmpty()
              onChooseYourself(target.date, target.slot)
            }}
          />
        ) : (
          <>
            <View style={styles.section}>
              <Text accessibilityRole="header" style={[styles.heading, { color: tokens.muted }]}>
                {plan.days}
              </Text>
              <View style={[styles.card, { backgroundColor: tokens.surface }]}>
                <View style={styles.grid}>
                  {days.map((day, index) => {
                    const short = t.mealPreferences.dayShort[index]
                    const planned = day.state === 'planned'
                    const on = day.state === 'fill'
                    return (
                      <Pressable
                        key={day.date}
                        testID={`plan-day-${day.date}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on, disabled: planned }}
                        accessibilityLabel={fmt(
                          planned
                            ? plan.dayPlannedLabel
                            : on
                              ? plan.dayFillLabel
                              : plan.daySkipLabel,
                          { day: short },
                        )}
                        disabled={planned}
                        onPress={() => {
                          haptics.selectionChanged()
                          toggleDay(day.date)
                        }}
                        style={({ pressed }) => [
                          styles.day,
                          {
                            backgroundColor: planned
                              ? tokens.surface2
                              : on
                                ? tokens.ink
                                : tokens.ground,
                          },
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text
                          maxFontSizeMultiplier={1.4}
                          style={[
                            styles.dayName,
                            { color: planned ? tokens.muted : on ? tokens.onInk : tokens.ink },
                          ]}
                        >
                          {short}
                        </Text>
                        <Text
                          maxFontSizeMultiplier={1.2}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          style={[
                            styles.dayState,
                            { color: planned ? tokens.muted : on ? tokens.onInk : tokens.ink },
                          ]}
                        >
                          {planned ? plan.dayPlanned : on ? plan.dayFill : plan.daySkip}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
                {choices.length > 1 ? (
                  <View style={styles.chips}>
                    {choices.map((choice) => (
                      <Chip
                        key={choice.slot}
                        label={slotChipLabel(choice, words, t.mealPreferences)}
                        on={slots.includes(choice.slot)}
                        testID={`plan-slot-${choice.slot}`}
                        onPress={() =>
                          setSlots((current) =>
                            current.includes(choice.slot)
                              ? current.filter((slot) => slot !== choice.slot)
                              : [...current, choice.slot],
                          )
                        }
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.heading, { color: tokens.muted }]}>{plan.wish}</Text>
              <TextInput
                testID="plan-wish"
                value={wish}
                onChangeText={setWish}
                maxLength={WISH_MAX}
                placeholder={plan.wishPlaceholder}
                placeholderTextColor={tokens.muted}
                accessibilityLabel={plan.wish}
                returnKeyType="done"
                style={[styles.wish, { backgroundColor: tokens.surface, color: tokens.ink }]}
              />
              <View style={styles.chips}>
                {wishChips.map((key) => (
                  <Chip
                    key={key}
                    label={fmt(plan.wishes[key], {
                      item: (lowNames[0] ?? '').toLocaleLowerCase(locale),
                    })}
                    on={wishes.includes(key)}
                    testID={`plan-wish-${key}`}
                    onPress={() =>
                      setWishes((current) =>
                        current.includes(key)
                          ? current.filter((entry) => entry !== key)
                          : [...current, key],
                      )
                    }
                  />
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text accessibilityRole="header" style={[styles.heading, { color: tokens.muted }]}>
                {plan.uses}
              </Text>
              <InsetList>
                {uses.map((use) => {
                  const Icon = USE_ICONS[use.kind]
                  const link = use.kind === 'preferences'
                  return (
                    <InsetRow
                      key={use.kind}
                      testID={`plan-use-${use.kind}`}
                      title={use.label}
                      subtitle={use.sub}
                      accessibilityRole={link ? 'button' : 'none'}
                      onPress={link ? onPreferences : undefined}
                      leading={
                        <View style={[styles.useTile, { backgroundColor: tokens.surface2 }]}>
                          <Icon size={16} color={tokens.ink} strokeWidth={2.2} />
                        </View>
                      }
                      trailing={
                        link ? (
                          <Text style={[styles.subhead, { color: tint.text }]}>
                            {plan.adjust}
                          </Text>
                        ) : undefined
                      }
                    />
                  )
                })}
              </InsetList>
            </View>

            <View style={styles.section}>
              {failed ? (
                <Text accessibilityLiveRegion="polite" style={[styles.footnote, styles.center, { color: tokens.danger }]}>
                  {failed}
                </Text>
              ) : null}
              <PrimaryButton
                label={
                  !online
                    ? plan.offline
                    : busy
                      ? plan.working
                      : fillDates.length === 0
                        ? plan.ctaNothing
                        : plural(locale, fillDates.length, plan.cta)
                }
                testID="plan-submit"
                spark
                busy={busy}
                disabled={!online || targets.length === 0}
                onPress={submit}
                minHeight={50}
              />
              {usage ? (
                <Text style={[styles.footnote, styles.center, { color: tokens.muted }]}>
                  {fmt(plan.cost, { left: usage.left, limit: usage.limit })}
                </Text>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
    </NativeSheet>
  )
}

/**
 * The Limit card (designs/meal-planner, Limit): the day's slimme acties are
 * used, Zelf kiezen opens Pick. Plan mijn week and Iets anders share it.
 */
export function LimitCard({
  used,
  limit,
  testID,
  onChooseYourself,
}: {
  used: number
  limit: number
  testID: string
  onChooseYourself: () => void
}) {
  const { t } = useI18n()
  const plan = t.mealPlanner.plan
  const tokens = useTokens('kitchen')
  return (
    <View
      accessibilityRole="alert"
      testID={testID}
      style={[styles.card, styles.limit, { backgroundColor: tokens.surface }]}
    >
      <View style={styles.limitTitleRow}>
        <UI_ICONS.Clock size={20} color={tokens.ink} strokeWidth={2.2} />
        <Text style={[styles.limitTitle, { color: tokens.ink }]}>{plan.limitTitle}</Text>
      </View>
      <Text style={[styles.subhead, { color: tokens.ink }]}>
        {fmt(plan.limitBody, { used, limit })}
      </Text>
      <Text style={[styles.footnote, { color: tokens.muted }]}>{plan.limitHint}</Text>
      <PrimaryButton
        label={plan.chooseYourself}
        testID={`${testID}-choose-yourself`}
        onPress={onChooseYourself}
      />
    </View>
  )
}

/** The kitchen's primary pill: `kitchen` fill, its own label colour. */
export function PrimaryButton({
  label,
  testID,
  onPress,
  disabled = false,
  busy = false,
  spark = false,
  minHeight = SIZE.hitMin,
  accessibilityLabel,
  grow = false,
}: {
  label: string
  testID: string
  onPress: () => void
  disabled?: boolean
  busy?: boolean
  spark?: boolean
  minHeight?: number
  accessibilityLabel?: string
  grow?: boolean
}) {
  const tokens = useTokens('kitchen')
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      testID={testID}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primary,
        { minHeight },
        grow && styles.grow,
        { backgroundColor: tokens.accent },
        (disabled || busy) && styles.inert,
        pressed && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={tokens.onAccent} />
      ) : spark ? (
        <UI_ICONS.Spark size={18} color={tokens.onAccent} strokeWidth={2} />
      ) : null}
      <Text
        maxFontSizeMultiplier={2}
        style={[styles.primaryLabel, { color: tokens.onAccent }]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  body: { gap: SPACE[5], paddingTop: SPACE[4], paddingBottom: SPACE[6] },
  section: { gap: SPACE[2] },
  heading: { ...TYPE.footnoteStrong, paddingHorizontal: SPACE[1] },
  card: { borderRadius: RADIUS.card, borderCurve: 'continuous', padding: SPACE[3], gap: SPACE[3] },
  grid: { flexDirection: 'row', gap: SPACE[1] },
  day: {
    flex: 1,
    minHeight: 56,
    borderRadius: 14,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 2,
  },
  dayName: { ...TYPE.subhead, fontWeight: '700' },
  // The board's 11 pt has no token; the smallest one shrinks to fit.
  dayState: { ...TYPE.footnoteStrong },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE[2] },
  wish: {
    ...TYPE.body,
    minHeight: SIZE.rowMin,
    borderRadius: RADIUS.card,
    borderCurve: 'continuous',
    paddingHorizontal: SPACE[4],
  },
  useTile: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.tileS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  limit: { padding: SPACE[4] },
  limitTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE[2] },
  limitTitle: { ...TYPE.bodyStrong, flexShrink: 1 },
  subhead: { ...TYPE.subhead },
  footnote: { ...TYPE.footnote, paddingHorizontal: SPACE[1] },
  center: { textAlign: 'center' },
  primary: {
    minHeight: SIZE.hitMin,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE[2],
    paddingHorizontal: SPACE[4],
  },
  grow: { flexGrow: 1 },
  primaryLabel: { ...TYPE.bodyStrong, flexShrink: 1, textAlign: 'center' },
  inert: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
})
