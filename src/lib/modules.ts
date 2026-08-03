export type ModuleStatus = 'live' | 'placeholder'

/**
 * Who a Module's data belongs to.
 *
 * `group` — the Group you are viewing owns it, and its Members share it.
 * `personal` — it is about you, follows you between Groups, and is the same
 * whichever Group you view it from. A personal Module still renders under a
 * `/g/<slug>/…` route: the segment governs navigation there, not ownership
 * (ADR-0002). The UI says so on the page, because "who can see this?" is not
 * something a reader should have to infer from the address bar.
 */
export type ModuleScope = 'group' | 'personal'

export const MODULE_GROUPS = [
  'Kitchen',
  'Money',
  'Home & life',
  'Tasting',
] as const
export type ModuleGroup = (typeof MODULE_GROUPS)[number]

/**
 * What a Module is, minus where it lives.
 *
 * There is deliberately no path here. A Module's address is `/g/<slug>/…` and
 * nothing else, and it is written once in `groupPaths.ts` where TanStack Router
 * type-checks it against the generated route tree. A second copy in this
 * registry would be a plain string the router never sees — which is what it
 * used to be, and what let the sidebar point at a route that no longer existed.
 */
export interface ModuleDef {
  id: string
  label: string
  icon: string // lucide-react icon name
  group: ModuleGroup
  status: ModuleStatus
  scope: ModuleScope
  description: string
}

export const MODULES: ModuleDef[] = [
  {
    id: 'recipes',
    label: 'Recipes',
    icon: 'ChefHat',
    group: 'Kitchen',
    status: 'live',
    scope: 'group',
    description: 'Keep and rate the dishes you cook.',
  },
  {
    id: 'nutrition',
    label: 'Nutrition',
    icon: 'Apple',
    group: 'Kitchen',
    status: 'live',
    // A food diary is about the person keeping it, not the household. It shows
    // the same entries in every Group (ADR-0003).
    scope: 'personal',
    description: 'Log what you eat and track daily targets.',
  },
  {
    id: 'meal-planner',
    label: 'Meal planner',
    icon: 'CalendarHeart',
    group: 'Kitchen',
    status: 'placeholder',
    scope: 'group',
    description: 'Plan the week’s meals.',
  },
  {
    id: 'groceries',
    label: 'Groceries',
    icon: 'ShoppingCart',
    group: 'Kitchen',
    status: 'placeholder',
    scope: 'group',
    description: 'A shared shopping list you both check off.',
  },
  {
    id: 'pantry',
    label: 'Pantry',
    icon: 'Refrigerator',
    group: 'Kitchen',
    status: 'placeholder',
    scope: 'group',
    description: 'Track what’s in stock at home.',
  },
  {
    id: 'finances',
    label: 'Finances',
    icon: 'Wallet',
    group: 'Money',
    status: 'placeholder',
    scope: 'group',
    description: 'Budgets and spending overview.',
  },
  {
    id: 'bills',
    label: 'Bills & subscriptions',
    icon: 'Receipt',
    group: 'Money',
    status: 'placeholder',
    scope: 'group',
    description: 'Recurring bills and subscriptions.',
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: 'ListChecks',
    group: 'Home & life',
    status: 'live',
    scope: 'group',
    description: 'Shared to-do lists.',
  },
  {
    id: 'baby-log',
    label: 'Baby log',
    icon: 'Baby',
    group: 'Home & life',
    status: 'live',
    scope: 'group',
    description: 'Temperature, feeding, sleep, growth and more.',
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: 'Calendar',
    group: 'Home & life',
    status: 'placeholder',
    scope: 'group',
    description: 'Household events and reminders.',
  },
  {
    id: 'notes',
    label: 'Notes',
    icon: 'NotebookPen',
    group: 'Home & life',
    status: 'placeholder',
    scope: 'group',
    description: 'Quick shared notes.',
  },
  {
    id: 'cheeses',
    label: 'Cheeses',
    icon: 'Grape',
    group: 'Tasting',
    status: 'placeholder',
    scope: 'group',
    description: 'Rate the cheeses you try.',
  },
  {
    id: 'wines',
    label: 'Wines',
    icon: 'Wine',
    group: 'Tasting',
    status: 'placeholder',
    scope: 'group',
    description: 'Rate the wines you try.',
  },
]

/** A Module by id, or undefined when nothing declares that id. */
export function moduleById(id: string): ModuleDef | undefined {
  return MODULES.find((m) => m.id === id)
}

export function modulesByGroup(): Record<ModuleGroup, ModuleDef[]> {
  const out = Object.fromEntries(
    MODULE_GROUPS.map((g) => [g, [] as ModuleDef[]]),
  ) as Record<ModuleGroup, ModuleDef[]>
  for (const m of MODULES) out[m.group].push(m)
  return out
}
