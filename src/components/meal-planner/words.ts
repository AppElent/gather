import type { MealSlot } from '@gather/core/meal-planner'
import type { Messages } from '@gather/core/messages'
import { joinNames } from '@gather/core/week-menu'

/** "lunch and dinner": the slots a Group plans, inside a sentence. */
export function joinSlots(
  slots: readonly MealSlot[],
  words: Messages['mealPlanner'],
  locale: string,
) {
  return joinNames(
    slots.map((slot) => words.slots[slot].toLocaleLowerCase(locale)),
    words,
  )
}
