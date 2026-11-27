/**
 * What Add offers: one create action per pinned Module that has a create flow
 * on the web, in the order the Member pinned them.
 *
 * Add is the web's counterpart of the phone's Add tab (ADR-0018), but it does
 * not build forms of its own. Each action goes to the flow the Module already
 * has — a `new` page where there is one, or the Module's index with `?new`
 * where its create dialog lives on the index itself.
 *
 * A `Record` over every Module, so a new Module is a compile error here until
 * somebody decides whether it has a create action; `null` is that answer.
 */

import type { Messages } from '@gather/core/messages'
import type {
  ModuleDef,
  ModuleGroup,
  ModuleIconName,
  ModuleId,
} from '@gather/core/modules'
import { moduleText } from '@gather/core/modules'
import { pinnedModules } from '@gather/core/pins'
import { type AppLink, linkTo } from './links'

export type CreateMessages = Pick<
  Messages,
  | 'modules'
  | 'recipes'
  | 'baby'
  | 'loyaltyCards'
  | 'notes'
  | 'tasks'
  | 'tastings'
  | 'calendar'
>

export interface CreateAction {
  module: ModuleId
  /** What the action does, in the Module's own words ("Add recipe"). */
  label: string
  /** The Module's name, under the action, so three "Log a tasting" differ. */
  moduleLabel: string
  group: ModuleGroup
  icon: ModuleIconName
  link: AppLink
}

type CreateDef = (messages: CreateMessages) => {
  label: string
  link: AppLink
}

/** Opens a Module's index with its create dialog already open. */
const onIndex = (
  to: '/tasks' | '/notes' | '/cheeses' | '/wines' | '/beers' | '/calendar',
): AppLink => ({
  to,
  search: { new: true },
})

const CREATE: Record<ModuleId, CreateDef | null> = {
  recipes: (m) => ({ label: m.recipes.list.add, link: linkTo('newRecipe') }),
  tasks: (m) => ({ label: m.tasks.page.addList, link: onIndex('/tasks') }),
  'baby-log': (m) => ({
    label: m.baby.log.form.createTitle,
    link: linkTo('newChild'),
  }),
  'loyalty-cards': (m) => ({
    label: m.loyaltyCards.index.add,
    link: linkTo('newLoyaltyCard'),
  }),
  cheeses: (m) => ({ label: m.tastings.index.add, link: onIndex('/cheeses') }),
  wines: (m) => ({ label: m.tastings.index.add, link: onIndex('/wines') }),
  beers: (m) => ({ label: m.tastings.index.add, link: onIndex('/beers') }),
  notes: (m) => ({ label: m.notes.newNote, link: onIndex('/notes') }),
  calendar: (m) => ({ label: m.calendar.newEvent, link: onIndex('/calendar') }),
  // Readings arrive from the meter, not from a form.
  energy: null,
  // A meal is chosen for a slot of the week, so its empty slots are the way in.
  'meal-planner': null,
  // Not built on the web yet (`status: 'placeholder'`).
  groceries: null,
  'recurring-costs': null,
  'shared-costs': null,
  'savings-goals': null,
}

function actionFor(
  module: ModuleDef,
  messages: CreateMessages,
): CreateAction | null {
  const def = CREATE[module.id as ModuleId]
  if (!def) return null
  return {
    module: module.id as ModuleId,
    moduleLabel: moduleText(module, messages).label,
    group: module.group,
    icon: module.icon,
    ...def(messages),
  }
}

/** The create actions for the Current Group's pins, in pin order. */
export function createActions(
  pins: readonly string[] | undefined,
  messages: CreateMessages,
): CreateAction[] {
  return pinnedModules(pins)
    .map((module) => actionFor(module, messages))
    .filter((action): action is CreateAction => action !== null)
}

/** Validates the `?new` flag a Module index opens its create dialog from. */
export function validateNewSearch(search: Record<string, unknown>): {
  new?: true
} {
  return search.new === true || search.new === 'true' ? { new: true } : {}
}
