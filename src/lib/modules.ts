export type SpaceRole = 'admin' | 'member'
export type ModuleAvailability = 'live' | 'comingSoon'
export type SpaceModuleState = 'preEnabled' | 'enabled' | 'archived'
export type WidgetSize = 'compact' | 'standard' | 'wide'

export interface WidgetDefinition {
  id: string
  moduleId: string
  label: string
  allowedSizes: readonly WidgetSize[]
  defaultSize: WidgetSize
  allowMultiple: boolean
}

export interface WidgetInstance {
  instanceId: string
  widgetDefinitionId: string
  size: WidgetSize
  config?: unknown
}

export interface ModuleDefinition {
  id: string
  label: string
  description: string
  icon: string
  pathSegment: string
  availability: ModuleAvailability
  defaultForNewSpaces: boolean
  widgets: readonly WidgetDefinition[]
  defaultWidgetIds: readonly string[]
}

export interface SpaceClaims {
  clerkOrganizationId: string
  role: SpaceRole
}

export type ModuleStatus = 'live' | 'placeholder'
export const MODULE_CATEGORIES = [
  'Kitchen',
  'Money',
  'Home & life',
  'Tasting',
] as const
export type ModuleCategory = (typeof MODULE_CATEGORIES)[number]

export type ModuleDef = ModuleDefinition & {
  group: ModuleCategory
  path: string
  status: ModuleStatus
}

const tasksToday: WidgetDefinition = {
  id: 'tasks.today',
  moduleId: 'tasks',
  label: 'Today',
  allowedSizes: ['compact', 'standard'],
  defaultSize: 'standard',
  allowMultiple: false,
}

const notesRecent: WidgetDefinition = {
  id: 'notes.recent',
  moduleId: 'notes',
  label: 'Recent notes',
  allowedSizes: ['standard', 'wide'],
  defaultSize: 'standard',
  allowMultiple: false,
}

const calendarUpcoming: WidgetDefinition = {
  id: 'calendar.upcoming',
  moduleId: 'calendar',
  label: 'Upcoming events',
  allowedSizes: ['standard', 'wide'],
  defaultSize: 'standard',
  allowMultiple: false,
}

const recipeBookmarks: WidgetDefinition = {
  id: 'recipes.bookmarks',
  moduleId: 'recipes',
  label: 'Recipe bookmarks',
  allowedSizes: ['standard', 'wide'],
  defaultSize: 'standard',
  allowMultiple: true,
}

function modulePath(pathSegment: string) {
  return `/${pathSegment}`
}

function statusFromAvailability(
  availability: ModuleAvailability,
): ModuleStatus {
  return availability === 'live' ? 'live' : 'placeholder'
}

function defineModule(
  definition: ModuleDefinition & { group: ModuleCategory },
): ModuleDef {
  return {
    ...definition,
    path: modulePath(definition.pathSegment),
    status: statusFromAvailability(definition.availability),
  }
}

export const MODULES = [
  defineModule({
    id: 'tasks',
    label: 'Tasks',
    icon: 'ListChecks',
    group: 'Home & life',
    pathSegment: 'tasks',
    availability: 'comingSoon',
    defaultForNewSpaces: true,
    description: 'Shared to-do lists.',
    widgets: [tasksToday],
    defaultWidgetIds: ['tasks.today'],
  }),
  defineModule({
    id: 'notes',
    label: 'Notes',
    icon: 'NotebookPen',
    group: 'Home & life',
    pathSegment: 'notes',
    availability: 'comingSoon',
    defaultForNewSpaces: true,
    description: 'Quick shared notes.',
    widgets: [notesRecent],
    defaultWidgetIds: ['notes.recent'],
  }),
  defineModule({
    id: 'calendar',
    label: 'Calendar',
    icon: 'Calendar',
    group: 'Home & life',
    pathSegment: 'calendar',
    availability: 'comingSoon',
    defaultForNewSpaces: true,
    description: 'Household events and reminders.',
    widgets: [calendarUpcoming],
    defaultWidgetIds: ['calendar.upcoming'],
  }),
  defineModule({
    id: 'recipes',
    label: 'Recipes',
    icon: 'ChefHat',
    group: 'Kitchen',
    pathSegment: 'recipes',
    availability: 'live',
    defaultForNewSpaces: false,
    description: 'Keep and rate the dishes you cook.',
    widgets: [recipeBookmarks],
    defaultWidgetIds: [],
  }),
  defineModule({
    id: 'meal-planner',
    label: 'Meal planner',
    icon: 'CalendarHeart',
    group: 'Kitchen',
    pathSegment: 'meal-planner',
    availability: 'comingSoon',
    defaultForNewSpaces: false,
    description: 'Plan the week meals.',
    widgets: [],
    defaultWidgetIds: [],
  }),
  defineModule({
    id: 'groceries',
    label: 'Groceries',
    icon: 'ShoppingCart',
    group: 'Kitchen',
    pathSegment: 'groceries',
    availability: 'comingSoon',
    defaultForNewSpaces: false,
    description: 'A shared shopping list you both check off.',
    widgets: [],
    defaultWidgetIds: [],
  }),
  defineModule({
    id: 'pantry',
    label: 'Pantry',
    icon: 'Refrigerator',
    group: 'Kitchen',
    pathSegment: 'pantry',
    availability: 'comingSoon',
    defaultForNewSpaces: false,
    description: 'Track what is in stock at home.',
    widgets: [],
    defaultWidgetIds: [],
  }),
  defineModule({
    id: 'finances',
    label: 'Finances',
    icon: 'Wallet',
    group: 'Money',
    pathSegment: 'finances',
    availability: 'comingSoon',
    defaultForNewSpaces: false,
    description: 'Budgets and spending overview.',
    widgets: [],
    defaultWidgetIds: [],
  }),
  defineModule({
    id: 'bills',
    label: 'Bills & subscriptions',
    icon: 'Receipt',
    group: 'Money',
    pathSegment: 'bills',
    availability: 'comingSoon',
    defaultForNewSpaces: false,
    description: 'Recurring bills and subscriptions.',
    widgets: [],
    defaultWidgetIds: [],
  }),
  defineModule({
    id: 'cheeses',
    label: 'Cheeses',
    icon: 'Grape',
    group: 'Tasting',
    pathSegment: 'cheeses',
    availability: 'comingSoon',
    defaultForNewSpaces: false,
    description: 'Rate the cheeses you try.',
    widgets: [],
    defaultWidgetIds: [],
  }),
  defineModule({
    id: 'wines',
    label: 'Wines',
    icon: 'Wine',
    group: 'Tasting',
    pathSegment: 'wines',
    availability: 'comingSoon',
    defaultForNewSpaces: false,
    description: 'Rate the wines you try.',
    widgets: [],
    defaultWidgetIds: [],
  }),
] as const satisfies readonly ModuleDef[]

export const WIDGETS = MODULES.flatMap((module) => module.widgets)

export function getModuleDefinition(
  moduleId: string,
): ModuleDefinition | undefined {
  return MODULES.find((module) => module.id === moduleId)
}

export function modulesByCategory(): Record<ModuleCategory, ModuleDef[]> {
  const out = Object.fromEntries(
    MODULE_CATEGORIES.map((g) => [g, [] as ModuleDef[]]),
  ) as Record<ModuleCategory, ModuleDef[]>
  for (const module of MODULES) out[module.group].push(module)
  return out
}
