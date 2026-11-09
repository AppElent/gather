import type { ModuleGroup, ModuleId } from '../../modules'

/**
 * What every Module is called and what it is for.
 *
 * Not in `modules.ts` beside each Module's icon and scope: a label is the
 * most-rendered string in the app, and a registry that no React context may
 * reach cannot hold a translated one.
 *
 * `satisfies Record<ModuleId, …>` is the part that matters: declaring a Module
 * without naming it here is a typecheck failure, not a page reading
 * `undefined`.
 */
export const byId = {
  recipes: {
    label: 'Recipes',
    description: 'Keep and rate the dishes you cook.',
  },
  'meal-planner': {
    label: 'Meal planner',
    description: 'Plan the week’s meals.',
  },
  groceries: {
    label: 'Groceries',
    description: 'A shared shopping list you both check off.',
  },
  pantry: {
    label: 'Pantry',
    description: 'Track what’s in stock at home.',
  },
  'recurring-costs': {
    label: 'Recurring costs',
    description: 'Track repeating costs and each Member’s share.',
  },
  'shared-costs': {
    label: 'Shared costs',
    description: 'Split one event’s costs between Group Members.',
  },
  'savings-goals': {
    label: 'Savings goals',
    description: 'Set targets and track progress by hand.',
  },
  tasks: {
    label: 'Tasks',
    description: 'Shared to-do lists.',
  },
  'baby-log': {
    label: 'Baby log',
    description: 'Temperature, feeding, sleep, growth and more.',
  },
  calendar: {
    label: 'Calendar',
    description: 'Household events and reminders.',
  },
  notes: {
    label: 'Notes',
    description: 'Quick shared notes.',
  },
  cheeses: {
    label: 'Cheeses',
    description: 'Rate the cheeses you try.',
  },
  wines: {
    label: 'Wines',
    description: 'Rate the wines you try.',
  },
  beers: {
    label: 'Beers',
    description: 'Rate the beers you try.',
  },
} satisfies Record<ModuleId, { label: string; description: string }>

/** The headings All groups the catalog under. */
export const groups = {
  kitchen: 'Kitchen',
  money: 'Money',
  home: 'Home & life',
  tasting: 'Tasting',
} satisfies Record<ModuleGroup, string>

export const modules = { byId, groups }
