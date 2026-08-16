/**
 * PROTOTYPE — throwaway. See `src/prototype/tabLayout/README.md`.
 *
 * Add as a **destination**, which only variant D believes in. E, F, C and B
 * open `ActionSheet` over wherever you already were — the whole argument
 * between them is whether "Add" is a place or a verb, and this screen is what
 * it looks like if it is a place.
 *
 * A grid rather than the sheet's rows, on purpose: a full screen that renders a
 * short list of rows is exactly the emptiness that makes an Add *tab* feel like
 * a wasted slot, and the prototype should not hide that by filling the space.
 *
 * Picking a tile pushes `/proto-create`, because a destination has nowhere to
 * put a capture field that a sheet does not have better. **Count the hops**:
 * tab, then screen, then form, then find your way back. That is the cost of
 * Add being a place, and it is the whole reason to compare this against E's
 * one tap and a text field.
 */
import { router } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useGroup } from '../../../src/group/GroupProvider'
import { QUICK_ACTIONS } from '../../../src/prototype/tabLayout/actions'
import { MODULE_ICONS } from '../../../src/theme/icons'
import { RADIUS, useTokens } from '../../../src/theme/tokens'

export default function ProtoAdd() {
  const tokens = useTokens()
  const insets = useSafeAreaInsets()
  const { group } = useGroup()

  return (
    <ScrollView
      style={{ backgroundColor: tokens.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 44, paddingBottom: insets.bottom + 120 },
      ]}
    >
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: tokens.fg }]}
      >
        Add
      </Text>
      <Text style={[styles.scope, { color: tokens.muted }]}>
        To {group.name}. Only actions that work today.
      </Text>

      <View style={styles.grid}>
        {QUICK_ACTIONS.map((action) => {
          const tint = tokens.tintOf(action.group)
          const Icon = MODULE_ICONS[action.icon]
          return (
            <Pressable
              key={action.id}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={() =>
                router.push({
                  pathname: '/proto-create',
                  params: { action: action.id },
                })
              }
              style={({ pressed }) => [
                styles.cell,
                { backgroundColor: tint.bg },
                pressed && styles.pressed,
              ]}
            >
              <Icon size={24} color={tint.fg} strokeWidth={1.8} />
              <Text style={[styles.cellLabel, { color: tint.fg }]}>
                {action.label}
              </Text>
              <Text style={[styles.cellModule, { color: tint.fg }]}>
                {action.module}
              </Text>
            </Pressable>
          )
        })}
      </View>

      <Text style={[styles.stub, { color: tokens.muted }]}>
        Every tile pushes a create form on top of this screen. You are three
        taps from a saved task, and the way back is yours to find.
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 6 },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  scope: { fontSize: 15, lineHeight: 22 },
  grid: {
    marginTop: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cell: {
    width: '47.5%',
    minHeight: 108,
    borderRadius: RADIUS.card,
    padding: 14,
    gap: 6,
    justifyContent: 'flex-end',
  },
  cellLabel: { fontSize: 15, fontWeight: '700' },
  cellModule: { fontSize: 12, opacity: 0.8 },
  pressed: { opacity: 0.72 },
  stub: { marginTop: 22, fontSize: 14 },
})
