import { Redirect } from 'expo-router'
import { moduleHref } from '../../../../../src/modules/moduleDestination'

/**
 * Meal preferences became the Meal planner's settings page (APP-611). A link
 * from before lands there.
 */
export default function MealPreferencesRedirect() {
  return <Redirect href={moduleHref('/all/meal-planner/settings')} />
}
