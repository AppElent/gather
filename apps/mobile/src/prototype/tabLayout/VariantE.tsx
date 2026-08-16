/**
 * PROTOTYPE — variant E: **Add is a native slot that opens a sheet**.
 * Throwaway. See ./README.md.
 *
 * The variant that, if it looks right, ends the argument: five real
 * `UITabBarItem`s exactly as in D, and tapping Add opens the action launcher
 * over wherever you already were instead of taking you anywhere. Five slots
 * (your call) *and* Add-as-a-sheet (#172), with none of the native chrome that
 * B gives up.
 *
 * ## How it works, and why it is not a hack
 *
 * `NativeTabs.Trigger` takes `disabled`, documented as "the tab is shown but
 * cannot be selected by tapping it in the tab bar" — and the navigator still
 * emits `tabPress` (with `isPrevented: true`) while skipping the navigation.
 * So the slot stays in the bar, keeps its icon and label, and the press becomes
 * ours. `canPreventDefault` is `false` on that event, but nothing needs
 * preventing: `disabled` already stopped it natively.
 *
 * The `proto-add` route file still exists and is still this trigger's `name` —
 * the navigator needs a screen behind every slot. You should never reach it. If
 * you land on the Add *screen*, this variant has failed and it is worth saying
 * so, because that is exactly the failure `disabled` is supposed to prevent.
 *
 * ## The cost to look for, and it is a real risk
 *
 * UIKit dims a disabled `UITabBarItem`, and Material greys a disabled item.
 * This variant lives or dies on whether the Add slot renders **grey and dead**
 * next to four live ones. Judge that first — everything else about E is already
 * settled by D. If it does render dimmed, the question becomes whether
 * `unstable_nativeProps` can restore the appearance, and if it cannot, E is out
 * and the choice is F or C.
 *
 * Check it on both platforms: iOS and Android disable-styling are not the same,
 * and one of them looking fine is not an answer.
 */
import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { useState } from 'react'
import { View } from 'react-native'

import { useGroup } from '../../group/GroupProvider'
import { ActionSheet } from './ActionSheet'

const PARKED = ['recipes', 'tasks', 'nutrition'] as const

export function VariantE() {
  const { group } = useGroup()
  const [launcherOpen, setLauncherOpen] = useState(false)

  return (
    <View style={{ flex: 1 }}>
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

        {/* The whole variant is these three lines. `disabled` keeps the slot in
            the bar and stops the native selection; `listeners.tabPress` still
            fires, and turns the press into a sheet. */}
        <NativeTabs.Trigger
          name="proto-add"
          disabled
          listeners={{ tabPress: () => setLauncherOpen(true) }}
        >
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
            sf={{
              default: 'square.grid.2x2',
              selected: 'square.grid.2x2.fill',
            }}
            md="apps"
          />
          <NativeTabs.Trigger.Label>All</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        {PARKED.map((name) => (
          <NativeTabs.Trigger key={name} name={name} hidden />
        ))}
      </NativeTabs>

      <ActionSheet
        visible={launcherOpen}
        groupName={group.name}
        onClose={() => setLauncherOpen(false)}
      />
    </View>
  )
}
