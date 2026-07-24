export type ModuleStatus = 'live' | 'placeholder'

export const MODULE_GROUPS = [
  'Kitchen',
  'Money',
  'Home & life',
  'Tasting',
] as const
export type ModuleGroup = (typeof MODULE_GROUPS)[number]

export interface ModuleDef {
  id: string
  label: string
  icon: string // lucide-react icon name
  group: ModuleGroup
  path: string
  status: ModuleStatus
  description: string
}

export const MODULES: ModuleDef[] = [
  {
    id: 'recipes',
    label: 'Recipes',
    icon: 'ChefHat',
    group: 'Kitchen',
    path: '/recipes',
    status: 'live',
    description: 'Keep and rate the dishes you cook.',
  },
  {
    id: 'nutrition',
    label: 'Nutrition',
    icon: 'Apple',
    group: 'Kitchen',
    path: '/nutrition',
    status: 'live',
    description: 'Log what you eat and track daily targets.',
  },
  {
    id: 'meal-planner',
    label: 'Meal planner',
    icon: 'CalendarHeart',
    group: 'Kitchen',
    path: '/meal-planner',
    status: 'placeholder',
    description: 'Plan the week’s meals.',
  },
  {
    id: 'groceries',
    label: 'Groceries',
    icon: 'ShoppingCart',
    group: 'Kitchen',
    path: '/groceries',
    status: 'placeholder',
    description: 'A shared shopping list you both check off.',
  },
  {
    id: 'pantry',
    label: 'Pantry',
    icon: 'Refrigerator',
    group: 'Kitchen',
    path: '/pantry',
    status: 'placeholder',
    description: 'Track what’s in stock at home.',
  },
  {
    id: 'finances',
    label: 'Finances',
    icon: 'Wallet',
    group: 'Money',
    path: '/finances',
    status: 'placeholder',
    description: 'Budgets and spending overview.',
  },
  {
    id: 'bills',
    label: 'Bills & subscriptions',
    icon: 'Receipt',
    group: 'Money',
    path: '/bills',
    status: 'placeholder',
    description: 'Recurring bills and subscriptions.',
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: 'ListChecks',
    group: 'Home & life',
    path: '/tasks',
    status: 'live',
    description: 'Shared to-do lists.',
  },
  {
    id: 'baby-log',
    label: 'Baby log',
    icon: 'Baby',
    group: 'Home & life',
    path: '/baby',
    status: 'live',
    description: 'Temperature, feeding, sleep, growth and more.',
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: 'Calendar',
    group: 'Home & life',
    path: '/calendar',
    status: 'placeholder',
    description: 'Household events and reminders.',
  },
  {
    id: 'notes',
    label: 'Notes',
    icon: 'NotebookPen',
    group: 'Home & life',
    path: '/notes',
    status: 'placeholder',
    description: 'Quick shared notes.',
  },
  {
    id: 'cheeses',
    label: 'Cheeses',
    icon: 'Grape',
    group: 'Tasting',
    path: '/cheeses',
    status: 'placeholder',
    description: 'Rate the cheeses you try.',
  },
  {
    id: 'wines',
    label: 'Wines',
    icon: 'Wine',
    group: 'Tasting',
    path: '/wines',
    status: 'placeholder',
    description: 'Rate the wines you try.',
  },
]

export function modulesByGroup(): Record<ModuleGroup, ModuleDef[]> {
  const out = Object.fromEntries(
    MODULE_GROUPS.map((g) => [g, [] as ModuleDef[]]),
  ) as Record<ModuleGroup, ModuleDef[]>
  for (const m of MODULES) out[m.group].push(m)
  return out
}
