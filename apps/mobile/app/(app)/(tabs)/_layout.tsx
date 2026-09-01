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
import { usePathname } from 'expo-router'
import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { useEffect, useState } from 'react'
import { View } from 'react-native'

import { useGroup } from '../../../src/group/GroupProvider'
import { useI18n } from '../../../src/i18n'
import { requestSearchFocus } from '../../../src/search/searchFocus'
import { rememberSearchOrigin } from '../../../src/search/searchOrigin'
import { QuickActionSheet } from '../../../src/shell/QuickActionSheet'
import { SHELL_TABS } from '../../../src/shell/tabs'

export default function TabsLayout() {
  const { t } = useI18n()
  const { group } = useGroup()
  const [launcherOpen, setLauncherOpen] = useState(false)

  return (
    <View style={{ flex: 1 }}>
      <NativeTabs labelVisibilityMode="labeled" minimizeBehavior="onScrollDown">
        {SHELL_TABS.map((tab) => (
          <NativeTabs.Trigger
            key={tab.name}
            name={tab.name}
            role={tab.role}
            disabled={tab.name === 'add'}
            listeners={
              tab.name === 'add'
                ? { tabPress: () => setLauncherOpen(true) }
                : // Selecting Search means asking to type. The screen's own
                  // trigger is the pathname changing, which on Android cannot
                  // fire when you are already on Search with the field closed.
                  tab.name === 'search'
                  ? { tabPress: () => requestSearchFocus() }
                  : undefined
            }
          >
            <NativeTabs.Trigger.Icon sf={tab.sf} md={tab.md} />
            <NativeTabs.Trigger.Label>{tab.label(t)}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        ))}
      </NativeTabs>
      <SearchOriginTracker />
      <QuickActionSheet
        visible={launcherOpen}
        groupName={group.name}
        onClose={() => setLauncherOpen(false)}
      />
    </View>
  )
}

/**
 * Draws nothing; remembers which tab you are on so dismissing search can put you
 * back there (`src/search/searchOrigin.ts`).
 *
 * A leaf of its own rather than a `usePathname()` in `TabsLayout`, so a
 * navigation does not re-render the five triggers and their native children.
 *
 * It watches the pathname rather than hanging off each trigger's `tabPress`,
 * because opening a search result is a `router.push` into the All tab — a tab
 * change with no press behind it, which a press-only recorder would miss and
 * then send you back one tab too far.
 */
function SearchOriginTracker() {
  const pathname = usePathname()
  useEffect(() => rememberSearchOrigin(pathname), [pathname])
  return null
}
