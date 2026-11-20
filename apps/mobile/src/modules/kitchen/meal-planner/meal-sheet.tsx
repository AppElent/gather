/**
 * One planned meal (designs/meal-planner §1, Meal sheet): who eats along,
 * servings, a move grid for the week, a note, and the meal's actions.
 *
 * Changes apply when the sheet closes, by Done, the close button or a drag
 * down, so a note half typed is never lost. Remove applies at once and offers
 * an undo instead of asking first.
 */
import { addDays, localMidnight } from '@gather/core/civil-date'
import { useMutation } from 'convex/react'
import { router } from 'expo-router'
import { useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'

import { NativeSheet } from '../../../components/NativeSheet'
import { api, type Id } from '../../../convex/api'
import { haptics } from '../../../feedback/haptics'
import { useGroup } from '../../../group/GroupProvider'
import { fmt, useI18n } from '../../../i18n'
import { UI_ICONS } from '../../../theme/icons'
import { RADIUS, SIZE, SPACE, TABULAR, TYPE, useTokens } from '../../../theme/tokens'
import { InsetList, InsetRow } from '../../../ui/inset-list'
import { moduleHref } from '../../moduleDestination'
import { Coin } from './parts'
import {
  awayAt,
  clock,
  daySlots,
  dayTitle,
  eatersOf,
  joinNames,
  mealIn,
  type PlannedMeal,
  servingsOf,
  type WeekData,
  weekdayInText,
  weekdayName,
} from './week'

const MAX_SERVINGS = 50
const MAX_NOTE = 500

type Toast = (toast: {
  message: string
  undo?: { label: string; onPress: () => void }
}) => void

const sameList = (a: readonly string[] | undefined, b: readonly string[] | undefined) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

export function MealSheet({
  id,
  data,
  weekStart,
  onClose,
  onSomethingElse,
  onGroceries,
  showToast,
}: {
  id: Id<'plannedDinners'>
  data: WeekData
  weekStart: string
  onClose: () => void
  onSomethingElse: (meal: PlannedMeal) => void
  onGroceries: (meal: PlannedMeal, servings: number) => void
  showToast: Toast
}) {
  const meal = data.meals.find((each) => each._id === id)
  // Removed from another phone while open: there is nothing left to show.
  if (!meal) return null
  return (
    <MealSheetBody
      meal={meal}
      data={data}
      weekStart={weekStart}
      onClose={onClose}
      onSomethingElse={onSomethingElse}
      onGroceries={onGroceries}
      showToast={showToast}
    />
  )
}

function MealSheetBody({
  meal,
  data,
  weekStart,
  onClose,
  onSomethingElse,
  onGroceries,
  showToast,
}: {
  meal: PlannedMeal
  data: WeekData
  weekStart: string
  onClose: () => void
  onSomethingElse: (meal: PlannedMeal) => void
  onGroceries: (meal: PlannedMeal, servings: number) => void
  showToast: Toast
}) {
  const { group } = useGroup()
  const { t, locale } = useI18n()
  const words = t.mealPlanner
  const mealWords = words.meal
  const tokens = useTokens('kitchen')
  const tint = tokens.tintOf('kitchen')

  const update = useMutation(api.mealPlan.update)
  const move = useMutation(api.mealPlan.move)
  const remove = useMutation(api.mealPlan.remove)
  const restore = useMutation(api.mealPlan.restore)

  // The meal as the sheet opened on it: closing saves only what changed here,
  // so an edit made meanwhile on another phone is never written back over.
  const opened = useRef(meal).current
  const [eaterIds, setEaterIds] = useState<string[] | undefined>(meal.eaterIds)
  const [servings, setServings] = useState<number | undefined>(meal.servings)
  const [note, setNote] = useState(meal.note ?? '')
  const [moveTo, setMoveTo] = useState(meal.date)
  const finished = useRef(false)

  // Who eats follows the day the meal will be on, so a day picked in the grid
  // brings that evening's calendar with it.
  const eaters = eatersOf(data, moveTo, meal.slot, eaterIds)
  const shownServings = servingsOf(data, servings, eaters.length)
  const away = awayAt(data.events, moveTo, meal.slot)
  const fromCalendar = data.members.flatMap((member) => {
    const event = away.get(member.userId)
    return event
      ? [
          fmt(mealWords.calendarItem, {
            name: member.name,
            title: event.title,
            time: clock(event.startMinutes),
          }),
        ]
      : []
  })
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))

  /**
   * Saves what changed, once, however the sheet is leaving. `move: false`
   * keeps the meal where it is: "Something else" replaces it in place.
   */
  const finish = (save: boolean, { move: moving = true } = {}) => {
    if (finished.current) return
    finished.current = true
    if (!save) return
    const changes: {
      servings?: number | null
      note?: string | null
      eaterIds?: Id<'users'>[] | null
    } = {}
    if (servings !== opened.servings) changes.servings = servings ?? null
    const trimmed = note.trim()
    if (trimmed !== (opened.note ?? '')) changes.note = trimmed || null
    if (!sameList(eaterIds, opened.eaterIds))
      changes.eaterIds = (eaterIds as Id<'users'>[] | undefined) ?? null
    // Move first: a new day drops the meal's chosen eaters, and eaters
    // chosen here, in the same sheet, should still stand after it.
    const writes: Promise<unknown>[] = []
    if (moving && moveTo !== opened.date)
      writes.push(
        move({ groupSlug: group.slug, id: meal._id, date: moveTo, slot: meal.slot }),
      )
    if (Object.keys(changes).length > 0)
      writes.push(update({ groupSlug: group.slug, id: meal._id, ...changes }))
    if (writes.length === 0) return
    Promise.all(writes)
      .then(() => haptics.itemSaved())
      .catch(() => {
        haptics.actionFailed()
        showToast({ message: words.failed })
      })
  }
  const close = (save: boolean) => {
    finish(save)
    onClose()
  }

  const toggle = (userId: string) => {
    const next = eaters.includes(userId)
      ? eaters.filter((each) => each !== userId)
      : data.members
          .map((member) => member.userId)
          .filter((each) => each === userId || eaters.includes(each))
    setEaterIds(next)
    // Who eats decides the count again, as the design asks.
    setServings(undefined)
    haptics.selectionChanged()
  }
  const step = (by: number) => {
    const next = Math.min(MAX_SERVINGS, Math.max(1, shownServings + by))
    if (next === shownServings) return
    setServings(next)
    haptics.selectionChanged()
  }

  const target = moveTo !== opened.date ? mealIn(data.meals, moveTo, meal.slot) : undefined
  const moveStatus =
    moveTo === opened.date
      ? null
      : target
        ? fmt(mealWords.swaps, {
            title: target.title,
            day: weekdayName(moveTo, locale),
          })
        : fmt(mealWords.moves, {
            title: meal.title,
            day: weekdayName(moveTo, locale),
            weekday: weekdayName(meal.date, locale),
          })

  const removeMeal = () => {
    close(false)
    remove({ groupSlug: group.slug, id: meal._id })
      .then((removed) =>
        showToast({
          message: fmt(words.removed, { title: meal.title }),
          undo: {
            label: words.undo,
            onPress: () => {
              restore({ groupSlug: group.slug, ...removed }).catch(() =>
                showToast({ message: words.failed }),
              )
            },
          },
        }),
      )
      .catch(() => {
        haptics.actionFailed()
        showToast({ message: words.failed })
      })
  }

  /** The APP-312 sheet takes over, for this meal's servings. */
  const listGroceries = () => {
    finish(true)
    onGroceries(meal, shownServings)
  }

  const meta = [
    meal.prepMinutes ? fmt(words.minutes, { minutes: meal.prepMinutes }) : null,
    meal.recipeId ? mealWords.recipe : mealWords.quickMeal,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <NativeSheet
      title={meal.title}
      subtitle={`${dayTitle(meal.date, locale)} · ${words.slots[meal.slot]} · ${meta}`}
      onClose={() => close(true)}
      maxHeight={0.92}
      fill
      background="ground"
      leading={
        <Pressable
          accessibilityRole="button"
          testID="meal-sheet-done"
          hitSlop={12}
          onPress={() => close(true)}
          style={styles.done}
        >
          <Text style={[styles.doneLabel, { color: tint.text }]}>
            {mealWords.done}
          </Text>
        </Pressable>
      }
    >
      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.body}
      >
        {data.members.length > 1 ? (
          <View style={styles.section}>
            <Text style={[styles.heading, { color: tokens.muted }]}>
              {mealWords.whoEats}
            </Text>
            <View style={styles.pills}>
              {data.members.map((member) => {
                const on = eaters.includes(member.userId)
                return (
                  <Pressable
                    key={member.userId}
                    accessibilityRole="button"
                    accessibilityLabel={member.name}
                    accessibilityState={{ selected: on }}
                    testID={`meal-eater-${member.name}`}
                    onPress={() => toggle(member.userId)}
                    style={({ pressed }) => [
                      styles.pill,
                      on
                        ? { backgroundColor: tokens.surface2, borderColor: tokens.surface2 }
                        : { borderColor: tokens.muted, borderStyle: 'dashed' },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Coin
                      name={member.name}
                      on={on}
                      size={22}
                      color={on ? tokens.ink : tokens.muted}
                      background={on ? tokens.surface : 'transparent'}
                      border={on ? 'transparent' : tokens.muted}
                    />
                    <Text
                      style={[
                        styles.pillLabel,
                        { color: on ? tokens.ink : tokens.muted },
                        !on && styles.struck,
                      ]}
                    >
                      {member.name}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
            {fromCalendar.length > 0 ? (
              <Text style={[styles.foot, { color: tokens.muted }]}>
                {fmt(mealWords.fromCalendar, {
                  items: joinNames(fromCalendar, words),
                })}
              </Text>
            ) : null}
          </View>
        ) : null}

        <InsetList>
          <InsetRow
            title={mealWords.servings}
            subtitle={
              servings === undefined
                ? mealWords.servingsFollow
                : fmt(mealWords.servingsAdjusted, { count: eaters.length })
            }
            trailing={
              <View style={styles.stepper}>
                <StepButton
                  label={mealWords.fewer}
                  testID="meal-servings-minus"
                  disabled={shownServings <= 1}
                  onPress={() => step(-1)}
                >
                  <UI_ICONS.Minus size={18} color={tokens.ink} strokeWidth={2.4} />
                </StepButton>
                <Text
                  testID="meal-servings"
                  accessibilityLabel={`${mealWords.servings}: ${shownServings}`}
                  style={[styles.count, { color: tokens.ink }]}
                >
                  {shownServings}
                </Text>
                <StepButton
                  label={mealWords.moreServings}
                  testID="meal-servings-plus"
                  disabled={shownServings >= MAX_SERVINGS}
                  onPress={() => step(1)}
                >
                  <UI_ICONS.Plus size={18} color={tokens.ink} strokeWidth={2.4} />
                </StepButton>
              </View>
            }
          />
        </InsetList>

        <View style={styles.section}>
          <Text style={[styles.heading, { color: tokens.muted }]}>
            {mealWords.moveTo}
          </Text>
          <View style={styles.grid}>
            {days.map((date) => {
              const selected = date === moveTo
              const taken =
                date !== meal.date && Boolean(mealIn(data.meals, date, meal.slot))
              const allowed =
                date === meal.date ||
                daySlots(data.preferences, date, data.meals).includes(meal.slot)
              const day = localMidnight(date)
              return (
                <Pressable
                  key={date}
                  accessibilityRole="button"
                  accessibilityLabel={
                    taken
                      ? fmt(mealWords.hasMeal, { day: dayTitle(date, locale) })
                      : dayTitle(date, locale)
                  }
                  accessibilityState={{ selected, disabled: !allowed }}
                  disabled={!allowed}
                  testID={`meal-move-${date}`}
                  onPress={() => {
                    setMoveTo(date)
                    // A new day drops chosen eaters, as `move` does; back on
                    // the meal's own day, its own choice returns.
                    setEaterIds(date === opened.date ? opened.eaterIds : undefined)
                    haptics.selectionChanged()
                  }}
                  style={({ pressed }) => [
                    styles.cell,
                    {
                      backgroundColor: selected ? tokens.ink : tokens.surface,
                    },
                    !allowed && styles.inert,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.cellDay,
                      { color: selected ? tokens.onInk : tokens.muted },
                    ]}
                  >
                    {day.toLocaleDateString(locale, { weekday: 'short' }).slice(0, 2)}
                  </Text>
                  <Text
                    style={[
                      styles.cellDate,
                      { color: selected ? tokens.onInk : tokens.ink },
                    ]}
                  >
                    {day.getDate()}
                  </Text>
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: taken
                          ? selected
                            ? tokens.onInk
                            : tint.text
                          : 'transparent',
                      },
                    ]}
                  />
                </Pressable>
              )
            })}
          </View>
          {moveStatus ? (
            <Text
              accessibilityLiveRegion="polite"
              style={[styles.foot, { color: tokens.ink }]}
            >
              {moveStatus}
            </Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={[styles.heading, { color: tokens.muted }]}>
            {mealWords.note}
          </Text>
          <TextInput
            testID="meal-note"
            value={note}
            onChangeText={setNote}
            placeholder={mealWords.notePlaceholder}
            placeholderTextColor={tokens.muted}
            accessibilityLabel={mealWords.note}
            maxLength={MAX_NOTE}
            multiline
            style={[
              styles.note,
              { backgroundColor: tokens.surface, color: tokens.ink },
            ]}
          />
        </View>

        <InsetList>
          {meal.recipeId ? (
            <InsetRow
              title={mealWords.openRecipe}
              testID="meal-open-recipe"
              chevron
              onPress={() => {
                const recipeId = meal.recipeId
                close(true)
                if (recipeId)
                  router.push(moduleHref('/all/recipes/recipe', { recipeId }))
              }}
            />
          ) : null}
          <InsetRow
            title={mealWords.somethingElse}
            subtitle={fmt(mealWords.somethingElseSub, {
              weekday: weekdayInText(meal.date, locale),
            })}
            testID="meal-something-else"
            chevron
            onPress={() => {
              finish(true, { move: false })
              onSomethingElse(meal)
            }}
          />
          {meal.recipeId ? (
            <InsetRow
              title={mealWords.groceries}
              testID="meal-groceries"
              chevron
              onPress={listGroceries}
            />
          ) : null}
          <InsetRow testID="meal-remove" onPress={removeMeal} accessibilityLabel={mealWords.remove}>
            <Text style={[styles.danger, { color: tokens.danger }]}>
              {mealWords.remove}
            </Text>
          </InsetRow>
        </InsetList>
      </ScrollView>
    </NativeSheet>
  )
}

function StepButton({
  label,
  testID,
  disabled,
  onPress,
  children,
}: {
  label: string
  testID: string
  disabled: boolean
  onPress: () => void
  children: React.ReactNode
}) {
  const tokens = useTokens()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      testID={testID}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.step,
        { backgroundColor: tokens.surface2 },
        disabled && styles.inert,
        pressed && styles.pressed,
      ]}
    >
      {children}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  body: { gap: SPACE[5], paddingBottom: SPACE[6] },
  done: { minHeight: 32, justifyContent: 'center', paddingRight: SPACE[1] },
  doneLabel: { ...TYPE.bodyStrong },
  section: { gap: SPACE[2] },
  heading: { ...TYPE.footnoteStrong, paddingHorizontal: SPACE[1] },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE[2] },
  pill: {
    minHeight: SIZE.hitMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[2],
    paddingLeft: SPACE[2],
    paddingRight: SPACE[3],
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  pillLabel: { ...TYPE.subhead },
  struck: { textDecorationLine: 'line-through' },
  foot: { ...TYPE.footnote, paddingHorizontal: SPACE[1] },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: SPACE[2] },
  step: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: { ...TYPE.bodyStrong, ...TABULAR, minWidth: 24, textAlign: 'center' },
  grid: { flexDirection: 'row', gap: SPACE[1] },
  cell: {
    flex: 1,
    minHeight: 64,
    borderRadius: RADIUS.tileM,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  cellDay: { ...TYPE.footnote },
  cellDate: { ...TYPE.bodyStrong, ...TABULAR },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  note: {
    ...TYPE.body,
    minHeight: 72,
    borderRadius: RADIUS.card,
    paddingHorizontal: SPACE[4],
    paddingTop: SPACE[3],
    paddingBottom: SPACE[3],
    textAlignVertical: 'top',
  },
  danger: { ...TYPE.body },
  inert: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
})
