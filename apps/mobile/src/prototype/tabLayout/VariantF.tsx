/**
 * PROTOTYPE — variant F: **Add in a native bottom accessory**. Throwaway.
 * See ./README.md.
 *
 * C's argument, made with the platform's own furniture instead of ours. Add
 * does not take a slot — the bar keeps the four things that really are places
 * (Home, Search, Profile, All) — but the Add control is a
 * `NativeTabs.BottomAccessory`, which is a real
 * [`UITabBarController.bottomAccessory`](https://developer.apple.com/documentation/uikit/uitabbarcontroller/bottomaccessory).
 *
 * The claim, and the only reason this is not just C again: an accessory is part
 * of the tab bar. It rides with it, it minimises with it on scroll, and it sits
 * in the system's material. C's pill is app-drawn furniture floating over the
 * platform's, which is why C's own file warns to watch whether it reads as part
 * of the bar or as debris on top of it. F is the version where that question
 * cannot be asked, because the answer is decided by UIKit.
 *
 * ## Two costs, and the second one is the real one
 *
 * - **iOS 26 and above only.** On older iOS this renders nothing, and the app
 *   would have no Add affordance at all — so shipping F means shipping C's pill
 *   as the fallback anyway, and maintaining both.
 * - **Android has no equivalent**, so this file falls back to C's pill there.
 *   That means the phone in your pocket and the phone in somebody else's have a
 *   different primary create control. Judge F on iOS 26, then flip to Android
 *   and ask whether you are willing to ship two answers.
 *
 * Watch, on iOS: does the accessory scroll away with the bar, and does what is
 * left still offer a way to create? An affordance that minimises itself out of
 * existence is worse than one that never moves.
 */
import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useGroup } from '../../group/GroupProvider'
import { useTokens } from '../../theme/tokens'
import { ActionSheet } from './ActionSheet'
import { PROTO_ICONS } from './icons'

const PARKED = ['recipes', 'tasks', 'nutrition', 'proto-add'] as const

/** Same number C uses, for the same reason — see VariantC. */
const BAR_HEIGHT = 52

const NATIVE_ACCESSORY = Platform.OS === 'ios'

export function VariantF() {
  const tokens = useTokens()
  const insets = useSafeAreaInsets()
  const { group } = useGroup()
  const [launcherOpen, setLauncherOpen] = useState(false)
  const Plus = PROTO_ICONS.Plus

  const addButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add"
      onPress={() => setLauncherOpen(true)}
      style={({ pressed }) => [
        styles.add,
        { backgroundColor: tokens.fg },
        pressed && styles.pressed,
      ]}
    >
      <Plus size={19} color={tokens.bg} strokeWidth={2.3} />
      <Text style={[styles.addLabel, { color: tokens.bg }]}>Add</Text>
    </Pressable>
  )

  return (
    <View style={styles.host}>
      <NativeTabs labelVisibilityMode="labeled">
        {NATIVE_ACCESSORY ? (
          <NativeTabs.BottomAccessory>
            <View style={styles.accessory}>{addButton}</View>
          </NativeTabs.BottomAccessory>
        ) : null}

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

      {/* Android, and any iOS the accessory does not exist on. This is C's
          pill, on purpose: if F ships, this is what ships beside it. */}
      {NATIVE_ACCESSORY ? null : (
        <View
          pointerEvents="box-none"
          style={[styles.pillHost, { bottom: insets.bottom + BAR_HEIGHT + 14 }]}
        >
          {addButton}
        </View>
      )}

      <ActionSheet
        visible={launcherOpen}
        groupName={group.name}
        onClose={() => setLauncherOpen(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  accessory: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  pillHost: { position: 'absolute', right: 18 },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  addLabel: { fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.97 }] },
})
