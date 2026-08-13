import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { NativeTabs } from 'expo-router/unstable-native-tabs'

/**
 * PROTOTYPE (#146) — shape A: native tabs, Home and All, nothing else.
 *
 * The Pins are content of Home (#142), because a native tab bar cannot be
 * built from runtime data. The tab bar is ink on every screen (ADR-0017), so
 * no per-route prop is ever set on this component.
 */
export default function VariantALayout() {
  return (
    <NativeTabs labelVisibilityMode="labeled">
      <NativeTabs.Trigger name="home">
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={MaterialIcons} name="home" />}
        />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
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
