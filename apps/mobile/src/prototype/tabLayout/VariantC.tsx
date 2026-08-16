/**
 * PROTOTYPE — variant C: **four native tabs + Add pill**. Throwaway.
 * See ./README.md.
 *
 * The disagreement with the brief: Add does not get a slot. A tab bar's slots
 * are places, and Add is not one — so the bar keeps the four destinations that
 * are (Home, Search, Profile, All) and stays a real `NativeTabs`, while Add
 * becomes a labelled pill floating above it that opens the launcher over
 * wherever you already were.
 *
 * The claim: you can keep the native chrome *and* give create a permanent,
 * thumb-reachable affordance — you just cannot do both inside the bar.
 * The cost to look for: the pill is app-drawn furniture sitting over the
 * platform's, so it does not minimise with the bar on scroll, and on a screen
 * with its own bottom content it is one more thing in the way. Watch whether it
 * reads as part of the bar or as debris on top of it.
 */
import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useGroup } from '../../group/GroupProvider'
import { useTokens } from '../../theme/tokens'
import { ActionSheet } from './ActionSheet'
import { PROTO_ICONS } from './icons'

const PARKED = ['recipes', 'tasks', 'nutrition', 'proto-add'] as const

/** Roughly a `UITabBar`'s height, so the pill clears it rather than covers it. */
const BAR_HEIGHT = 52

export function VariantC() {
  const tokens = useTokens()
  const insets = useSafeAreaInsets()
  const { group } = useGroup()
  const [launcherOpen, setLauncherOpen] = useState(false)
  const Pen = PROTO_ICONS.SquarePen

  return (
    <View style={styles.host}>
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

      <View
        pointerEvents="box-none"
        style={[styles.pillHost, { bottom: insets.bottom + BAR_HEIGHT + 14 }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add"
          onPress={() => setLauncherOpen(true)}
          style={({ pressed }) => [
            styles.pill,
            { backgroundColor: tokens.fg },
            pressed && styles.pressed,
          ]}
        >
          <Pen size={18} color={tokens.bg} strokeWidth={2.1} />
          <Text style={[styles.pillLabel, { color: tokens.bg }]}>Add</Text>
        </Pressable>
      </View>

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
  pillHost: { position: 'absolute', right: 18 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 17,
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 7,
  },
  pillLabel: { fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.97 }] },
})
