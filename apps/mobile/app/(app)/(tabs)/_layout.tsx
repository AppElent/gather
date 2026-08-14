/**
 * The fixed five, drawn by the platform.
 *
 * `NativeTabs` renders a real `UITabBarItem` / `BottomNavigationView` rather
 * than a JS approximation of one, which is what buys the native chrome the
 * spec asks for — the iOS 26 minimise-on-scroll behaviour, Android's ripple,
 * the system's own font metrics and safe-area handling. The cost is that the
 * icon has to be the platform's kind of icon, which is why `SHELL_TABS` carries
 * an SF Symbol and a vector glyph instead of the lucide map every other surface
 * uses.
 *
 * The list is a constant and does not read the Group, the Pins, or anything
 * else that can change (ADR-0015, #142): five slots, same five in every Group.
 * That is what lets a switch preserve the navigator: only its Group-keyed
 * stacks remount at their roots.
 */
import { NativeTabs } from 'expo-router/unstable-native-tabs'

import { useI18n } from '../../../src/i18n'
import { SHELL_TABS } from '../../../src/shell/tabs'

export default function TabsLayout() {
  const { t } = useI18n()

  return (
    <NativeTabs labelVisibilityMode="labeled">
      {SHELL_TABS.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Icon sf={tab.sf} md={tab.md} />
          <NativeTabs.Trigger.Label>{tab.label(t)}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  )
}
