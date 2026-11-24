/**
 * The week menu onto the grocery list (APP-321, `designs/meal-planner/
 * README.md` section 5, `Groceries.dc.html`): APP-312's add-to-groceries
 * sheet in its week form. A day grid chooses which days count; the planned
 * Recipes' ingredients come scaled to each meal's servings, combined across
 * meals and grouped by aisle; quick meals are listed to check by hand. The
 * lines top the list up, so a second run for the same week adds only what is
 * not on it yet.
 */
import { localMidnight, todayIn } from '@gather/core/civil-date'
import { router } from 'expo-router'
import { useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { api } from '../../../convex/api'
import { useQuery } from '../../../convex/queries'
import { haptics } from '../../../feedback/haptics'
import { useGroup } from '../../../group/GroupProvider'
import { fmt, plural, useI18n } from '../../../i18n'
import { UI_ICONS } from '../../../theme/icons'
import { RADIUS, SIZE, SPACE, TYPE, useTokens } from '../../../theme/tokens'
import { SectionLabel } from '../../../ui/section-label'
import { useSheetDraft } from '../../../ui/sheet-drafts'
import { moduleHref } from '../../moduleDestination'
import { AddToGroceriesSheet } from '../add-to-groceries/add-sheet'
import { useIngredientLines } from '../add-to-groceries/use-recipe-lines'
import {
  eatersOf,
  type PlannedMeal,
  sentenceCase,
  servingsOf,
  type WeekData,
  weekdayName,
} from './week'
import {
  type CountedMeal,
  defaultDays,
  rowsOfLines,
  weekDays,
  weekGroceryLines,
} from './week-groceries'

export function WeekGroceriesSheet({
  data,
  weekStart,
  listId: openedFrom,
  onClose,
}: {
  data: WeekData
  weekStart: string
  /** The grocery list the sheet was opened from, when not the planner's. */
  listId?: string
  onClose: () => void
}) {
  const { group } = useGroup()
  const { t, locale } = useI18n()
  const words = t.mealPlanner.weekGroceries
  const days = weekDays(weekStart)
  const from = days[0]
  const to = days[6]
  const recipes = useQuery(api.mealPlan.weekIngredients, {
    groupSlug: group.slug,
    from,
    to,
  })
  const meals = useMemo(
    () => data.meals.filter((meal) => meal.date >= from && meal.date <= to),
    [data.meals, from, to],
  )
  // A share keeps the days counted with the sheet's ticks (APP-622).
  const place = `groceries:week:${weekStart}`
  const draft = useSheetDraft<{ counted: string[] }>(`${place}:days`)
  const [counted, setCounted] = useState(() =>
    draft.kept
      ? new Set(draft.kept.counted)
      : defaultDays(weekStart, todayIn(group.timeZone), meals),
  )
  const [sending, setSending] = useState(false)
  draft.track({ counted: [...counted].sort() }, { holding: sending })
  // Held with the sheet's own draft: kept again only if the add fails.
  const onSending = (state: 'sending' | 'failed') => {
    setSending(state === 'sending')
    if (state === 'failed') draft.failed()
  }

  const sources = useMemo(
    () =>
      (recipes ?? []).map((recipe) => ({
        id: recipe._id,
        ingredients: recipe.ingredients,
        servings: recipe.servings,
      })),
    [recipes],
  )
  const { lines: read, aiCount, readingAsText } = useIngredientLines(sources)

  const shortDay = (date: string) =>
    localMidnight(date).toLocaleDateString(locale, { weekday: 'short' })
  const label = (from: readonly PlannedMeal[]) => {
    if (from.length === 1)
      return fmt(words.fromOne, {
        title: from[0].title,
        day: shortDay(from[0].date),
      })
    if (from.length === 2)
      return fmt(words.fromTwo, {
        first: `${from[0].title} ${shortDay(from[0].date)}`,
        second: `${from[1].title} ${shortDay(from[1].date)}`,
      })
    return plural(locale, from.length, words.fromMany)
  }

  const countedMeals: CountedMeal[] = meals
    .filter((meal) => counted.has(meal.date))
    .map((meal) => ({
      meal,
      servings: servingsOf(
        data,
        meal.servings,
        eatersOf(data, meal.date, meal.slot, meal.eaterIds).length,
      ),
    }))
  // The item rows each line has been in, so a row whose measure changes when
  // a day leaves keeps what the person did to it (APP-590). It only grows,
  // so adding to it while rendering is safe.
  const formerRows = useRef(new Map<string, Set<string>>())
  const weekLines = (touched: ReadonlySet<string>) => {
    const week = weekGroceryLines({
      meals: countedMeals,
      recipes: new Map((recipes ?? []).map((recipe) => [recipe._id, recipe])),
      lines: read,
      label,
      touched,
      formerRows: formerRows.current,
    })
    return week
  }

  // The rows the sheet shows; only these count as rows a line was in.
  const shownLines = (touched: ReadonlySet<string>) => {
    const { lines } = weekLines(touched)
    rowsOfLines(lines, formerRows.current)
    return lines
  }

  // Which meals have nothing to read does not depend on what is touched.
  const { toCheck } = weekLines(new Set())

  const longDate = (date: string, month: boolean) =>
    localMidnight(date).toLocaleDateString(
      locale,
      month ? { day: 'numeric', month: 'long' } : { day: 'numeric' },
    )
  const sameMonth =
    localMidnight(from).getMonth() === localMidnight(to).getMonth()
  const range = fmt(words.range, {
    from: longDate(from, !sameMonth),
    to: longDate(to, true),
  })

  const toggle = (date: string) => {
    if (sending) return
    haptics.selectionChanged()
    setCounted((current) => {
      const next = new Set(current)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  return (
    <AddToGroceriesSheet
      place={place}
      onSending={onSending}
      source={{
        title: fmt(words.source, { range }),
        subtitle:
          meals.length === 0
            ? words.nothingPlanned
            : plural(locale, countedMeals.length, words.meals),
        glyph: UI_ICONS.Calendar,
      }}
      lines={(touched) =>
        recipes === undefined ? [] : shownLines(touched)
      }
      aiCount={aiCount}
      readingAsText={readingAsText}
      preferredListId={openedFrom ?? data.groceryListId ?? undefined}
      byAisle
      footnote={words.footnote}
      days={
        <DayGrid
          days={days}
          meals={meals}
          counted={counted}
          locked={sending}
          onToggle={toggle}
        />
      }
      after={(listId) =>
        toCheck.length > 0 ? (
          <ToCheck
            meals={toCheck}
            onAdd={() => {
              onClose()
              router.push(
                !listId || listId === data.groceryListId
                  ? moduleHref('/all/groceries')
                  : { pathname: '/all/tasks/[listId]', params: { listId } },
              )
            }}
          />
        ) : null
      }
      onClose={onClose}
    />
  )
}

/**
 * Seven days, Monday first. A day with a meal toggles between counting and
 * not; a day without one is locked as empty.
 */
function DayGrid({
  days,
  meals,
  counted,
  locked,
  onToggle,
}: {
  days: readonly string[]
  meals: readonly PlannedMeal[]
  counted: ReadonlySet<string>
  /** The lines are being sent: the days stay as they were sent. */
  locked: boolean
  onToggle: (date: string) => void
}) {
  const { t, locale } = useI18n()
  const words = t.mealPlanner.weekGroceries
  const tokens = useTokens('kitchen')
  return (
    <View style={[styles.card, { backgroundColor: tokens.surface }]}>
      <SectionLabel>{words.days}</SectionLabel>
      <View style={styles.grid}>
        {days.map((date) => {
          const titles = meals
            .filter((meal) => meal.date === date)
            .map((meal) => meal.title)
          const planned = titles.length > 0
          const on = planned && counted.has(date)
          const day = weekdayName(date, locale)
          const short = sentenceCase(
            localMidnight(date)
              .toLocaleDateString(locale, { weekday: 'short' })
              .replace('.', ''),
          ).slice(0, 2)
          return (
            <Pressable
              key={date}
              testID={`week-groceries-day-${date}`}
              accessibilityRole="button"
              accessibilityState={{ selected: on, disabled: locked || !planned }}
              accessibilityLabel={
                !planned
                  ? fmt(words.dayEmpty, { day })
                  : fmt(on ? words.dayCounts : words.dayNotCounted, {
                      day,
                      meals: titles.join(', '),
                    })
              }
              disabled={locked || !planned}
              onPress={() => onToggle(date)}
              style={({ pressed }) => [
                styles.cell,
                {
                  backgroundColor: !planned
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
                  styles.cellDay,
                  {
                    color: !planned
                      ? tokens.muted
                      : on
                        ? tokens.onInk
                        : tokens.ink,
                  },
                ]}
              >
                {short}
              </Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                maxFontSizeMultiplier={1.2}
                style={[
                  styles.cellState,
                  {
                    color: !planned
                      ? tokens.muted
                      : on
                        ? tokens.onInk
                        : tokens.ink,
                  },
                ]}
              >
                {!planned ? words.empty : on ? words.counts : words.notCounted}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

/** Meals with nothing to read: a reminder each, and a way to the list. */
function ToCheck({
  meals,
  onAdd,
}: {
  meals: readonly PlannedMeal[]
  onAdd: () => void
}) {
  const { t, locale } = useI18n()
  const words = t.mealPlanner.weekGroceries
  const tokens = useTokens('kitchen')
  return (
    <View style={styles.section}>
      <SectionLabel>{words.toCheck}</SectionLabel>
      <View style={[styles.list, { backgroundColor: tokens.surface }]}>
        {meals.map((meal, index) => (
          <View
            key={meal._id}
            style={[
              styles.checkRow,
              index > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: tokens.hair,
              },
            ]}
          >
            {meal.recipeId ? (
              <UI_ICONS.BookOpen size={20} color={tokens.ink} strokeWidth={2.2} />
            ) : (
              <UI_ICONS.Bolt size={20} color={tokens.ink} strokeWidth={2.2} />
            )}
            <View style={styles.grow}>
              <Text style={[styles.body, { color: tokens.ink }]}>
                {meal.title}
              </Text>
              <Text style={[styles.footnote, { color: tokens.muted }]}>
                {fmt(meal.recipeId ? words.recipeMeta : words.quickMeta, {
                  weekday: weekdayName(meal.date, locale),
                })}
              </Text>
            </View>
            <Pressable
              testID={`week-groceries-add-${meal._id}`}
              accessibilityRole="button"
              accessibilityLabel={fmt(words.addSomethingLabel, {
                title: meal.title,
              })}
              hitSlop={4}
              onPress={onAdd}
              style={({ pressed }) => [
                styles.addButton,
                { backgroundColor: tokens.surface2 },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.addLabel, { color: tokens.ink }]}>
                {words.addSomething}
              </Text>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.card,
    padding: SPACE[3],
    gap: SPACE[2],
  },
  grid: { flexDirection: 'row', gap: SPACE[1] },
  cell: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    borderRadius: RADIUS.tileM,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 2,
  },
  cellDay: { ...TYPE.bodyStrong },
  cellState: { ...TYPE.footnoteStrong },
  pressed: { opacity: 0.7 },
  section: { gap: SPACE[2] },
  list: { borderRadius: RADIUS.card, paddingHorizontal: SPACE[4] },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[3],
    minHeight: 60,
    paddingVertical: SPACE[2],
  },
  grow: { flex: 1, minWidth: 0 },
  body: { ...TYPE.body },
  footnote: { ...TYPE.footnote },
  addButton: {
    minHeight: 36,
    minWidth: SIZE.hitMin,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACE[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLabel: { ...TYPE.subhead, fontWeight: '600' },
})
