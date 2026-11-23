import { MealPlannerSettingsScreen } from '../../../../src/modules/kitchen/meal-preferences/MealPlannerSettingsScreen'
import { ModuleSettingsGate } from '../../../../src/settings/ModuleSettingsGate'

/** Settings › Modules › Meal planner: the page the Module's gear opens (APP-611). */
export default function MealPlannerSettingsRoute() {
  return (
    <ModuleSettingsGate moduleId="meal-planner">
      <MealPlannerSettingsScreen />
    </ModuleSettingsGate>
  )
}
