import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { NativeTabs } from 'expo-router/unstable-native-tabs'

/**
 * PROTOTYPE (#146) — shape B: native tabs with a fixed middle.
 *
 * `DEFAULT_PINS` nailed to the bar — Home · Recipes · Tasks · Nutrition · All,
 * exactly five, exactly Android's ceiling and the web's `DOCK_SLOTS`. Fixed
 * for everybody: pinning something else changes Home's strip and never this.
 */
export default function VariantBLayout() {
  return (
    <NativeTabs labelVisibilityMode="labeled">
      <NativeTabs.Trigger name="home">
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={MaterialIcons} name="home" />}
        />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="recipes">
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={MaterialIcons} name="restaurant-menu" />}
        />
        <NativeTabs.Trigger.Label>Recipes</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="tasks">
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={MaterialIcons} name="checklist" />}
        />
        <NativeTabs.Trigger.Label>Tasks</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="nutrition">
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={MaterialIcons} name="local-dining" />}
        />
        <NativeTabs.Trigger.Label>Nutrition</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="all">
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={MaterialIcons} name="apps" />}
        />
        <NativeTabs.Trigger.Label>All</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
