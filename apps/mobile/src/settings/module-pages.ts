/**
 * Which Modules have a settings page, and the two addresses each one has
 * (APP-611).
 *
 * Two doors, one screen: the gear on the Module's root pushes the page inside
 * All's stack, so Back returns to the Module; Settings › Modules pushes the
 * same component inside the Settings stack, so Back returns to Settings.
 *
 * Only a Module with something to set is listed. One that has only actions
 * (Notes, Recipes, …) gets no gear and no row, never an empty page. The
 * inventory behind this list is in the APP-611 pull request.
 *
 * **When a Module gains a setting**, add it here, give it both route files
 * (`all/<module>/settings.tsx` and `settings/<module>`), and pass its
 * `settingsHref` to `ModuleHeaderButtons` on its root.
 */
import type { Href } from 'expo-router'

export const MODULE_SETTINGS_PAGES = [
  'baby-log',
  'groceries',
  'meal-planner',
  'tasks',
] as const

export type ModuleSettingsId = (typeof MODULE_SETTINGS_PAGES)[number]

/**
 * Whose settings a page holds: the Group's (written for everyone in it), or
 * this phone's. Settings › Modules names the Group beside a Group page, since
 * nothing else on that screen says which household is about to be edited.
 */
export const MODULE_SETTINGS_SCOPE = {
  'baby-log': 'group',
  groceries: 'group',
  'meal-planner': 'group',
  tasks: 'phone',
} as const satisfies Record<ModuleSettingsId, 'group' | 'phone'>

/** Which stack the page is pushed in: the Module's own, or Settings'. */
export type ModuleSettingsDoor = 'all' | 'settings'

export function hasModuleSettings(moduleId: string): moduleId is ModuleSettingsId {
  return (MODULE_SETTINGS_PAGES as readonly string[]).includes(moduleId)
}

/** The Module settings page's address in each stack. */
export function moduleSettingsHref<Door extends ModuleSettingsDoor>(
  moduleId: ModuleSettingsId,
  door: Door,
): ModuleSettingsHref<Door> {
  return (
    door === 'all' ? `/all/${moduleId}/settings` : `/settings/${moduleId}`
  ) as ModuleSettingsHref<Door>
}

export type ModuleSettingsHref<Door extends ModuleSettingsDoor = ModuleSettingsDoor> =
  Door extends 'all'
    ? `/all/${ModuleSettingsId}/settings`
    : `/settings/${ModuleSettingsId}`

/** The same, as expo-router's `Href` (typed routes come from Metro, not tsc). */
export function moduleSettingsRoute(
  moduleId: ModuleSettingsId,
  door: ModuleSettingsDoor,
): Href {
  return moduleSettingsHref(moduleId, door) as Href
}
