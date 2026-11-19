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
 * `tasks.icons`, `tasks.colors` and `tasks.starters`.
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

/** Starter items a template begins with: keys into `tasks.starters`. */
export const TASK_STARTERS = {
  chores: [
    'bins',
    'fridge',
    'dishwasher',
    'bathroom',
    'towels',
    'plants',
    'vacuum',
    'windows',
  ],
  packing: [
    'rainJackets',
    'walkingShoes',
    'jumpers',
    'swimwear',
    'underwear',
    'socks',
    'pyjamas',
    'toothbrushes',
    'toothpaste',
    'sunscreen',
    'medicines',
    'deodorant',
    'shampoo',
    'nappies',
    'cuddlyToy',
    'travelCot',
    'travelToys',
    'snacks',
  ],
} as const
export type TaskStarterKey =
  (typeof TASK_STARTERS)[keyof typeof TASK_STARTERS][number]

/** What a template sets up before anyone changes it. */
export interface TaskListTemplate {
  icon: TaskListIcon
  color: TaskListColor
  starters: readonly TaskStarterKey[]
}

export const TASK_LIST_TEMPLATES: Record<TaskListKind, TaskListTemplate> = {
  plain: { icon: 'list', color: 'home', starters: [] },
  chores: { icon: 'sparkles', color: 'home', starters: TASK_STARTERS.chores },
  packing: {
    icon: 'suitcase',
    color: 'money',
    starters: TASK_STARTERS.packing,
  },
  groceries: { icon: 'cart', color: 'kitchen', starters: [] },
  wishlist: { icon: 'gift', color: 'tasting', starters: [] },
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
