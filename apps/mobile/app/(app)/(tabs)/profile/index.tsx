import { useUser } from '@clerk/expo'
import { router } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useGroup } from '../../../../src/group/GroupProvider'
import { fmt, useI18n } from '../../../../src/i18n'
import { RADIUS, useTokens } from '../../../../src/theme/tokens'

const DESTINATIONS = ['account', 'groups', 'settings'] as const

/** The persistent Profile destination and its in-tab utility navigation. */
export default function Profile() {
  const tokens = useTokens()
  const insets = useSafeAreaInsets()
  const { user } = useUser()
  const { group } = useGroup()
  const { t } = useI18n()
  const text = t.shell.profile
  const email = user?.primaryEmailAddress?.emailAddress ?? ''
  const name = user?.fullName?.trim()
  const initials = (name ?? email).slice(0, 1).toUpperCase()

  return (
    <ScrollView
      style={{ backgroundColor: tokens.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 44, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <View style={styles.identity}>
        <View style={[styles.avatar, { backgroundColor: tokens.tile }]}>
          <Text style={[styles.initials, { color: tokens.fg }]}>
            {initials}
          </Text>
        </View>
        <View style={styles.identityText}>
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            selectable
            style={[styles.name, { color: tokens.fg }]}
          >
            {name ?? email}
          </Text>
          <Text
            numberOfLines={1}
            selectable
            style={[styles.group, { color: tokens.muted }]}
          >
            {fmt(text.group, { group: group.name })}
          </Text>
        </View>
      </View>
      <View style={styles.rows}>
        {DESTINATIONS.map((destination) => (
          <Pressable
            key={destination}
            accessibilityRole="button"
            accessibilityLabel={text.destinations[destination].label}
            onPress={() => router.push(`/profile/${destination}`)}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: tokens.surface, borderColor: tokens.border },
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, { color: tokens.fg }]}>
                {text.destinations[destination].label}
              </Text>
              <Text style={[styles.rowDetail, { color: tokens.muted }]}>
                {text.destinations[destination].detail}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 22, fontWeight: '700' },
  identityText: { flex: 1, gap: 3 },
  name: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  group: { fontSize: 15 },
  rows: { marginTop: 26, gap: 8 },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    paddingVertical: 14,
    paddingHorizontal: 15,
  },
  rowText: { gap: 2 },
  rowLabel: { fontSize: 16, fontWeight: '600' },
  rowDetail: { fontSize: 13 },
  pressed: { opacity: 0.7 },
})
