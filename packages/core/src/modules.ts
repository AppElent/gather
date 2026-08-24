export type ModuleStatus = 'live' | 'placeholder'
export type ModuleScope = 'group' | 'personal'

export const MODULE_GROUPS = ['kitchen', 'money', 'home', 'tasting'] as const
export type ModuleGroup = (typeof MODULE_GROUPS)[number]

export type ModuleIconName =
  | 'Apple'
  | 'Baby'
  | 'Beer'
  | 'Calendar'
  | 'CalendarHeart'
  | 'ChefHat'
  | 'Grape'
  | 'ListChecks'
  | 'NotebookPen'
  | 'Receipt'
  | 'Refrigerator'
  | 'ShoppingCart'
  | 'Wallet'
  | 'Wine'

export interface ModuleDef {
  id: string
  icon: ModuleIconName
  group: ModuleGroup
  status: ModuleStatus
  scope: ModuleScope
}

export const MODULES = [
  {
    id: 'recipes',
    icon: 'ChefHat',
    group: 'kitchen',
    status: 'live',
    scope: 'group',
  },
  {
    id: 'nutrition',
    icon: 'Apple',
    group: 'kitchen',
    status: 'live',
    scope: 'personal',
  },
  {
    id: 'meal-planner',
    icon: 'CalendarHeart',
    group: 'kitchen',
    status: 'placeholder',
    scope: 'group',
  },
  {
    id: 'groceries',
    icon: 'ShoppingCart',
    group: 'kitchen',
    status: 'placeholder',
    scope: 'group',
  },
  {
    id: 'pantry',
    icon: 'Refrigerator',
    group: 'kitchen',
    status: 'placeholder',
    scope: 'group',
  },
  {
    id: 'finances',
    icon: 'Wallet',
    group: 'money',
    status: 'placeholder',
    scope: 'group',
  },
  {
    id: 'bills',
    icon: 'Receipt',
    group: 'money',
    status: 'placeholder',
    scope: 'group',
  },
  {
    id: 'tasks',
    icon: 'ListChecks',
    group: 'home',
    status: 'live',
    scope: 'group',
  },
  {
    id: 'baby-log',
    icon: 'Baby',
    group: 'home',
    status: 'live',
    scope: 'group',
  },
  {
    id: 'calendar',
    icon: 'Calendar',
    group: 'home',
    status: 'placeholder',
    scope: 'group',
  },
  {
    id: 'notes',
    icon: 'NotebookPen',
    group: 'home',
    status: 'placeholder',
    scope: 'group',
  },
  /**
   * The three tasting Modules (#199, ADR-0024). They share one backend and
   * one Kind spec (`tastings.ts`), and they are `placeholder` here because
   * `status` answers *the web's* question — `ModulePlaceholder` on the phone
   * already says a Module being live on one client is no evidence about the
   * other. The native screens exist; the web companion does not yet, so the
   * web still renders an honest placeholder and this flips with it.
   */
  {
    id: 'cheeses',
    icon: 'Grape',
    group: 'tasting',
    status: 'placeholder',
    scope: 'group',
  },
  {
    id: 'wines',
    icon: 'Wine',
    group: 'tasting',
    status: 'placeholder',
    scope: 'group',
  },
  /**
   * Beer is in at launch on purpose (#199). Two Kinds would let a per-Kind
   * special case hide in a two-element union; three is what proves the Kind
   * spec in `tastings.ts` is really data.
   */
  {
    id: 'beers',
    icon: 'Beer',
    group: 'tasting',
    status: 'placeholder',
    scope: 'group',
  },
] as const satisfies readonly ModuleDef[]

export type ModuleId = (typeof MODULES)[number]['id']

export function moduleById(id: string): ModuleDef | undefined {
  return MODULES.find((module) => module.id === id)
}

export function modulesByGroup(): Record<ModuleGroup, ModuleDef[]> {
  const modules = Object.fromEntries(
    MODULE_GROUPS.map((group) => [group, [] as ModuleDef[]]),
  ) as Record<ModuleGroup, ModuleDef[]>
  for (const module of MODULES) modules[module.group].push(module)
  return modules
}

export interface ModuleMessages {
  modules: {
    byId: Record<ModuleId, { label: string; description: string }>
    groups: Record<ModuleGroup, string>
  }
}

export function moduleText(module: ModuleDef, messages: ModuleMessages) {
  return messages.modules.byId[module.id as ModuleId]
}
