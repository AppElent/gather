/**
 * What kind of list a task list is, and the face it wears (APP-306).
 *
 * A list's **kind** is stored so later features can key on it: the grocery
 * list is kind `groceries` (APP-292), a packing list keeps its checked items
 * in place and can be reset, a wishlist item carries a link and a price. A
 * list without one is `plain`, which is every list made before kinds existed.
 *
 * A list's **icon** comes from a short set of glyphs and its **colour** from
 * the four Module group fills. The colour appears only on that list's tile,
 * never on rows or text (`apps/mobile/DESIGN_SYSTEM.md`).
 *
 * No display strings live here (i18n standard): kinds, icons, colours and
 * starter items are keys, resolved in the message trees under `tasks.kinds`,
 * `tasks.icons`, `tasks.colors`, `tasks.starters` and `tasks.starterSections`.
 */
import type { TaskProviderId } from './domain'
import type { ModuleGroup } from './modules'

export const TASK_LIST_KINDS = [
  'plain',
  'chores',
  'packing',
  'groceries',
  'wishlist',
] as const
export type TaskListKind = (typeof TASK_LIST_KINDS)[number]

export const TASK_LIST_ICONS = [
  'list',
  'sparkles',
  'suitcase',
  'cart',
  'gift',
  'house',
  'papers',
] as const
export type TaskListIcon = (typeof TASK_LIST_ICONS)[number]

/** The Group tints a list may wear, in the New list sheet's order. */
export const TASK_LIST_COLORS = [
  'home',
  'kitchen',
  'tasting',
  'money',
] as const satisfies readonly ModuleGroup[]
export type TaskListColor = (typeof TASK_LIST_COLORS)[number]

/**
 * Starter items a template begins with, already in sections (APP-357): keys
 * into `tasks.starterSections` for the section's name and `tasks.starters`
 * for each item's title.
 */
export const TASK_STARTER_SECTIONS = {
  chores: [
    { section: 'kitchen', items: ['bins', 'fridge', 'dishwasher'] },
    { section: 'bathroom', items: ['bathroom', 'towels'] },
    { section: 'everywhere', items: ['plants', 'vacuum', 'windows'] },
  ],
  packing: [
    {
      section: 'clothes',
      items: [
        'rainJackets',
        'walkingShoes',
        'jumpers',
        'swimwear',
        'underwear',
        'socks',
        'pyjamas',
      ],
    },
    {
      section: 'toiletries',
      items: [
        'toothbrushes',
        'toothpaste',
        'sunscreen',
        'medicines',
        'deodorant',
        'shampoo',
      ],
    },
    {
      section: 'kids',
      items: ['nappies', 'cuddlyToy', 'travelCot', 'travelToys', 'snacks'],
    },
  ],
} as const
type StarterSections =
  (typeof TASK_STARTER_SECTIONS)[keyof typeof TASK_STARTER_SECTIONS][number]
export type TaskStarterSectionKey = StarterSections['section']
export type TaskStarterKey = StarterSections['items'][number]

/** One section of a template: its name's key and its items' keys. */
export interface TaskStarterSection {
  section: TaskStarterSectionKey
  items: readonly TaskStarterKey[]
}

/** What a template sets up before anyone changes it. */
export interface TaskListTemplate {
  icon: TaskListIcon
  color: TaskListColor
  /** The starter items, section by section; empty for a list that starts empty. */
  sections: readonly TaskStarterSection[]
}

export const TASK_LIST_TEMPLATES: Record<TaskListKind, TaskListTemplate> = {
  plain: { icon: 'list', color: 'home', sections: [] },
  chores: {
    icon: 'sparkles',
    color: 'home',
    sections: TASK_STARTER_SECTIONS.chores,
  },
  packing: {
    icon: 'suitcase',
    color: 'money',
    sections: TASK_STARTER_SECTIONS.packing,
  },
  groceries: { icon: 'cart', color: 'kitchen', sections: [] },
  wishlist: { icon: 'gift', color: 'tasting', sections: [] },
}

/** Every starter item of a template, in order, across its sections. */
export function templateStarters(
  template: TaskListTemplate,
): readonly TaskStarterKey[] {
  return template.sections.flatMap((section) => section.items)
}

/** The four icons offered after the kind's own, which always comes first. */
const EXTRA_ICONS: readonly TaskListIcon[] = [
  'house',
  'gift',
  'papers',
  'cart',
  'list',
]

/** The icon row of the New list sheet: the kind's icon, then four more. */
export function iconChoices(kind: TaskListKind): TaskListIcon[] {
  const own = TASK_LIST_TEMPLATES[kind].icon
  return [own, ...EXTRA_ICONS.filter((icon) => icon !== own).slice(0, 4)]
}

/**
 * A stored value as a kind this build knows. A newer client may store a kind
 * an older one has never heard of; the older one draws it as a plain list
 * rather than failing.
 */
export function asTaskListKind(value: string | null | undefined): TaskListKind {
  return (TASK_LIST_KINDS as readonly string[]).includes(value ?? '')
    ? (value as TaskListKind)
    : 'plain'
}

/**
 * The icon and colour a list is drawn with: its own when it has them, its
 * kind's otherwise. Unknown stored values fall back the same way.
 */
export function taskListFace(list: {
  kind?: string | null
  icon?: string | null
  color?: string | null
}): { icon: TaskListIcon; color: TaskListColor } {
  const template = TASK_LIST_TEMPLATES[asTaskListKind(list.kind)]
  const icon = (TASK_LIST_ICONS as readonly string[]).includes(list.icon ?? '')
    ? (list.icon as TaskListIcon)
    : template.icon
  const color = (TASK_LIST_COLORS as readonly string[]).includes(
    list.color ?? '',
  )
    ? (list.color as TaskListColor)
    : template.color
  return { icon, color }
}

/**
 * Whether checking an item keeps it in place. A packing list is ticked off
 * and later reset for the next trip, so its checked items stay where they are
 * instead of going into Completed.
 */
export function keepsCheckedInPlace(kind: TaskListKind): boolean {
  return kind === 'packing'
}

/** Whether a list's items carry a link and a price. */
export function hasLinkAndPrice(kind: TaskListKind): boolean {
  return kind === 'wishlist'
}

/** The longest link a wishlist item may store. */
export const TASK_URL_MAX = 2048

/**
 * A link a person typed, as something safe to open: `https://` is added when
 * no scheme was typed, and only http and https survive. `null` for anything
 * else, so a `javascript:` link can never be stored, let alone opened.
 */
export function normalizeTaskUrl(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed || trimmed.length > TASK_URL_MAX || /\s/.test(trimmed)) {
    return null
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`
  let parsed: URL
  try {
    parsed = new URL(withScheme)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
  if (!parsed.hostname.includes('.')) return null
  return withScheme
}

/** The short form a row shows under an item's title: the host, no `www.`. */
export function taskUrlHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * How each backend can hold a task's responsible Member (APP-302, ADR-0021
 * capabilities). A local list stores a current Member of its Group. Todoist
 * has one responsible person per task (`responsible_uid`), but only on a
 * shared project and only through a write path. Notion has no such field
 * Gather maps.
 */
export const ASSIGNEE_SUPPORT = {
  local: 'members',
  todoist: 'sharedProjects',
  notion: 'none',
} as const satisfies Record<
  TaskProviderId,
  'members' | 'sharedProjects' | 'none'
>

/**
 * Why the Who row is off for a list, or `null` when a task on it can be
 * given to someone. Each reason has its own explanation under
 * `tasks.assignee.unavailable`.
 *
 * - `readOnly`: the provider could hold an assignee but Gather cannot write
 *   to this list (every linked list today: ADR-0021 has no provider write
 *   path yet).
 * - `notShared`: a Todoist project nobody else is in has no one to give a
 *   task to.
 * - `unsupported`: the provider has no responsible person at all.
 */
export type AssigneeUnavailable = 'readOnly' | 'notShared' | 'unsupported'

export function assigneeUnavailable(list: {
  provider: TaskProviderId
  writable: boolean
  /** Whether the provider source is shared; only Todoist reads it. */
  shared?: boolean
}): AssigneeUnavailable | null {
  const support = ASSIGNEE_SUPPORT[list.provider]
  if (support === 'none') return 'unsupported'
  if (!list.writable) return 'readOnly'
  if (support === 'sharedProjects' && !list.shared) return 'notShared'
  return null
}

/**
 * A list's sections (APP-357): named groups its tasks sit in, in the order
 * they are drawn. A task without a section, or with one the list no longer
 * has, sits under "No section".
 */
export interface TaskSection {
  id: string
  name: string
}

/** The most sections a list may have, and the longest section name. */
export const TASK_SECTIONS_MAX = 30
export const TASK_SECTION_NAME_MAX = 80

/**
 * Tasks grouped by section, in the list's section order, with the tasks that
 * have no section (or a section that is gone) first, under `id: null`. Each
 * group keeps the order the tasks arrived in. The no-section group is left out
 * when it is empty and the list has sections; a list without sections is one
 * group of everything.
 */
export function groupBySection<T extends { sectionId?: string | null }>(
  sections: readonly TaskSection[],
  tasks: readonly T[],
): { id: string | null; name: string | null; tasks: T[] }[] {
  const known = new Set(sections.map((section) => section.id))
  const loose = tasks.filter(
    (task) => !task.sectionId || !known.has(task.sectionId),
  )
  const groups = sections.map((section) => ({
    id: section.id as string | null,
    name: section.name as string | null,
    tasks: tasks.filter((task) => task.sectionId === section.id),
  }))
  if (sections.length === 0 || loose.length > 0) {
    groups.unshift({ id: null, name: null, tasks: loose })
  }
  return groups
}
