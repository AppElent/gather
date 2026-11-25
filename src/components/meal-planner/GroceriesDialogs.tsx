import { localMidnight, todayIn } from '@gather/core/civil-date'
import { sentenceCase, weekdayName } from '@gather/core/week-menu'
import {
  type CountedMeal,
  defaultDays,
  rowsOfLines,
  weekDays,
  weekGroceryLines,
} from '@gather/core/week-menu-groceries'
import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { BookOpen, Zap } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { fmt, plural, useI18n } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { buttonClass } from '../app/buttons'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import {
  AddToGroceriesDialog,
  RecipeToGroceriesDialog,
} from '../groceries/AddToGroceriesDialog'
import { useIngredientLines } from '../groceries/useRecipeLines'
import { eatingCount, type PlannedMeal, type WeekData } from './data'
import { useMealPlannerNotices } from './MealPlannerNotices'
import { DayCell, labelClass } from './parts'

function useAdded() {
  const words = useI18n().messages.mealPlanner.web
  const { show } = useMealPlannerNotices()
  return (list: string) => show({ message: fmt(words.groceriesAdded, { list }) })
}

/** One planned meal's Recipe, the stepper starting at the meal's servings. */
export function MealGroceriesDialog({
  recipeId,
  servings,
  onClose,
}: {
  recipeId: Id<'recipes'>
  servings: number
  onClose: () => void
}) {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const recipe = useQuery(api.recipes.get, { id: recipeId, groupSlug })
  const onAdded = useAdded()
  // Loading, or the Recipe was taken away meanwhile: nothing to add yet.
  if (!recipe) return null
  return (
    <RecipeToGroceriesDialog
      recipe={recipe}
      startServings={servings}
      onAdded={onAdded}
      onClose={onClose}
    />
  )
}

/**
 * The week menu onto the grocery list: a day grid chooses which days count;
 * the planned Recipes' ingredients come scaled to each meal's servings,
 * combined across meals and grouped by aisle. The lines top the list up, so a
 * second run for the same week adds only what is not on it yet.
 */
export function WeekGroceriesDialog({
  data,
  weekStart,
  onClose,
}: {
  data: WeekData
  weekStart: string
  onClose: () => void
}) {
  const group = useRequiredCurrentGroup()
  const { locale, messages: t } = useI18n()
  const words = t.mealPlanner.weekGroceries
  const onAdded = useAdded()
  const days = useMemo(() => weekDays(weekStart), [weekStart])
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
  const [counted, setCounted] = useState(() =>
    defaultDays(weekStart, todayIn(group.timeZone), meals),
  )
  const [sending, setSending] = useState(false)

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
  const label = (of: readonly PlannedMeal[]) => {
    if (of.length === 1)
      return fmt(words.fromOne, {
        title: of[0].title,
        day: shortDay(of[0].date),
      })
    if (of.length === 2)
      return fmt(words.fromTwo, {
        first: `${of[0].title} ${shortDay(of[0].date)}`,
        second: `${of[1].title} ${shortDay(of[1].date)}`,
      })
    return plural(locale, of.length, words.fromMany)
  }

  const countedMeals: CountedMeal<PlannedMeal>[] = meals
    .filter((meal) => counted.has(meal.date))
    .map((meal) => ({
      meal,
      servings: eatingCount(data, meal.date, meal.slot, meal),
    }))
  // The item rows each line has been in, so a row whose measure changes when
  // a day leaves keeps what the person did to it (APP-590). It only grows,
  // so adding to it while rendering is safe.
  const formerRows = useRef(new Map<string, Set<string>>())
  const weekLines = (touched: ReadonlySet<string>) =>
    weekGroceryLines({
      meals: countedMeals,
      recipes: new Map((recipes ?? []).map((recipe) => [recipe._id, recipe])),
      lines: read,
      label,
      touched,
      formerRows: formerRows.current,
    })
  // The rows the dialog shows; only these count as rows a line was in.
  const shownLines = (touched: ReadonlySet<string>) => {
    const { lines } = weekLines(touched)
    rowsOfLines(lines, formerRows.current)
    return lines
  }
  // Which meals have nothing to read does not depend on what is touched.
  const toCheck = recipes ? weekLines(new Set()).toCheck : []

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

  const toggle = (date: string) =>
    setCounted((current) => {
      const next = new Set(current)
      if (!next.delete(date)) next.add(date)
      return next
    })

  return (
    <AddToGroceriesDialog
      source={{
        title: fmt(words.source, { range }),
        subtitle:
          meals.length === 0
            ? words.nothingPlanned
            : plural(locale, countedMeals.length, words.meals),
        icon: 'CalendarHeart',
      }}
      lines={(touched) => (recipes ? shownLines(touched) : [])}
      aiCount={aiCount}
      readingAsText={readingAsText}
      preferredListId={data.groceryListId ?? undefined}
      byAisle
      footnote={words.footnote}
      onAdded={onAdded}
      onSending={setSending}
      onClose={onClose}
      days={
        <div className="grid gap-2">
          <h3 className={labelClass}>{words.days}</h3>
          <div className="grid grid-cols-7 gap-1">
            {days.map((date) => {
              const titles = meals
                .filter((meal) => meal.date === date)
                .map((meal) => meal.title)
              const planned = titles.length > 0
              const on = planned && counted.has(date)
              const day = weekdayName(date, locale)
              return (
                <DayCell
                  key={date}
                  short={sentenceCase(shortDay(date).replace('.', ''))}
                  state={
                    !planned ? words.empty : on ? words.counts : words.notCounted
                  }
                  on={on}
                  locked={!planned}
                  disabled={!planned || sending}
                  label={
                    !planned
                      ? fmt(words.dayEmpty, { day })
                      : fmt(on ? words.dayCounts : words.dayNotCounted, {
                          day,
                          meals: titles.join(', '),
                        })
                  }
                  onClick={() => toggle(date)}
                />
              )
            })}
          </div>
        </div>
      }
      after={(listId) =>
        toCheck.length > 0 ? (
          <div className="grid gap-2">
            <h3 className={labelClass}>{words.toCheck}</h3>
            <ul className="m-0 list-none rounded-[var(--radius-control)] bg-[var(--ground)] px-3 py-0">
              {toCheck.map((meal) => {
                const Icon = meal.recipeId ? BookOpen : Zap
                return (
                  <li
                    key={meal._id}
                    className="flex min-h-[var(--size-row-min)] items-center gap-3 py-2 [&+&]:border-t-[0.5px] [&+&]:border-[var(--hair)]"
                  >
                    <Icon className="size-5 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-body">{meal.title}</span>
                      <span className="block text-footnote text-[var(--muted)]">
                        {fmt(
                          meal.recipeId ? words.recipeMeta : words.quickMeta,
                          { weekday: weekdayName(meal.date, locale) },
                        )}
                      </span>
                    </span>
                    <Link
                      {...(!listId || listId === data.groceryListId
                        ? linkTo('groceries')
                        : linkTo('taskList', { listId }))}
                      aria-label={fmt(words.addSomethingLabel, {
                        title: meal.title,
                      })}
                      className={buttonClass.small}
                    >
                      {words.addSomething}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null
      }
    />
  )
}
