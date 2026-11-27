import {
  applyMealPreferencesPatch,
  applyMemberDefault,
  listChangePatch,
  type MealPreferencesListChange,
  type MealPreferencesPatch,
} from '@gather/core/meal-preferences'
import type { OptimisticLocalStore } from 'convex/browser'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

/**
 * The Group's meal preferences and their writes, each with an optimistic
 * update that answers what the server will. Lists and days are written one
 * item at a time, so another Member's change at the same moment is not lost.
 */
export function useMealPreferences(groupSlug: string) {
  const query = api.mealPreferences.get
  const prefs = useQuery(query, { groupSlug })

  const update = useMutation(api.mealPreferences.update).withOptimisticUpdate(
    (store, args) => {
      const current = store.getQuery(query, { groupSlug })
      if (!current) return
      const patch = applyMealPreferencesPatch(
        current,
        args.patch as MealPreferencesPatch,
      )
      store.setQuery(query, { groupSlug }, { ...current, ...patch })
    },
  )
  const setMemberDefault = useMutation(
    api.mealPreferences.setMemberDefault,
  ).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(query, { groupSlug })
    if (!current) return
    const patch = applyMemberDefault(current, args.userId, args.eatsByDefault)
    store.setQuery(query, { groupSlug }, { ...current, ...patch })
  })

  // The same answer the server gives for one list item, shown at once.
  const apply = (
    store: OptimisticLocalStore,
    change: MealPreferencesListChange,
  ) => {
    const current = store.getQuery(query, { groupSlug })
    if (!current) return
    const result = listChangePatch(current, change)
    if (!result.ok) return
    const patch = applyMealPreferencesPatch(current, result.patch)
    store.setQuery(query, { groupSlug }, { ...current, ...patch })
  }
  const setDiet = useMutation(api.mealPreferences.setDiet).withOptimisticUpdate(
    (store, { diet, on }) => apply(store, { list: 'diets', value: diet, on }),
  )
  const setAllergen = useMutation(
    api.mealPreferences.setAllergen,
  ).withOptimisticUpdate((store, { allergen, on }) =>
    apply(store, { list: 'allergens', value: allergen, on }),
  )
  const setDislike = useMutation(
    api.mealPreferences.setDislike,
  ).withOptimisticUpdate((store, { dislike, on }) =>
    apply(store, { list: 'dislikes', value: dislike, on }),
  )
  const setCuisine = useMutation(
    api.mealPreferences.setCuisine,
  ).withOptimisticUpdate((store, { cuisine, on }) =>
    apply(store, { list: 'cuisines', value: cuisine, on }),
  )
  const setFishDay = useMutation(
    api.mealPreferences.setFishDay,
  ).withOptimisticUpdate((store, { day, on }) =>
    apply(store, { list: 'fishDays', value: day, on }),
  )
  const setLeftoverDay = useMutation(
    api.mealPreferences.setLeftoverDay,
  ).withOptimisticUpdate((store, { day, on }) =>
    apply(store, { list: 'leftoverDays', value: day, on }),
  )
  const setSlotDay = useMutation(
    api.mealPreferences.setSlotDay,
  ).withOptimisticUpdate((store, { slot, day, on }) =>
    apply(store, { list: 'slotDays', slot, value: day, on }),
  )
  const setSlotEnabled = useMutation(
    api.mealPreferences.setSlotEnabled,
  ).withOptimisticUpdate((store, { slot, on }) =>
    apply(store, { list: 'slotEnabled', slot, on }),
  )
  const setCookingMinutes = useMutation(
    api.mealPreferences.setCookingMinutes,
  ).withOptimisticUpdate((store, { day, minutes }) =>
    apply(store, { list: 'cookingMinutes', day, minutes }),
  )
  const setSmartSwitch = useMutation(
    api.mealPreferences.setSmartSwitch,
  ).withOptimisticUpdate((store, { key, on }) =>
    apply(store, { list: 'smart', key, on }),
  )

  const setItem = (change: MealPreferencesListChange): Promise<unknown> => {
    switch (change.list) {
      case 'diets':
        return setDiet({ groupSlug, diet: change.value, on: change.on })
      case 'allergens':
        return setAllergen({ groupSlug, allergen: change.value, on: change.on })
      case 'dislikes':
        return setDislike({ groupSlug, dislike: change.value, on: change.on })
      case 'cuisines':
        return setCuisine({ groupSlug, cuisine: change.value, on: change.on })
      case 'fishDays':
        return setFishDay({ groupSlug, day: change.value, on: change.on })
      case 'leftoverDays':
        return setLeftoverDay({ groupSlug, day: change.value, on: change.on })
      case 'slotDays':
        return setSlotDay({
          groupSlug,
          slot: change.slot,
          day: change.value,
          on: change.on,
        })
      case 'slotEnabled':
        return setSlotEnabled({ groupSlug, slot: change.slot, on: change.on })
      case 'cookingMinutes':
        return setCookingMinutes({
          groupSlug,
          day: change.day,
          minutes: change.minutes,
        })
      case 'smart':
        return setSmartSwitch({ groupSlug, key: change.key, on: change.on })
    }
  }

  return {
    prefs,
    update: (patch: MealPreferencesPatch): Promise<unknown> =>
      update({ groupSlug, patch }),
    setItem,
    setEats: (userId: string, eatsByDefault: boolean): Promise<unknown> =>
      setMemberDefault({
        groupSlug,
        userId: userId as Id<'users'>,
        eatsByDefault,
      }),
  }
}
