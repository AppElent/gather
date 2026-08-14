import type { ModuleGroup, ModuleId } from '../../modules'

/**
 * What every Module is called and what it is for.
 *
 * These used to live in `lib/modules.ts` beside each Module's icon and scope.
 * They moved because a label is the most-rendered string in the app — sidebar,
 * dock, topbar title, All, the palette, nine placeholder pages — and a registry
 * that no React context may reach cannot hold a translated one.
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
  nutrition: {
    label: 'Nutrition',
    description: 'Log what you eat and track daily targets.',
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
  finances: {
    label: 'Finances',
    description: 'Budgets and spending overview.',
  },
  bills: {
    label: 'Bills & subscriptions',
    description: 'Recurring bills and subscriptions.',
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
} satisfies Record<ModuleId, { label: string; description: string }>

/** The headings All groups the catalog under. */
export const groups = {
  kitchen: 'Kitchen',
  money: 'Money',
  home: 'Home & life',
  tasting: 'Tasting',
} satisfies Record<ModuleGroup, string>

export const modules = { byId, groups }
