import { Stack } from 'expo-router'
import { useI18n } from '../../../../../src/i18n'
import { MealPreferencesScreen } from '../../../../../src/modules/kitchen/meal-preferences/MealPreferencesScreen'

/**
 * Eetvoorkeuren, pushed from the meal planner. APP-317's week screen links
 * here by this path (`/all/meal-planner/preferences`).
 */
export default function MealPreferencesRoute() {
  const { t } = useI18n()
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t.mealPreferences.title,
          headerLargeTitle: true,
          headerShadowVisible: false,
          headerLargeTitleShadowVisible: false,
        }}
      />
      <MealPreferencesScreen />
    </>
  )
}
