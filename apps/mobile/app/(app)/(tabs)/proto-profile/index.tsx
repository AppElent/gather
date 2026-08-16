/**
 * PROTOTYPE — throwaway. See `src/prototype/tabLayout/README.md`.
 *
 * Profile as a tab — the slot the new layout adds, so the prototype should make
 * its cost visible rather than hide it behind a nice screen.
 *
 * What it holds is what already exists: the account, the Groups, and Settings —
 * today all reachable through the one gear on Home. The deliberately thin
 * content is the honest answer to "is a permanent fifth slot worth moving that
 * gear".
 *
 * ## Settled in round one
 *
 * The rows push this folder's own addresses (`/proto-profile/account`), which
 * live in the tab's own stack, so the tab bar survives the push. The variant
 * that pushed the flat `/account` — and watched the bar vanish, as the gear on
 * Home still does — was A, and it lost. Round two no longer offers it.
 *
 * The flat routes still exist and are still reached by Home's gear, which is
 * the finding rather than an oversight: nesting means one screen answering to
 * two addresses, and every link *inside* those screens has to be re-pointed
 * too. `app/(app)/settings.tsx` still pushes `/account`, so Profile → Settings
 * keeps the bar and Account from inside it does not.
 */
import { useUser } from '@clerk/expo'
import { router } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useGroup } from '../../../../src/group/GroupProvider'
import { RADIUS, useTokens } from '../../../../src/theme/tokens'

const ROWS = [
  {
    label: 'Account',
    detail: 'Name, email, sign out',
    href: '/proto-profile/account',
  },
  {
    label: 'Groups',
    detail: 'Households you are in',
    href: '/proto-profile/groups',
  },
  {
    label: 'Settings',
    detail: 'Appearance and language',
    href: '/proto-profile/settings',
  },
] as const

export default function ProtoProfile() {
  const tokens = useTokens()
  const insets = useSafeAreaInsets()
  const { user } = useUser()
  const { group } = useGroup()

  const email = user?.primaryEmailAddress?.emailAddress ?? ''
  const name = user?.fullName?.trim()
  const initials = (name ?? email).slice(0, 1).toUpperCase()

  return (
    <ScrollView
      style={{ backgroundColor: tokens.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 44, paddingBottom: insets.bottom + 120 },
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
            style={[styles.name, { color: tokens.fg }]}
          >
            {name ?? email}
          </Text>
          <Text numberOfLines={1} style={[styles.group, { color: tokens.muted }]}>
            In {group.name}
          </Text>
        </View>
      </View>

      <View style={styles.rows}>
        {ROWS.map((row) => (
          <Pressable
            key={row.label}
            accessibilityRole="button"
            accessibilityLabel={row.label}
            onPress={() => router.push(row.href)}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: tokens.surface, borderColor: tokens.border },
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, { color: tokens.fg }]}>
                {row.label}
              </Text>
              <Text style={[styles.rowDetail, { color: tokens.muted }]}>
                {row.detail}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.note, { color: tokens.muted }]}>
        These push inside the Profile tab, so the bar stays. Open Settings, then
        Account from inside it: that one still escapes, because the real screen
        links to the flat address.
      </Text>
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
  note: { marginTop: 22, fontSize: 13, lineHeight: 19 },
})
