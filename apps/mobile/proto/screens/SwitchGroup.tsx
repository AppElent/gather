/**
 * PROTOTYPE (#146) — the Group switcher as an addressed sheet (#145 §3).
 *
 * A route with `presentation: 'formSheet'`, so the back gesture and swipe-down
 * both dismiss it for free. Ends with "Manage groups", which is the slow path.
 *
 * Switching resets every stack to its root (#145 §5) — here, `dismissAll` then
 * a `replace` onto Home.
 */
import { router, useLocalSearchParams } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { GROUPS } from '../catalog'
import { homeHref, useProto } from '../state'
import type { Variant } from '../state'
import { RADIUS, useTokens } from '../tokens'
import { Icon } from '../ui'

export default function SwitchGroup() {
  const t = useTokens()
  const { v } = useLocalSearchParams<{ v?: string }>()
  const variant = (v ?? 'a') as Variant
  const { groupSlug, setGroup } = useProto()

  function choose(slug: string) {
    setGroup(slug)
    // Dismiss the sheet and land on Home in the new Group. Every other stack
    // unwinds itself — see `Module.tsx`'s reset (#145 §5).
    router.dismissTo(homeHref(variant) as never)
  }

  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: t.fg }]}>Your Groups</Text>
      {GROUPS.map((group) => {
        const current = group.slug === groupSlug
        return (
          <Pressable
            key={group.slug}
            accessibilityRole="button"
            onPress={() => choose(group.slug)}
            style={[
              styles.row,
              { backgroundColor: t.surface, borderColor: t.border },
            ]}
          >
            <View style={styles.rowText}>
              <Text style={[styles.name, { color: t.fg }]}>{group.name}</Text>
              <Text style={[styles.meta, { color: t.muted }]}>
                {group.personal ? 'Personal' : 'Shared'}
              </Text>
            </View>
            {current ? <Icon name="check" size={20} color={t.fg} /> : null}
          </Pressable>
        )
      })}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/groups' as never)}
        style={[styles.row, { backgroundColor: t.tile, borderColor: t.border }]}
      >
        <Text style={[styles.name, { color: t.fg }]}>Manage groups</Text>
        <View style={styles.spacer} />
        <Icon name="chevron-right" size={20} color={t.muted} />
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: RADIUS.control,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    minHeight: 54,
  },
  rowText: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 11 },
  spacer: { flex: 1 },
})
