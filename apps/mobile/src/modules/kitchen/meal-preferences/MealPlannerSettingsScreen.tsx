/**
 * The Meal planner's settings page (APP-611): its standing choices are the
 * household's meal preferences (APP-318), so the page is that screen under
 * the Module's settings title. Used by both doors.
 */
import { Stack } from 'expo-router'

import { useGroup } from '../../../group/GroupProvider'
import { fmt, useI18n } from '../../../i18n'
import { washScreenOptions } from '../../../ui/screen-header'
import { MealPreferencesScreen } from './MealPreferencesScreen'

export function MealPlannerSettingsScreen() {
  const { t } = useI18n()
  const { group } = useGroup()
  return (
    <>
      <Stack.Screen
        options={washScreenOptions(
          fmt(t.settings.modulePage.title, {
            module: t.modules.byId['meal-planner'].label,
          }),
        )}
      />
      {/* Keyed by Group: the Settings stack survives a Group switch, and a
        half-typed draft must not be saved into the Group switched to. */}
      <MealPreferencesScreen key={group._id} />
    </>
  )
}
