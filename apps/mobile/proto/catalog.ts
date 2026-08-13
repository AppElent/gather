/**
 * PROTOTYPE (#146) — throwaway.
 *
 * A hand-copied slice of what `@gather/core` will hold (#143): the module
 * registry, its EN labels and descriptions, and `DEFAULT_PINS`. Copied rather
 * than imported because `packages/core` does not exist yet — the prototype is
 * not the ticket that builds it.
 *
 * Icons are `@expo/vector-icons`' MaterialIcons, standing in for the
 * `lucide-react-native` map ADR-0017 chose. `@expo/vector-icons` is already a
 * scaffold dependency, and the prototype adds no dependencies.
 */
import type { ModuleGroup } from './tokens'

export interface ProtoModule {
  id: string
  label: string
  description: string
  group: ModuleGroup
  status: 'live' | 'placeholder'
  scope: 'group' | 'personal'
  icon: string
}

export const MODULES: ProtoModule[] = [
  {
    id: 'recipes',
    label: 'Recipes',
    description: 'Keep and rate the dishes you cook.',
    group: 'kitchen',
    status: 'live',
    scope: 'group',
    icon: 'restaurant-menu',
  },
  {
    id: 'nutrition',
    label: 'Nutrition',
    description: 'Log what you eat and track daily targets.',
    group: 'kitchen',
    status: 'live',
    scope: 'personal',
    icon: 'local-dining',
  },
  {
    id: 'meal-planner',
    label: 'Meal planner',
    description: 'Plan the week’s meals.',
    group: 'kitchen',
    status: 'placeholder',
    scope: 'group',
    icon: 'menu-book',
  },
  {
    id: 'groceries',
    label: 'Groceries',
    description: 'A shared shopping list you both check off.',
    group: 'kitchen',
    status: 'placeholder',
    scope: 'group',
    icon: 'shopping-cart',
  },
  {
    id: 'pantry',
    label: 'Pantry',
    description: 'Track what’s in stock at home.',
    group: 'kitchen',
    status: 'placeholder',
    scope: 'group',
    icon: 'kitchen',
  },
  {
    id: 'finances',
    label: 'Finances',
    description: 'Budgets and spending overview.',
    group: 'money',
    status: 'placeholder',
    scope: 'group',
    icon: 'account-balance-wallet',
  },
  {
    id: 'bills',
    label: 'Bills & subscriptions',
    description: 'Recurring bills and subscriptions.',
    group: 'money',
    status: 'placeholder',
    scope: 'group',
    icon: 'receipt-long',
  },
  {
    id: 'tasks',
    label: 'Tasks',
    description: 'Shared to-do lists.',
    group: 'home',
    status: 'live',
    scope: 'group',
    icon: 'checklist',
  },
  {
    id: 'baby-log',
    label: 'Baby log',
    description: 'Temperature, feeding, sleep, growth and more.',
    group: 'home',
    status: 'live',
    scope: 'group',
    icon: 'child-care',
  },
  {
    id: 'calendar',
    label: 'Calendar',
    description: 'Household events and reminders.',
    group: 'home',
    status: 'placeholder',
    scope: 'group',
    icon: 'calendar-month',
  },
  {
    id: 'notes',
    label: 'Notes',
    description: 'Quick shared notes.',
    group: 'home',
    status: 'placeholder',
    scope: 'group',
    icon: 'sticky-note-2',
  },
  {
    id: 'cheeses',
    label: 'Cheeses',
    description: 'Rate the cheeses you try.',
    group: 'tasting',
    status: 'placeholder',
    scope: 'group',
    icon: 'bakery-dining',
  },
  {
    id: 'wines',
    label: 'Wines',
    description: 'Rate the wines you try.',
    group: 'tasting',
    status: 'placeholder',
    scope: 'group',
    icon: 'wine-bar',
  },
]

export const GROUP_LABELS: Record<ModuleGroup, string> = {
  kitchen: 'Kitchen',
  money: 'Money',
  home: 'Home & life',
  tasting: 'Tasting',
}

export const MODULE_GROUPS: ModuleGroup[] = ['kitchen', 'money', 'home', 'tasting']

export const DEFAULT_PINS = ['recipes', 'tasks', 'nutrition']

export function moduleById(id: string) {
  return MODULES.find((m) => m.id === id)
}

/** The Groups Eric would actually see, hardcoded — no Convex in a prototype. */
export const GROUPS = [
  { slug: 'jansen-household', name: 'Jansen Household', personal: false },
  { slug: 'cooking-club', name: 'Cooking Club', personal: false },
  { slug: 'eric', name: 'Eric', personal: true },
]

/**
 * What `api.activity.forGroup` returns on the web, faked. The shape matters
 * more than the rows: Home has content that is not the catalogue.
 */
export const ACTIVITY = [
  {
    id: '1',
    who: 'Eric',
    verb: 'added',
    title: 'Pasta alla Norma',
    module: 'Recipes',
    when: 'today at 18:20',
    icon: 'restaurant-menu',
    group: 'kitchen' as ModuleGroup,
  },
  {
    id: '2',
    who: 'Anna',
    verb: 'completed',
    title: 'Order nappies',
    module: 'Tasks',
    when: 'today at 14:05',
    icon: 'checklist',
    group: 'home' as ModuleGroup,
  },
  {
    id: '3',
    who: 'Eric',
    verb: 'logged',
    title: 'Bottle 120 ml',
    module: 'Baby log',
    when: 'yesterday at 22:40',
    icon: 'child-care',
    group: 'home' as ModuleGroup,
  },
  {
    id: '4',
    who: 'Anna',
    verb: 'added',
    title: 'Tomatoes, basil, ricotta salata',
    module: 'Tasks',
    when: 'yesterday at 17:12',
    icon: 'checklist',
    group: 'home' as ModuleGroup,
  },
  {
    id: '5',
    who: 'Eric',
    verb: 'rated',
    title: 'Comté 24 months',
    module: 'Cheeses',
    when: 'Monday',
    icon: 'bakery-dining',
    group: 'tasting' as ModuleGroup,
  },
]
