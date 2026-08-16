/**
 * PROTOTYPE IN PLACE — the real layout is `ShippedTabs` at the bottom of this
 * file, unchanged. See `src/prototype/tabLayout/README.md`; delete the
 * prototype branch and `export default ShippedTabs` to get the app back.
 *
 * Round two: the bar is settled at five slots — Home, Search, Add, Profile,
 * All — drawn by the platform, with Profile owning its own stack. Every
 * variant below agrees about that and disagrees only about **Add**, which is
 * the one thing still open. Switch from the floating pill mounted in
 * `app/(app)/_layout.tsx`; each variant file argues its own case.
 *
 * Swapping the navigator itself remounts it, so a switch resets which tab you
 * are on. That is the prototype's cost, not the design's.
 *
 * ---
 *
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
import { VariantB } from '../../../src/prototype/tabLayout/VariantB'
import { VariantC } from '../../../src/prototype/tabLayout/VariantC'
import { VariantD } from '../../../src/prototype/tabLayout/VariantD'
import { VariantE } from '../../../src/prototype/tabLayout/VariantE'
import { VariantF } from '../../../src/prototype/tabLayout/VariantF'
import { useVariant } from '../../../src/prototype/tabLayout/variant'
import { SHELL_TABS } from '../../../src/shell/tabs'

export default function TabsLayout() {
  const variant = useVariant()

  if (!__DEV__) return <ShippedTabs />
  if (variant === 'E') return <VariantE />
  if (variant === 'F') return <VariantF />
  if (variant === 'C') return <VariantC />
  if (variant === 'B') return <VariantB />
  return <VariantD />
}

function ShippedTabs() {
  const { t } = useI18n()

  return (
    <NativeTabs labelVisibilityMode="labeled">
      {SHELL_TABS.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Icon sf={tab.sf} md={tab.md} />
          <NativeTabs.Trigger.Label>{tab.label(t)}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ))}
      {/* The prototype's route files exist in this build; without this they
          would appear as three extra tabs in the shipped bar. */}
      <NativeTabs.Trigger name="proto-search" hidden />
      <NativeTabs.Trigger name="proto-add" hidden />
      <NativeTabs.Trigger name="proto-profile" hidden />
    </NativeTabs>
  )
}
