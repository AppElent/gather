import { addDays } from '@gather/core/civil-date'
import {
  awayFromEvents,
  defaultEaters,
  MEAL_SLOTS,
  mealEaters,
  mealServings,
} from '@gather/core/meal-planner'
import { z } from 'zod'
import { api } from '../../../../convex/_generated/api'
import {
  asId,
  defineTool,
  groupSlug,
  publicDoc,
  ToolInputError,
} from './define'
import { clockOf, day, groupId } from './shared'

/** The longest range list_meal_plan reads, matching the Convex week query. */
const MAX_RANGE_DAYS = 31

const slot = z
  .enum(MEAL_SLOTS)
  .describe('The meal moment: breakfast, lunch or dinner')

function daysBetween(from: string, to: string) {
  return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5
}

export const mealPlanTools = [
  defineTool({
    name: 'list_meal_plan',
    title: 'List meal plan',
    description: `List a Group's planned meals from one day up to, not including, another, at most ${MAX_RANGE_DAYS} days apart: per day and meal slot, the recipe or quick meal, servings, note and who eats along. Also the evenings a calendar event makes busy, the meal slots the Group plans, and its quick meals (for plan_meal).`,
    access: 'read',
    input: {
      groupId,
      from: day,
      to: day.describe('First day not included, YYYY-MM-DD'),
    },
    async run({ groupId, from, to }, context) {
      const span = daysBetween(from, to)
      if (!(span > 0 && span <= MAX_RANGE_DAYS))
        throw new ToolInputError(
          `to must be after from and at most ${MAX_RANGE_DAYS} days later.`,
        )
      const slug = await groupSlug(context, groupId)
      const [week, candidates] = await Promise.all([
        context.backend.query(api.mealPlan.week, {
          groupSlug: slug,
          from,
          to: addDays(to, -1),
        }),
        context.backend.query(api.mealPlan.candidates, { groupSlug: slug }),
      ])
      // People are named, never numbered: user ids stay inside Gather.
      const nameOf = new Map<string, string>(
        week.members.map((m) => [m.userId, m.name]),
      )
      const memberIds = week.members.map((m) => m.userId)
      return {
        meals: week.meals.map((meal) => {
          const eaters = mealEaters(
            meal.eaterIds,
            memberIds,
            defaultEaters(
              week.preferences.memberDefaults,
              // An evening event only takes someone away from dinner.
              meal.slot === 'dinner'
                ? awayFromEvents(week.events, meal.date)
                : new Map(),
            ),
          )
          return publicDoc({
            _id: meal._id,
            date: meal.date,
            slot: meal.slot,
            title: meal.title,
            recipeId: meal.recipeId,
            quickMealId: meal.mealEntryId,
            prepMinutes: meal.prepMinutes,
            servings: mealServings(
              meal.servings,
              week.preferences.servingsPerMeal,
              eaters.length,
            ),
            note: meal.note,
            eating: eaters.map((id) => nameOf.get(id) ?? ''),
          })
        }),
        busyEvenings: week.events.map((event) => ({
          date: event.date,
          title: event.title,
          start: clockOf(event.startMinutes),
          away: event.assigneeIds
            .map((id) => nameOf.get(id))
            .filter((name): name is string => Boolean(name)),
        })),
        slots: week.preferences.slots,
        quickMeals: candidates.mealEntries.map((entry) =>
          publicDoc({
            _id: entry._id,
            title: entry.title,
            prepMinutes: entry.prepMinutes,
          }),
        ),
      }
    },
  }),
  defineTool({
    name: 'plan_meal',
    title: 'Plan meal',
    description:
      'Plan a recipe (recipeId from list_recipes) or a quick meal (quickMealId from list_meal_plan) for one meal slot of one day. A slot that already has a meal is refused unless replace is true; replacing keeps that meal\'s servings and note unless you pass new ones. Leave servings out to follow who eats along.',
    access: 'write',
    annotations: { idempotentHint: true },
    input: {
      groupId,
      date: day,
      slot,
      recipeId: z.string().min(1).optional(),
      quickMealId: z.string().min(1).optional(),
      servings: z.number().int().min(1).max(50).optional(),
      note: z.string().max(500).optional(),
      replace: z.boolean().default(false),
    },
    async run({ groupId, recipeId, quickMealId, ...input }, context) {
      if (Boolean(recipeId) === Boolean(quickMealId))
        throw new ToolInputError('Pass exactly one of recipeId and quickMealId.')
      const id = await context.backend.mutation(api.mealPlan.plan, {
        groupSlug: await groupSlug(context, groupId),
        ...input,
        recipeId: recipeId ? asId<'recipes'>(recipeId) : undefined,
        mealEntryId: quickMealId ? asId<'mealEntries'>(quickMealId) : undefined,
      })
      return { mealId: id }
    },
  }),
]
