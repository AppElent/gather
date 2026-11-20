/**
 * The week menu (designs/meal-planner §1, ADR-0027): one section per day,
 * Monday first, one row per enabled meal slot. Tap a meal for its sheet, an
 * empty slot for Pick. Hold a meal and drag it onto another day to move it
 * there, or to swap with the meal already in that slot.
 *
 * Holding a row opens its context menu everywhere else in the app
 * (DESIGN_SYSTEM). Here the approved design gives the hold to dragging, and
 * the meal sheet's move grid is the accessible path to the same thing.
 */

import { MenuView } from '@expo/ui/community/menu'
import { addDays, localIsoDate, mondayStart } from '@gather/core/civil-date'
import type { MealSlot } from '@gather/core/meal-planner'
import { useMutation } from 'convex/react'
import { router, Stack } from 'expo-router'
import { useCallback, useMemo, useRef, useState } from 'react'
import {
  Animated,
  type HostInstance,
  Pressable,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import {
  Directions,
  Gesture,
  GestureDetector,
  LegacyScrollView as ScrollView,
} from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { api, type Id } from '../../../convex/api'
import { useQuery } from '../../../convex/queries'
import { haptics } from '../../../feedback/haptics'
import { useGroup } from '../../../group/GroupProvider'
import { fmt, plural, useI18n } from '../../../i18n'
import { UI_ICONS } from '../../../theme/icons'
import {
  RADIUS,
  SIZE,
  SPACE,
  TABULAR,
  TYPE,
  useTokens,
} from '../../../theme/tokens'
import { InsetList, InsetRow } from '../../../ui/inset-list'
import { moduleTile } from '../../../ui/module-tile'
import { washScreenOptions } from '../../../ui/screen-header'
import { isAccessibilityTextSize } from '../../../ui/text-scale'
import { useUndoToast } from '../../../ui/undo-toast'
import { WashHeader } from '../../../ui/wash-header'
import { type ModulePath, moduleHref } from '../../moduleDestination'
import { MealGroceriesSheet } from './meal-groceries-sheet'
import { MealSheet } from './meal-sheet'
import { EmptyThumb, MealThumb, MemberCoins } from './parts'
import { PickSheet } from './pick-sheet'
import {
  busyEvent,
  clock,
  daySlots,
  dinnersPlanned,
  eatersOf,
  eatingLabel,
  mealIn,
  mealMeta,
  type PlannedMeal,
  shareText,
  shortDate,
  type WeekData,
  weekdayName,
  weekRange,
} from './week'
import { WeekGroceriesSheet } from './week-groceries-sheet'

/** Eetvoorkeuren, from the bar menu and the button beside Boodschappen. */
const PREFERENCES_PATH: ModulePath = '/all/meal-planner/preferences'

/** The width iOS keeps for its back swipe at the left edge. */
const EDGE_SWIPE = 24

type Sheet =
  | { kind: 'meal'; id: Id<'plannedDinners'> }
  | {
      kind: 'pick'
      date: string
      slot: MealSlot
      /** Something else: the meal Pick replaces, keeping its servings. */
      replacing?: Id<'plannedDinners'>
    }
  /** The week's ingredients onto the grocery list (APP-321). */
  | { kind: 'groceries' }
  /** One meal's Recipe onto the grocery list, at its servings (APP-421). */
  | { kind: 'meal-groceries'; recipeId: string; servings: number }

interface Drag {
  meal: PlannedMeal
  /** The lifted row's place in the screen root, for the floating copy. */
  top: number
  height: number
  /** Each day section's top and height in the window. */
  days: Map<string, { y: number; height: number }>
}

export function MealPlannerScreen() {
  const { group } = useGroup()
  const { t, locale } = useI18n()
  const words = t.mealPlanner
  const tokens = useTokens('kitchen')
  // At the accessibility sizes the words need the whole row.
  const bare = isAccessibilityTextSize(useWindowDimensions().fontScale)
  const insets = useSafeAreaInsets()
  const tile = moduleTile('meal-planner')
  const [weekStart, setWeekStart] = useState(() => mondayStart(localIsoDate()))
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const { show: showToast, toast } = useUndoToast()
  const from = weekStart
  const to = addDays(weekStart, 6)
  const data = useQuery(api.mealPlan.week, {
    groupSlug: group.slug,
    from,
    to,
  })
  const move = useMutation(api.mealPlan.move)
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  )

  const goWeek = useCallback(
    (step: number) => setWeekStart((start) => addDays(start, step * 7)),
    [],
  )
  // A fling across the week turns it, like the round buttons. Vertical
  // scrolling is untouched: a fling only fires on a horizontal flick.
  const fling = useMemo(
    () =>
      Gesture.Race(
        Gesture.Fling()
          .runOnJS(true)
          .direction(Directions.LEFT)
          .onStart(() => goWeek(1)),
        Gesture.Fling()
          .runOnJS(true)
          .direction(Directions.RIGHT)
          // A swipe from the very edge is the system's back gesture.
          .hitSlop({ left: -EDGE_SWIPE })
          .onStart(() => goWeek(-1)),
      ),
    [goWeek],
  )

  // Dragging a meal between days. The lifted row is drawn again, floating,
  // over the screen, because the inset list clips what leaves its corners.
  const rootRef = useRef<HostInstance>(null)
  const scrollRef = useRef<ScrollView>(null)
  const dayRefs = useRef(new Map<string, HostInstance | null>())
  const rowRefs = useRef(new Map<string, HostInstance | null>())
  const lift = useRef(new Animated.Value(0)).current
  const [drag, setDrag] = useState<Drag | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const live = useRef({ drag, hover, data })
  live.current = { drag, hover, data }

  const dropTarget = (meal: PlannedMeal, date: string | null) => {
    const week = live.current.data
    if (!week || !date || date === meal.date) return null
    return daySlots(week.preferences, date, week.meals).includes(meal.slot)
      ? date
      : null
  }

  const handlers = useRef({
    begin: (_meal: PlannedMeal) => {},
    move: (_dy: number, _y: number) => {},
    end: (_commit: boolean) => {},
  })
  // Measuring answers later; a finger lifted before then is not a drag.
  const pressing = useRef(false)
  handlers.current = {
    begin: (meal) => {
      const root = rootRef.current
      const row = rowRefs.current.get(meal._id)
      if (!root || !row) return
      pressing.current = true
      root.measureInWindow((_rx, rootY) => {
        row.measureInWindow((_x, y, _w, height) => {
          if (!pressing.current) return
          const bounds = new Map<string, { y: number; height: number }>()
          for (const [date, view] of dayRefs.current)
            view?.measureInWindow((_dx, dy, _dw, dh) =>
              bounds.set(date, { y: dy, height: dh }),
            )
          lift.setValue(0)
          setDrag({ meal, top: y - rootY, height, days: bounds })
          setHover(meal.date)
          haptics.selectionChanged()
        })
      })
    },
    move: (dy, y) => {
      lift.setValue(dy)
      const current = live.current.drag
      if (!current) return
      let over: string | null = null
      for (const [date, box] of current.days)
        if (y >= box.y && y <= box.y + box.height) over = date
      if (over && over !== live.current.hover) {
        setHover(over)
        haptics.selectionChanged()
      }
    },
    end: (commit) => {
      pressing.current = false
      const current = live.current.drag
      const target =
        current && commit ? dropTarget(current.meal, live.current.hover) : null
      setDrag(null)
      setHover(null)
      lift.setValue(0)
      if (!current || !target) return
      move({
        groupSlug: group.slug,
        id: current.meal._id,
        date: target,
        slot: current.meal.slot,
      })
        .then(() => haptics.itemSaved())
        .catch(() => {
          haptics.actionFailed()
          showToast({ message: words.failed })
        })
    },
  }

  const planned = data ? dinnersPlanned(data.meals, weekStart) : 0
  const memberCount = data?.members.length ?? 0
  const dragTarget = drag ? dropTarget(drag.meal, hover) : null

  const share = () => {
    if (!data) return
    Share.share({ message: shareText(data, weekStart, words, locale) }).catch(
      () => {},
    )
  }
  const openPreferences = () => {
    router.push(moduleHref(PREFERENCES_PATH))
  }

  return (
    <View ref={rootRef} collapsable={false} style={styles.root}>
      <Stack.Screen
        options={{
          ...washScreenOptions(t.modules.byId['meal-planner'].label),
          // iOS 26 pops on a swipe anywhere; here a sideways swipe changes the
          // week, so only the edge swipe goes back.
          fullScreenGestureEnabled: false,
          headerRight: () => (
            <MenuView
              testID="meal-planner-menu"
              actions={[
                {
                  id: 'preferences',
                  title: words.preferences,
                  image: 'slider.horizontal.3' as const,
                },
                {
                  id: 'share',
                  title: words.share,
                  image: 'square.and.arrow.up' as const,
                },
              ]}
              onPressAction={({ nativeEvent }) => {
                if (nativeEvent.event === 'preferences') openPreferences()
                if (nativeEvent.event === 'share') share()
              }}
            >
              <View
                accessible
                accessibilityRole="button"
                accessibilityLabel={words.more}
                style={styles.headerButton}
              >
                <UI_ICONS.Ellipsis
                  size={22}
                  color={tokens.ink}
                  strokeWidth={2.2}
                />
              </View>
            </MenuView>
          ),
        }}
      />
      <GestureDetector gesture={fling}>
        <ScrollView
          ref={scrollRef}
          testID="meal-planner-scroll"
          contentInsetAdjustmentBehavior="automatic"
          scrollEnabled={drag === null}
          style={{ backgroundColor: tokens.ground }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 72 }}
        >
          {tile ? (
            <WashHeader
              group={tile.group}
              glyph={tile.glyph}
              summary={{
                count: plural(locale, planned, words.summary),
                scope: data
                  ? plural(locale, memberCount, words.people)
                  : undefined,
              }}
            />
          ) : null}
          <View style={styles.content}>
            <View style={styles.weekRow}>
              <RoundButton
                label={words.previousWeek}
                testID="meal-planner-previous"
                onPress={() => goWeek(-1)}
              >
                <UI_ICONS.ChevronLeft
                  size={20}
                  color={tokens.ink}
                  strokeWidth={2.2}
                />
              </RoundButton>
              <View
                accessible
                accessibilityRole="header"
                accessibilityLabel={fmt(words.weekLabel, {
                  range: weekRange(weekStart, locale),
                })}
                style={[styles.weekPill, { backgroundColor: tokens.surface }]}
              >
                <Text
                  testID="meal-planner-week"
                  maxFontSizeMultiplier={2}
                  style={[styles.weekText, { color: tokens.ink }]}
                >
                  {weekRange(weekStart, locale)}
                </Text>
              </View>
              <RoundButton
                label={words.nextWeek}
                testID="meal-planner-next"
                onPress={() => goWeek(1)}
              >
                <UI_ICONS.ChevronRight
                  size={20}
                  color={tokens.ink}
                  strokeWidth={2.2}
                />
              </RoundButton>
            </View>

            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                testID="meal-planner-groceries"
                disabled={!data}
                onPress={() => setSheet({ kind: 'groceries' })}
                style={({ pressed }) => [
                  styles.pill,
                  { backgroundColor: tokens.surface },
                  pressed && styles.pressed,
                ]}
              >
                <UI_ICONS.Cart size={18} color={tokens.ink} strokeWidth={2} />
                <Text
                  maxFontSizeMultiplier={2}
                  style={[styles.pillLabel, { color: tokens.ink }]}
                >
                  {words.groceries}
                </Text>
              </Pressable>
              <RoundButton
                label={words.preferences}
                testID="meal-planner-preferences"
                onPress={openPreferences}
                size={SIZE.hitMin}
              >
                <UI_ICONS.Sliders
                  size={18}
                  color={tokens.ink}
                  strokeWidth={2}
                />
              </RoundButton>
            </View>

            {data
              ? days.map((date) => (
                  <View
                    key={date}
                    ref={(view) => {
                      dayRefs.current.set(date, view)
                    }}
                    collapsable={false}
                  >
                    <Day
                      date={date}
                      data={data}
                      target={dragTarget === date}
                      dragging={drag?.meal._id ?? null}
                      rowRef={(id, view) => rowRefs.current.set(id, view)}
                      onDrag={handlers}
                      onOpen={(meal) => setSheet({ kind: 'meal', id: meal._id })}
                      onPick={(slot) => setSheet({ kind: 'pick', date, slot })}
                    />
                  </View>
                ))
              : null}

            {data && data.meals.length > 0 ? (
              <Text style={[styles.footnote, { color: tokens.muted }]}>
                {words.dragHint}
              </Text>
            ) : null}
          </View>
        </ScrollView>
      </GestureDetector>

      {drag ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ghost,
            {
              top: drag.top,
              minHeight: drag.height,
              backgroundColor: tokens.surface,
              shadowColor: tokens.ink,
              transform: [{ translateY: lift }],
            },
          ]}
        >
          {bare ? null : (
            <MealThumb
              imageUrl={drag.meal.imageUrl}
              quick={!drag.meal.recipeId}
            />
          )}
          <View style={styles.ghostText}>
            <Text style={[styles.slotLabel, { color: tokens.muted }]}>
              {words.slots[drag.meal.slot]}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.mealTitle, { color: tokens.ink }]}
            >
              {drag.meal.title}
            </Text>
          </View>
        </Animated.View>
      ) : null}

      {data && sheet?.kind === 'meal' ? (
        <MealSheet
          key={sheet.id}
          id={sheet.id}
          data={data}
          weekStart={weekStart}
          onClose={() => setSheet(null)}
          onSomethingElse={(meal) =>
            setSheet({
              kind: 'pick',
              date: meal.date,
              slot: meal.slot,
              replacing: meal._id,
            })
          }
          onGroceries={(meal, servings) =>
            meal.recipeId &&
            setSheet({
              kind: 'meal-groceries',
              recipeId: meal.recipeId,
              servings,
            })
          }
          showToast={showToast}
        />
      ) : null}
      {sheet?.kind === 'meal-groceries' ? (
        <MealGroceriesSheet
          key={sheet.recipeId}
          recipeId={sheet.recipeId}
          weekStart={weekStart}
          servings={sheet.servings}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {data && sheet?.kind === 'pick' ? (
        <PickSheet
          key={`${sheet.date}-${sheet.slot}`}
          date={sheet.date}
          slot={sheet.slot}
          replacing={sheet.replacing}
          week={data}
          onClose={() => setSheet(null)}
          onFailed={() => showToast({ message: words.failed })}
        />
      ) : null}
      {data && sheet?.kind === 'groceries' ? (
        <WeekGroceriesSheet
          key={weekStart}
          data={data}
          weekStart={weekStart}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {toast}
    </View>
  )
}

function Day({
  date,
  data,
  target,
  dragging,
  rowRef,
  onDrag,
  onOpen,
  onPick,
}: {
  date: string
  data: WeekData
  target: boolean
  dragging: string | null
  rowRef: (id: string, view: HostInstance | null) => void
  onDrag: React.RefObject<{
    begin: (meal: PlannedMeal) => void
    move: (dy: number, y: number) => void
    end: (commit: boolean) => void
  }>
  onOpen: (meal: PlannedMeal) => void
  onPick: (slot: MealSlot) => void
}) {
  const { t, locale } = useI18n()
  const words = t.mealPlanner
  const tokens = useTokens('kitchen')
  // At the accessibility sizes the words need the whole row.
  const bare = isAccessibilityTextSize(useWindowDimensions().fontScale)
  const slots = daySlots(data.preferences, date, data.meals)
  const dinner = mealIn(data.meals, date, 'dinner')
  const eaters = eatersOf(data, date, 'dinner', dinner?.eaterIds)
  const busy = busyEvent(data.events, date)

  return (
    <View style={styles.day} testID={`meal-day-${date}`}>
      {/* One line, the busy pill truncating, until the accessibility sizes;
          then the heading wraps and the coins move under it. */}
      <View style={[styles.dayHeading, bare && styles.dayHeadingWrap]}>
        <Text accessibilityRole="header" style={styles.dayTitle}>
          <Text style={[styles.weekday, { color: tokens.ink }]}>
            {weekdayName(date, locale)}
          </Text>
          <Text style={[styles.date, { color: tokens.muted }]}>
            {`  ${shortDate(date, locale)}`}
          </Text>
        </Text>
        {busy ? (
          <View
            accessible
            accessibilityLabel={fmt(words.busyLabel, {
              title: busy.title,
              time: clock(busy.startMinutes),
            })}
            style={[styles.busy, { backgroundColor: tokens.surface2 }]}
          >
            <UI_ICONS.Calendar size={13} color={tokens.muted} strokeWidth={2} />
            {/* A long title gives way; the time always shows. */}
            <Text
              numberOfLines={1}
              style={[styles.busyText, { color: tokens.ink }]}
            >
              {busy.title}
            </Text>
            <Text style={[styles.busyTime, { color: tokens.ink }]}>
              {clock(busy.startMinutes)}
            </Text>
          </View>
        ) : null}
        <View style={styles.spacer} />
        {data.members.length > 1 ? (
          <MemberCoins
            members={data.members}
            eaters={eaters}
            label={eatingLabel(data.members, eaters, words, locale)}
          />
        ) : null}
      </View>
      <InsetList
        style={
          target
            ? {
                borderWidth: 2,
                borderColor: tokens.tintOf('kitchen').text,
              }
            : undefined
        }
      >
        {slots.map((slot) => {
          const meal = mealIn(data.meals, date, slot)
          if (!meal)
            return (
              <InsetRow
                key={slot}
                testID={`meal-empty-${date}-${slot}`}
                onPress={() => onPick(slot)}
                accessibilityLabel={`${words.slots[slot]}, ${words.choose[slot]}`}
                leading={bare ? undefined : <EmptyThumb />}
              >
                <Text style={[styles.slotLabel, { color: tokens.muted }]}>
                  {words.slots[slot]}
                </Text>
                <Text
                  style={[
                    styles.mealTitle,
                    { color: tokens.tintOf('kitchen').text },
                  ]}
                >
                  {words.choose[slot]}
                </Text>
              </InsetRow>
            )
          return (
            <MealRow
              key={slot}
              meal={meal}
              meta={mealMeta(meal, data, words, locale)}
              lifted={dragging === meal._id}
              rowRef={rowRef}
              onDrag={onDrag}
              onOpen={onOpen}
            />
          )
        })}
      </InsetList>
    </View>
  )
}

function MealRow({
  meal,
  meta,
  lifted,
  rowRef,
  onDrag,
  onOpen,
}: {
  meal: PlannedMeal
  meta: string
  lifted: boolean
  rowRef: (id: string, view: HostInstance | null) => void
  onDrag: React.RefObject<{
    begin: (meal: PlannedMeal) => void
    move: (dy: number, y: number) => void
    end: (commit: boolean) => void
  }>
  onOpen: (meal: PlannedMeal) => void
}) {
  const { t } = useI18n()
  const words = t.mealPlanner
  const tokens = useTokens('kitchen')
  // At the accessibility sizes the words need the whole row.
  const bare = isAccessibilityTextSize(useWindowDimensions().fontScale)
  const latest = useRef(meal)
  latest.current = meal
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activateAfterLongPress(350)
        .onStart(() => onDrag.current.begin(latest.current))
        .onUpdate((event) =>
          onDrag.current.move(event.translationY, event.absoluteY),
        )
        // A drag the system cancelled (a call, the app going away) puts the
        // meal back where it was.
        .onFinalize((_event, success) => onDrag.current.end(success)),
    [onDrag],
  )
  return (
    <GestureDetector gesture={gesture}>
      <View
        ref={(view) => rowRef(meal._id, view)}
        collapsable={false}
        style={lifted ? styles.lifted : undefined}
      >
        <InsetRow
          testID={`meal-${meal.date}-${meal.slot}`}
          onPress={() => onOpen(meal)}
          accessibilityLabel={`${words.slots[meal.slot]}, ${meal.title}, ${meta}`}
          leading={
            bare ? undefined : (
              <MealThumb imageUrl={meal.imageUrl} quick={!meal.recipeId} />
            )
          }
          chevron
        >
          <Text style={[styles.slotLabel, { color: tokens.muted }]}>
            {words.slots[meal.slot]}
          </Text>
          <Text style={[styles.mealTitle, { color: tokens.ink }]}>
            {meal.title}
          </Text>
          <Text style={[styles.meta, { color: tokens.muted }]}>{meta}</Text>
        </InsetRow>
      </View>
    </GestureDetector>
  )
}

/** 36 pt visual, 44 pt hit. */
function RoundButton({
  label,
  testID,
  onPress,
  children,
  size = 36,
}: {
  label: string
  testID: string
  onPress: () => void
  children: React.ReactNode
  size?: number
}) {
  const tokens = useTokens()
  const slop = Math.max(0, (SIZE.hitMin - size) / 2)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      hitSlop={slop}
      onPress={onPress}
      style={({ pressed }) => [
        styles.round,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: tokens.surface,
        },
        pressed && styles.pressed,
      ]}
    >
      {children}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: SPACE[4], gap: SPACE[4] },
  headerButton: { padding: 6 },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE[3],
    marginTop: -SPACE[2],
  },
  weekPill: {
    flexShrink: 1,
    minHeight: 36,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACE[4],
    paddingVertical: SPACE[1],
    justifyContent: 'center',
  },
  weekText: { ...TYPE.bodyStrong, ...TABULAR, textAlign: 'center' },
  round: { flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: SPACE[2] },
  pill: {
    minHeight: SIZE.hitMin,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE[2],
    paddingHorizontal: SPACE[4],
  },
  pillLabel: { ...TYPE.bodyStrong },
  pressed: { opacity: 0.7 },
  day: { gap: SPACE[2] },
  dayHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[2],
    paddingHorizontal: SPACE[1],
  },
  dayHeadingWrap: { flexWrap: 'wrap' },
  dayTitle: { flexShrink: 0 },
  weekday: { ...TYPE.cardLabel },
  date: { ...TYPE.subhead },
  busy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[1],
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACE[2],
    paddingVertical: 2,
    flexShrink: 1,
  },
  busyText: { ...TYPE.footnoteStrong, flexShrink: 1 },
  busyTime: { ...TYPE.footnoteStrong, ...TABULAR },
  spacer: { flex: 1 },
  slotLabel: { ...TYPE.footnoteStrong },
  mealTitle: { ...TYPE.bodyStrong },
  meta: { ...TYPE.footnote },
  footnote: { ...TYPE.footnote, paddingHorizontal: SPACE[1] },
  lifted: { opacity: 0.35 },
  ghost: {
    position: 'absolute',
    left: SPACE[4],
    right: SPACE[4],
    borderRadius: RADIUS.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[3],
    paddingHorizontal: SPACE[4],
    paddingVertical: SPACE[2],
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  ghostText: { flex: 1, gap: 2 },
})
