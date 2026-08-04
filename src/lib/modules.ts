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

/**
 * How All shelves the catalog. Ids rather than headings: the heading is a
 * translated string and lives in each locale's `modules.ts` under
 * `lib/i18n/messages/`, keyed by these (ADR-0011).
 */
export const MODULE_GROUPS = ['kitchen', 'money', 'home', 'tasting'] as const
export type ModuleGroup = (typeof MODULE_GROUPS)[number]

/**
 * What a Module is, minus where it lives and minus what it is called.
 *
 * There is deliberately no path here. A Module's address is `/g/<slug>/…` and
 * nothing else, and it is written once in `groupPaths.ts` where TanStack Router
 * type-checks it against the generated route tree. A second copy in this
 * registry would be a plain string the router never sees — which is what it
 * used to be, and what let the sidebar point at a route that no longer existed.
 *
 * There is deliberately no label or description either, for the same shape of
 * reason. Both are read by a person, so both are translated, and a translated
 * string cannot live in a file that no React context may reach. They are keyed
 * by `id` in the message tree, which typechecks that every Module declared here
 * has been named there.
 */
export interface ModuleDef {
  id: string
  icon: string // lucide-react icon name
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
    // A food diary is about the person keeping it, not the household. It shows
    // the same entries in every Group (ADR-0003).
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
] as const satisfies readonly ModuleDef[]

/**
 * Every id the registry declares.
 *
 * `as const satisfies` above is what makes this a union of the actual ids
 * rather than `string`, and that union is what the message tree is typed
 * against — so adding a Module without naming it fails `pnpm typecheck`.
 */
export type ModuleId = (typeof MODULES)[number]['id']

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
