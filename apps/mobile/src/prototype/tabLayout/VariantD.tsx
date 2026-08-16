/**
 * PROTOTYPE — variant D: **Add is a place**. Throwaway. See ./README.md.
 *
 * The control. Five equal destinations drawn by the platform, exactly as
 * `SHELL_TABS` does today — same `NativeTabs`, same real `UITabBarItem`, same
 * minimise-on-scroll — with the Module tabs swapped for Search, Add, Profile.
 * Add is an ordinary trigger: tapping it navigates to `proto-add`.
 *
 * This is what won the first round of the prototype (as "A", plus the nested
 * Profile stack that made it D). It is here to be beaten, because it is the one
 * variant that disagrees with the written spec: #172 says Add opens as a sheet
 * over the current route and never moves you.
 *
 * The cost to look for: a tab bar's slots mean "somewhere you can be", and Add
 * is somewhere nobody wants to *stay*. Watch whether leaving it feels like
 * navigation or like dismissing a dialog by hand — and whether, having gone
 * there to add a recipe, you still know where you were.
 */
import { NativeTabs } from 'expo-router/unstable-native-tabs'

/** Hidden rather than deleted: the real Module tabs still have route files. */
const PARKED = ['recipes', 'tasks', 'nutrition'] as const

export function VariantD() {
  return (
    <NativeTabs labelVisibilityMode="labeled">
      <NativeTabs.Trigger name="home">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'house', selected: 'house.fill' }}
          md="home"
        />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="proto-search">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'magnifyingglass', selected: 'magnifyingglass' }}
          md="search"
        />
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="proto-add">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'plus.circle', selected: 'plus.circle.fill' }}
          md="add_circle"
        />
        <NativeTabs.Trigger.Label>Add</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="proto-profile">
        <NativeTabs.Trigger.Icon
          sf={{
            default: 'person.crop.circle',
            selected: 'person.crop.circle.fill',
          }}
          md="person"
        />
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="all">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }}
          md="apps"
        />
        <NativeTabs.Trigger.Label>All</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      {PARKED.map((name) => (
        <NativeTabs.Trigger key={name} name={name} hidden />
      ))}
    </NativeTabs>
  )
}
