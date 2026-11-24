/**
 * `live`: the Module is a real feature on that platform. `placeholder`: it is
 * not built there yet, so that platform draws a placeholder or nothing.
 */
export type ModuleStatus = 'live' | 'placeholder'

export const MODULE_GROUPS = ['kitchen', 'money', 'home', 'tasting'] as const
export type ModuleGroup = (typeof MODULE_GROUPS)[number]

export type ModuleIconName =
  | 'Baby'
  | 'Beer'
  | 'Calendar'
  | 'CalendarHeart'
  | 'ChefHat'
  | 'CreditCard'
  | 'Grape'
  | 'ListChecks'
  | 'NotebookPen'
  | 'Repeat'
  | 'ShoppingCart'
  | 'Target'
  | 'Users'
  | 'Wine'
  | 'Zap'

export interface ModuleDef {
  id: string
  icon: ModuleIconName
  group: ModuleGroup
  /** The web's answer: whether its screens are a real feature (`src/`). */
  status: ModuleStatus
  /**
   * The phone's answer (APP-374): `live` only when its phone screens are a
   * real feature, not `ModulePlaceholder` or a stub. The store build shows
   * only these (`apps/mobile/src/modules/moduleVisibility.ts`), and a Module
   * the phone marks `live` must have screens (`NATIVE_MODULES`).
   */
  mobileStatus: ModuleStatus
}

export const MODULES = [
  {
    id: 'recipes',
    icon: 'ChefHat',
    group: 'kitchen',
    status: 'live',
    mobileStatus: 'live',
  },
  {
    id: 'meal-planner',
    icon: 'CalendarHeart',
    group: 'kitchen',
    status: 'placeholder',
    mobileStatus: 'live',
  },
  {
    id: 'groceries',
    icon: 'ShoppingCart',
    group: 'kitchen',
    status: 'live',
    mobileStatus: 'live',
  },
  {
    id: 'recurring-costs',
    icon: 'Repeat',
    group: 'money',
    status: 'placeholder',
    mobileStatus: 'live',
  },
  {
    id: 'shared-costs',
    icon: 'Users',
    group: 'money',
    status: 'placeholder',
    mobileStatus: 'live',
  },
  {
    id: 'savings-goals',
    icon: 'Target',
    group: 'money',
    status: 'placeholder',
    mobileStatus: 'live',
  },
  {
    id: 'tasks',
    icon: 'ListChecks',
    group: 'home',
    status: 'live',
    mobileStatus: 'live',
  },
  {
    id: 'baby-log',
    icon: 'Baby',
    group: 'home',
    status: 'live',
    mobileStatus: 'live',
  },
  {
    id: 'calendar',
    icon: 'Calendar',
    group: 'home',
    status: 'placeholder',
    mobileStatus: 'live',
  },
  {
    id: 'notes',
    icon: 'NotebookPen',
    group: 'home',
    status: 'live',
    mobileStatus: 'live',
  },
  /**
   * A Group's store cards (APP-140). In `home` because a card is something
   * the household keeps and reaches for, like its lists and its calendar; it
   * is not spending, so `money` would be the wrong neighbour.
   */
  {
    id: 'loyalty-cards',
    icon: 'CreditCard',
    group: 'home',
    status: 'live',
    mobileStatus: 'live',
  },
  /**
   * What the home uses, produces and pays for electricity and gas (APP-491,
   * ADR-0051). In `home` because it is about the house, not about a budget:
   * the money it shows is a reading of the meter, not a record somebody keeps.
   * Live on both platforms from its shell (APP-492): it has screens on each,
   * and a phone Module with screens is live (APP-374). Until usage arrives
   * (APP-494) those screens only add the Group's address.
   */
  {
    id: 'energy',
    icon: 'Zap',
    group: 'home',
    status: 'live',
    mobileStatus: 'live',
  },
  /**
   * The three tasting Modules (#199, #203, ADR-0024). They share one backend,
   * one Kind spec (`tastings.ts`) and one parameterised implementation on each
   * client. `status` answers the web's question, so these became live there
   * only when the web companion landed.
   */
  {
    id: 'cheeses',
    icon: 'Grape',
    group: 'tasting',
    status: 'live',
    mobileStatus: 'live',
  },
  {
    id: 'wines',
    icon: 'Wine',
    group: 'tasting',
    status: 'live',
    mobileStatus: 'live',
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
    status: 'live',
    mobileStatus: 'live',
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
