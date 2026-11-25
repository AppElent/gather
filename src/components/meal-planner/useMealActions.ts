import type { MealSlot } from '@gather/core/meal-planner'
import { mealIn, weekdayInText } from '@gather/core/week-menu'
import { useAction, useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { fmt, plural, useI18n } from '../../lib/i18n'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import type { Draft, PlannedMeal, WeekData } from './data'
import { useMealPlannerNotices } from './MealPlannerNotices'

export interface MealChanges {
  servings?: number | null
  note?: string | null
  eaterIds?: string[] | null
}

/** Every write the week page and its panels make, with what it says after. */
export function useMealActions(weekStart: string) {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const { locale, messages: t } = useI18n()
  const words = t.mealPlanner
  const { show, fail } = useMealPlannerNotices()

  const moveMeal = useMutation(api.mealPlan.move).withOptimisticUpdate(
    (store, args) => {
      for (const query of store.getAllQueries(api.mealPlan.week)) {
        const meal = query.value?.meals.find((each) => each._id === args.id)
        if (!query.value || !meal) continue
        const other = mealIn(query.value.meals, args.date, args.slot)
        // A new day drops the eaters someone chose, as the server does.
        const put = (moved: PlannedMeal, date: string, slot: MealSlot) => ({
          ...moved,
          date,
          slot,
          ...(moved.date === date ? {} : { eaterIds: undefined }),
        })
        store.setQuery(api.mealPlan.week, query.args, {
          ...query.value,
          meals: query.value.meals.map((each) =>
            each._id === meal._id
              ? put(each, args.date, args.slot)
              : each._id === other?._id
                ? put(each, meal.date, meal.slot)
                : each,
          ),
        })
      }
    },
  )
  const updateMeal = useMutation(api.mealPlan.update).withOptimisticUpdate(
    (store, args) => {
      const { id, groupSlug: _group, ...changes } = args
      for (const query of store.getAllQueries(api.mealPlan.week)) {
        if (!query.value) continue
        store.setQuery(api.mealPlan.week, query.args, {
          ...query.value,
          meals: query.value.meals.map((each) =>
            each._id === id
              ? {
                  ...each,
                  ...('servings' in changes
                    ? { servings: changes.servings ?? undefined }
                    : {}),
                  ...('note' in changes
                    ? { note: changes.note ?? undefined }
                    : {}),
                  ...('eaterIds' in changes
                    ? { eaterIds: changes.eaterIds ?? undefined }
                    : {}),
                }
              : each,
          ),
        })
      }
    },
  )
  const removeMeal = useMutation(api.mealPlan.remove)
  const restoreMeal = useMutation(api.mealPlan.restore)
  const acceptDraft = useMutation(api.mealPlanDrafts.accept)
  const acceptAllDrafts = useMutation(api.mealPlanDrafts.acceptAll)
  const discardDrafts = useMutation(api.mealPlanDrafts.discard)
  const regenerateDraft = useAction(api.mealPlanDrafts.regenerate)
  const [regenerating, setRegenerating] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)

  return {
    accepting,
    regenerating,

    move(
      data: WeekData,
      meal: PlannedMeal,
      date: string,
      slot: MealSlot = meal.slot,
    ) {
      const other = mealIn(data.meals, date, slot)
      moveMeal({ groupSlug, id: meal._id, date, slot })
        .then((result) => {
          if (result.kind === 'stay') return
          show({
            message:
              result.kind === 'swap' && other
                ? fmt(words.swapped, { title: meal.title, other: other.title })
                : fmt(words.moved, {
                    title: meal.title,
                    day: weekdayInText(date, locale),
                  }),
          })
        })
        .catch(() => fail())
    },

    update(id: Id<'plannedDinners'>, changes: MealChanges) {
      return updateMeal({
        groupSlug,
        id,
        ...changes,
        ...(changes.eaterIds
          ? { eaterIds: changes.eaterIds as Id<'users'>[] }
          : {}),
      } as Parameters<typeof updateMeal>[0]).catch((error) => {
        fail()
        throw error
      })
    },

    remove(meal: PlannedMeal) {
      removeMeal({ groupSlug, id: meal._id })
        .then((removed) =>
          show({
            message: fmt(words.removed, { title: meal.title }),
            undo: () => {
              restoreMeal({ groupSlug, ...removed }).catch(() => fail())
            },
          }),
        )
        .catch(() => fail())
    },

    accept(draft: Draft) {
      setAccepting(true)
      acceptDraft({ groupSlug, id: draft._id })
        .then((result) => {
          if (result !== 'planned')
            fail(
              result === 'taken' ? words.proposal.taken : words.proposal.gone,
            )
        })
        .catch(() => fail())
        .finally(() => setAccepting(false))
    },

    acceptAll() {
      setAccepting(true)
      acceptAllDrafts({ groupSlug, weekStart })
        .then(({ skipped }) =>
          show({
            message:
              skipped > 0
                ? plural(locale, skipped, words.proposal.skipped)
                : words.proposal.allSaved,
          }),
        )
        .catch(() => fail())
        .finally(() => setAccepting(false))
    },

    discard() {
      discardDrafts({ groupSlug, weekStart })
        .then(() => show({ message: words.proposal.discarded }))
        .catch(() => fail())
    },

    /** Another proposal for one slot; `onLimit` when the day's actions are used. */
    regenerate(draft: Draft, onLimit: () => void) {
      setRegenerating(draft._id)
      // The server asks with the wishes the proposal keeps (APP-679).
      regenerateDraft({ groupSlug, id: draft._id, locale })
        .then((result) => {
          if (result.status === 'limit') onLimit()
          // `empty`: the slot was filled or turned off meanwhile.
          else if (result.status === 'none' || result.status === 'empty')
            show({
              message: fmt(words.proposal.regenerateNone, {
                day: weekdayInText(draft.date, locale),
              }),
            })
        })
        .catch(() => fail())
        .finally(() => setRegenerating(null))
    },
  }
}
