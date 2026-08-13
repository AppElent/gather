/**
 * PROTOTYPE (#146) — the shell's own pages, reached from Home's avatar.
 *
 * Settings, Account and Groups belong to no Group (the web keeps them out of
 * the Topbar's Group-scoped navigation on purpose), so they live on the root
 * stack *above* the tabs: pushing one covers the tab bar and the back gesture
 * returns. That is the question this screen exists to make visible.
 */
import { router, Stack } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { RADIUS, useTokens } from '../tokens'
import { Icon } from '../ui'

const ROWS = [
  { href: '/account', label: 'Account', hint: 'Name, email, password', icon: 'person' },
  { href: '/settings', label: 'Settings', hint: 'Theme and language', icon: 'tune' },
  { href: '/groups', label: 'Groups', hint: 'Create, join, leave', icon: 'group' },
]

export default function You() {
  const t = useTokens()
  return (
    <>
      <Stack.Screen options={{ title: 'Eric Jansen' }} />
      <ScrollView
        style={{ backgroundColor: t.bg }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        {ROWS.map((row) => (
          <Pressable
            key={row.href}
            accessibilityRole="button"
            onPress={() => router.push(row.href as never)}
            style={[
              styles.row,
              { backgroundColor: t.surface, borderColor: t.border },
            ]}
          >
            <Icon name={row.icon} size={20} color={t.fg} />
            <View style={styles.rowText}>
              <Text style={[styles.label, { color: t.fg }]}>{row.label}</Text>
              <Text style={[styles.hint, { color: t.muted }]}>{row.hint}</Text>
            </View>
            <Icon name="chevron-right" size={20} color={t.muted} />
          </Pressable>
        ))}
        <Text style={[styles.note, { color: t.muted }]}>
          None of these depend on a Group.
        </Text>
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: RADIUS.control,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    minHeight: 56,
  },
  rowText: { flex: 1, gap: 2 },
  label: { fontSize: 15, fontWeight: '600' },
  hint: { fontSize: 11 },
  note: { fontSize: 12, marginTop: 6 },
})
