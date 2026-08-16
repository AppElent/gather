/**
 * PROTOTYPE — variant B: **raised Add, JS bar**. Throwaway. See ./README.md.
 *
 * Add is a verb, and the app's primary one, so it gets the centre and it gets
 * lifted off the bar. Tapping it opens the launcher over wherever you already
 * were and never changes where you are. Profile is your face rather than a
 * glyph, because a slot that means "you" reads faster as a person than as an
 * icon of a person.
 *
 * The price is the whole reason this is a variant and not just a tweak: a
 * raised centre button is not something a `UITabBarItem` can be, so the bar has
 * to be drawn in JS. That trades away everything ADR's `NativeTabs` note buys —
 * iOS 26's minimise-on-scroll, Android's ripple, the system's font metrics and
 * its own safe-area handling — and this bar re-implements only the last of
 * those. Judge it knowing the native chrome is what it costs.
 */
import { useUser } from '@clerk/expo'
import { Tabs } from 'expo-router'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useGroup } from '../../group/GroupProvider'
import { useTokens } from '../../theme/tokens'
import { ActionSheet } from './ActionSheet'
import { PROTO_ICONS } from './icons'

/** Routes that keep their file but leave the bar for the length of the test. */
const PARKED = ['recipes', 'tasks', 'nutrition', 'proto-add'] as const

const ITEMS = [
  { route: 'home', label: 'Home', icon: PROTO_ICONS.House },
  { route: 'proto-search', label: 'Search', icon: PROTO_ICONS.Search },
  { route: 'proto-profile', label: 'You', icon: PROTO_ICONS.User },
  { route: 'all', label: 'All', icon: PROTO_ICONS.LayoutGrid },
] as const

/**
 * Only the fields this bar reads. Narrower than `BottomTabBarProps`, which is
 * fine to accept and keeps the prototype off a deep react-navigation import.
 */
interface BarProps {
  state: { index: number; routes: { key: string; name: string }[] }
  navigation: { navigate: (name: string) => void }
}

export function VariantB() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props: BarProps) => <RaisedBar {...props} />}
    >
      {PARKED.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ href: null }} />
      ))}
    </Tabs>
  )
}

function RaisedBar({ state, navigation }: BarProps) {
  const tokens = useTokens()
  const insets = useSafeAreaInsets()
  const { group } = useGroup()
  const { user } = useUser()
  const [launcherOpen, setLauncherOpen] = useState(false)

  const activeName = state.routes[state.index]?.name
  const Plus = PROTO_ICONS.Plus
  const email = user?.primaryEmailAddress?.emailAddress ?? ''
  const initials = (user?.fullName?.trim() || email || '?')
    .slice(0, 1)
    .toUpperCase()

  const slot = (item: (typeof ITEMS)[number]) => {
    const active = activeName === item.route
    const Icon = item.icon
    // Profile is a face, not a glyph — the one slot that means a person.
    const isProfile = item.route === 'proto-profile'
    return (
      <Pressable
        key={item.route}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={item.label}
        onPress={() => navigation.navigate(item.route)}
        style={({ pressed }) => [styles.slot, pressed && styles.pressed]}
      >
        {isProfile ? (
          <View
            style={[
              styles.avatar,
              {
                backgroundColor: active ? tokens.fg : tokens.tile,
                borderColor: active ? tokens.fg : 'transparent',
              },
            ]}
          >
            <Text
              style={[
                styles.initials,
                { color: active ? tokens.bg : tokens.muted },
              ]}
            >
              {initials}
            </Text>
          </View>
        ) : (
          <Icon
            size={23}
            color={active ? tokens.fg : tokens.muted}
            strokeWidth={active ? 2.2 : 1.7}
          />
        )}
        {/* Label only under the active slot: the raised button already takes
            the eye, and four permanent captions fight it for attention. */}
        {active ? (
          <Text style={[styles.label, { color: tokens.fg }]}>{item.label}</Text>
        ) : (
          <View style={styles.labelSpacer} />
        )}
      </Pressable>
    )
  }

  return (
    <>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: tokens.surface,
            borderTopColor: tokens.border,
            paddingBottom: insets.bottom || 10,
          },
        ]}
      >
        {slot(ITEMS[0])}
        {slot(ITEMS[1])}

        <View style={styles.centre}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add"
            onPress={() => setLauncherOpen(true)}
            style={({ pressed }) => [
              styles.fab,
              { backgroundColor: tokens.fg },
              pressed && styles.fabPressed,
            ]}
          >
            <Plus size={26} color={tokens.bg} strokeWidth={2.4} />
          </Pressable>
        </View>

        {slot(ITEMS[2])}
        {slot(ITEMS[3])}
      </View>

      <ActionSheet
        visible={launcherOpen}
        groupName={group.name}
        onClose={() => setLauncherOpen(false)}
      />
    </>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 9,
  },
  slot: { flex: 1, alignItems: 'center', gap: 3, paddingTop: 2 },
  centre: { flex: 1, alignItems: 'center' },
  fab: {
    // Lifted so it breaks the bar's top edge — the shape that says "this one
    // is not a destination".
    marginTop: -22,
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabPressed: { opacity: 0.82, transform: [{ scale: 0.96 }] },
  avatar: {
    width: 25,
    height: 25,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 12, fontWeight: '700' },
  label: { fontSize: 11, fontWeight: '600' },
  labelSpacer: { height: 13 },
  pressed: { opacity: 0.6 },
})
