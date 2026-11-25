/** The week menu's data as the phone's queries return it; its arithmetic is `@gather/core/week-menu`. */
import type { FunctionReturnType } from 'convex/server'

import type { api } from '../../../convex/api'

export type WeekData = FunctionReturnType<typeof api.mealPlan.week>
export type PlannedMeal = WeekData['meals'][number]
export type Member = WeekData['members'][number]
export type EveningEvent = WeekData['events'][number]
export type Draft = FunctionReturnType<typeof api.mealPlanDrafts.list>[number]
