/**
 * The native destinations Gather accepts from its addressed deep-link handoff.
 *
 * A Group link names more surfaces than mobile v1 implements. This map is
 * deliberately strict: an unimplemented detail page is not "close enough" to
 * a tab root, because accepting it would make an invalid link change the
 * ambient Group. A supported link therefore always has an exact equivalent in
 * the native shell.
 */
import { type ModuleId, moduleById } from '@gather/core/modules'
import type { Href } from 'expo-router'

const MODULE_BY_GROUP_SEGMENT = {
  'meal-planner': 'meal-planner',
  groceries: 'groceries',
  pantry: 'pantry',
  finances: 'finances',
  baby: 'baby-log',
  calendar: 'calendar',
  notes: 'notes',
  cheeses: 'cheeses',
  wines: 'wines',
} as const satisfies Record<string, ModuleId>

/**
 * Translate the part after `/g/<slug>` into a destination in the ambient
 * native shell. `null` means the link is not supported by mobile v1 and must
 * leave the current Group untouched.
 */
export function nativeDestinationForGroupLink(
  segments: readonly string[],
): Href | null {
  if (segments.length === 0) return '/home'

  const [first, second] = segments
  if (!first) return null

  if (segments.length === 1) {
    switch (first) {
      case 'all':
        return '/all'
      case 'recipes':
      case 'tasks':
      case 'nutrition':
        return { pathname: '/all/[moduleId]', params: { moduleId: first } }
      default: {
        const moduleId = moduleForGroupSegment(first)
        return moduleId
          ? { pathname: '/all/[moduleId]', params: { moduleId } }
          : null
      }
    }
  }

  // `/g/<slug>/all/<moduleId>` is the only nested mobile destination. Its
  // Module check means a mistyped segment cannot switch the current Group.
  if (
    first === 'all' &&
    segments.length === 2 &&
    second &&
    moduleById(second)
  ) {
    return { pathname: '/all/[moduleId]', params: { moduleId: second } }
  }

  return null
}

function moduleForGroupSegment(segment: string): ModuleId | undefined {
  if (!Object.hasOwn(MODULE_BY_GROUP_SEGMENT, segment)) return undefined
  return MODULE_BY_GROUP_SEGMENT[
    segment as keyof typeof MODULE_BY_GROUP_SEGMENT
  ]
}
