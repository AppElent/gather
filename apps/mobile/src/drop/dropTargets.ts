/**
 * Where a Drop is allowed to go, and which destination goes on top.
 *
 * A Drop arrives from the phone's share sheet with no Group and no Module, and
 * it stays that way until a person names one (ADR-0028). This file is the list
 * of names they can pick from.
 *
 * ## The registry that cannot be forgotten
 *
 * `DROP_TARGETS` is an exhaustive record keyed by `ModuleId`, so a Module that
 * accepts nothing has to declare an empty list and **adding a Module is a
 * compile error until somebody answers the question**. That is deliberately
 * unlike `moduleDestination.ts`, the seed contributions, the breadcrumb trails
 * and `quickActions.ts`, every one of which fails silently and is kept honest
 * only by a line in `CLAUDE.md`.
 *
 * It is a separate list from `QUICK_ACTIONS` even though the two describe
 * neighbouring things — the Add tab's capture verbs, and the destinations a
 * Drop can be aimed at. The two will drift. That was accepted in exchange for
 * this one being exhaustive, which `QUICK_ACTIONS` is not and does not want to
 * be.
 *
 * ## Ranking
 *
 * `DROP_ORDER` is the declared order per payload kind — the only place a kind
 * is named, so a target cannot claim to accept something the sheet never offers
 * it for. A host rule from `@gather/core/drop-rules` may move one destination
 * to the top and **may never take one off the list**: a stale rule costs one
 * tap, never a dead end.
 *
 * ## Routes
 *
 * A target carries a function rather than a path because most destinations are
 * only addressable once the write has happened — the note that was just made,
 * the list that was just picked. The cast inside each one is the same cast
 * `modules/recipes/paths.ts` explains: typed routes cannot check a template
 * string, so the assembly is confined to the files that own a Module's paths
 * and to this one.
 */
import { type DropKind, dropHostPreference } from '@gather/core/drop-rules'
import type { ModuleIconName, ModuleId } from '@gather/core/modules'
import type { TastingKind } from '@gather/core/tastings'
import type { Href } from 'expo-router'

import { babyHref } from '../modules/baby/paths'
import { recipeHref } from '../modules/recipes/paths'
import { tastingHref } from '../modules/tasting/paths'

export type DropTargetId =
  | 'recipe-import'
  | 'recipe-new-photo'
  | 'recipe-photo'
  | 'note-new'
  | 'note-append'
  | 'task-new'
  | 'grocery-line'
  | 'baby-memory'
  | 'cheese-photo'
  | 'wine-photo'
  | 'beer-photo'

/**
 * What stage two of the chooser asks for, if anything.
 *
 * `none` means confirming finishes the Drop. Everything else means one more
 * question — which note, which list, which recipe, which cheese — and that
 * stage is allowed to load, because by then a person has committed.
 */
export type DropPick =
  | 'none'
  | 'note'
  | 'task-list'
  | 'recipe'
  | 'tasting-subject'

/** What a route needs to name the thing the Drop just became or joined. */
export interface DropRouteParams {
  /** The record the Drop landed on: a note, a list, a recipe, a subject. */
  id: string
}

export interface DropTarget {
  id: DropTargetId
  module: ModuleId
  icon: ModuleIconName
  /** Whether the Drop becomes a new thing or joins one that exists. */
  mode: 'create' | 'append'
  picks: DropPick
  /** Only a tasting target: which Kind stage two lists subjects from. */
  tastingKind?: TastingKind
  /** Where the person is standing once the Drop is finished. */
  route: (params: DropRouteParams) => Href
}

const RECIPES: DropTarget[] = [
  {
    // No new Convex function and no second reader: a Drop aimed at Recipes is
    // an Import exactly as CONTEXT.md already defines one, and it opens the
    // importer with the link already in it.
    id: 'recipe-import',
    module: 'recipes',
    icon: 'ChefHat',
    mode: 'create',
    picks: 'none',
    route: () => recipeHref('/all/recipes', '/import'),
  },
  {
    id: 'recipe-new-photo',
    module: 'recipes',
    icon: 'ChefHat',
    mode: 'create',
    picks: 'none',
    route: () => recipeHref('/all/recipes', '/new'),
  },
  {
    id: 'recipe-photo',
    module: 'recipes',
    icon: 'ChefHat',
    mode: 'append',
    picks: 'recipe',
    route: ({ id }) => recipeHref('/all/recipes', '/recipe', { recipeId: id }),
  },
]

const noteRoute = ({ id }: DropRouteParams): Href =>
  ({ pathname: '/all/notes/[noteId]', params: { noteId: id } }) as Href

const NOTES: DropTarget[] = [
  {
    id: 'note-new',
    module: 'notes',
    icon: 'NotebookPen',
    mode: 'create',
    picks: 'none',
    route: noteRoute,
  },
  {
    id: 'note-append',
    module: 'notes',
    icon: 'NotebookPen',
    mode: 'append',
    picks: 'note',
    route: noteRoute,
  },
]

const TASKS: DropTarget[] = [
  {
    id: 'task-new',
    module: 'tasks',
    icon: 'ListChecks',
    mode: 'create',
    // A task with nowhere to live is a task nobody sees again, so the list is
    // asked for rather than defaulted — the one `create` that still needs a
    // second stage.
    picks: 'task-list',
    route: ({ id }) =>
      ({ pathname: '/all/tasks/[listId]', params: { listId: id } }) as Href,
  },
]

const GROCERIES: DropTarget[] = [
  {
    // The shortest path in the flow, and the reason is in the schema: a Group
    // designates its grocery list, so the Group already names the destination
    // and there is nothing left to ask.
    id: 'grocery-line',
    module: 'groceries',
    icon: 'ShoppingCart',
    mode: 'append',
    picks: 'none',
    route: () => '/all/groceries' as Href,
  },
]

const BABY_LOG: DropTarget[] = [
  {
    id: 'baby-memory',
    module: 'baby-log',
    icon: 'Baby',
    mode: 'create',
    picks: 'none',
    route: () => babyHref('/all/baby-log', '/timeline'),
  },
]

function tastingPhoto(
  id: DropTargetId,
  module: ModuleId,
  icon: ModuleIconName,
  kind: TastingKind,
): DropTarget {
  return {
    id,
    module,
    icon,
    mode: 'append',
    picks: 'tasting-subject',
    tastingKind: kind,
    route: ({ id: subjectId }) =>
      tastingHref('/all/tasting', kind, '/subject', { subjectId }),
  }
}

/**
 * Every Module, and what it takes.
 *
 * The empty lists are the point. A Module with nothing to say still has to say
 * it, which is what stops the destination list quietly falling behind the app.
 */
export const DROP_TARGETS = {
  recipes: RECIPES,
  // Nutrition is a diary of what was eaten, and nothing arriving from another
  // app is a meal that has been eaten yet.
  nutrition: [],
  // Planning a dinner means choosing a day as well as a recipe, which is a
  // screen rather than a destination. A recipe Drop reaches the planner the
  // ordinary way, once it is a recipe.
  'meal-planner': [],
  groceries: GROCERIES,
  // The pantry is a count of what is in the house. A link is not stock.
  pantry: [],
  // Money is shared and entered by hand on purpose (ADR-0025).
  finances: [],
  tasks: TASKS,
  'baby-log': BABY_LOG,
  // An event needs a date and a time, and no share sheet carries either.
  calendar: [],
  notes: NOTES,
  cheeses: [tastingPhoto('cheese-photo', 'cheeses', 'Grape', 'cheese')],
  wines: [tastingPhoto('wine-photo', 'wines', 'Wine', 'wine')],
  beers: [tastingPhoto('beer-photo', 'beers', 'Beer', 'beer')],
} as const satisfies Record<ModuleId, readonly DropTarget[]>

/**
 * The declared order per payload kind, and the only place a kind is named.
 *
 * Order is the ranking a Drop gets when no host rule has anything to say about
 * it, which is most of the time: a link is usually a recipe, text is usually a
 * note, and a photo is usually the baby.
 */
export const DROP_ORDER = {
  url: ['recipe-import', 'note-new', 'note-append', 'task-new', 'grocery-line'],
  text: ['note-new', 'note-append', 'task-new', 'grocery-line'],
  image: [
    'baby-memory',
    'recipe-new-photo',
    'recipe-photo',
    'cheese-photo',
    'wine-photo',
    'beer-photo',
  ],
} as const satisfies Record<DropKind, readonly DropTargetId[]>

const BY_ID: Record<string, DropTarget> = Object.fromEntries(
  Object.values(DROP_TARGETS as Record<string, readonly DropTarget[]>).flatMap(
    (targets) => targets.map((target) => [target.id, target] as const),
  ),
)

export function dropTargetById(id: DropTargetId): DropTarget {
  const target = BY_ID[id]
  if (!target) throw new Error(`Unknown drop target: ${id}`)
  return target
}

export interface RankedDropTarget extends DropTarget {
  /** The one the chooser opens with already selected. Exactly one is true. */
  preselected: boolean
}

export interface DropDecisionInput {
  kind: DropKind
  /** The link's host, for a `url` Drop. Ignored for anything else. */
  host?: string | null
}

/**
 * The destinations a Drop can be aimed at, best guess first.
 *
 * Never returns fewer destinations because of a host: the rule chooses which
 * one is preselected and nothing else. That is the guarantee the test asserts
 * directly, because it is the one a later change is most likely to break
 * without noticing.
 */
export function targetsForDrop({
  kind,
  host,
}: DropDecisionInput): RankedDropTarget[] {
  const declared = DROP_ORDER[kind].map((id) => dropTargetById(id))
  // A host says nothing about a photo or a paragraph of text — only a link has
  // one, and reading a stale one off anything else would rank by accident.
  const preference = kind === 'url' ? dropHostPreference(host ?? null) : null
  const preselectedId =
    (preference &&
      declared.find((target) => target.module === preference)?.id) ??
    declared[0]?.id

  return declared.map((target) => ({
    ...target,
    preselected: target.id === preselectedId,
  }))
}
