/**
 * The collapsed **Completed (n)** row at the bottom of a list
 * (`components/CompletedSection`). Completing a task puts it away here.
 *
 * A `surface` row with the card corner: a 24 pt disc in the group's fill with
 * its `on` check (a status mark, not a tile), "Completed" in `body`, the count
 * in `muted` with tabular figures, and a chevron. Collapsed by default; it
 * expands in place and says so to assistive technology. Nothing at all when
 * the count is 0.
 */
import { type ReactNode, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import { UI_ICONS } from '../theme/icons'
import {
  type ModuleGroup,
  RADIUS,
  SIZE,
  SPACE,
  TABULAR,
  TYPE,
  useTokens,
} from '../theme/tokens'

/** The check disc: 24 pt, a status mark rather than one of the four tiles. */
const DISC = 24

export function CompletedSection({
  count,
  group,
  label,
  children,
  initiallyExpanded = false,
  testID = 'completed-toggle',
  action,
}: {
  count: number
  group: ModuleGroup
  /** "Completed", from `@gather/core`. */
  label: string
  /** The completed rows, drawn when expanded. */
  children: ReactNode
  initiallyExpanded?: boolean
  testID?: string
  /**
   * A button at the row's end that acts on every completed row at once: a
   * grocery list's Put back (APP-310). Its own target, beside the toggle.
   */
  action?: {
    label: string
    accessibilityLabel: string
    onPress: () => void
    disabled?: boolean
    testID?: string
  }
}) {
  const tokens = useTokens()
  const tint = tokens.tintOf(group)
  const [expanded, setExpanded] = useState(initiallyExpanded)

  if (count <= 0) {
    // Emptied while open: the next completed row starts put away again.
    if (expanded) setExpanded(false)
    return null
  }

  const toggle = (
    <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label} (${count})`}
        accessibilityState={{ expanded }}
        android_ripple={{ color: tokens.surface2 }}
        onPress={() => setExpanded((open) => !open)}
        style={({ pressed }) => [
          styles.row,
          action ? styles.withAction : null,
          { backgroundColor: tokens.surface },
          pressed &&
            Platform.OS !== 'android' && { backgroundColor: tokens.surface2 },
        ]}
      >
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.disc, { backgroundColor: tint.fill }]}
        >
          <UI_ICONS.Check size={14} color={tint.on} strokeWidth={2.6} />
        </View>
        <Text style={[styles.label, { color: tokens.ink }]}>
          {label}{' '}
          <Text style={[styles.count, { color: tokens.muted }]}>({count})</Text>
        </Text>
        <View style={expanded ? styles.flipped : undefined}>
          <UI_ICONS.ChevronDown
            size={17}
            color={tokens.muted}
            strokeWidth={2.2}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </View>
      </Pressable>
  )

  return (
    <View style={styles.wrap}>
      {action ? (
        <View
          style={[styles.actionRow, { backgroundColor: tokens.surface }]}
        >
          {toggle}
          <Pressable
            testID={action.testID}
            accessibilityRole="button"
            accessibilityLabel={action.accessibilityLabel}
            accessibilityState={{ disabled: action.disabled }}
            disabled={action.disabled}
            hitSlop={8}
            onPress={action.onPress}
            style={({ pressed }) => [
              styles.action,
              pressed && { backgroundColor: tokens.surface2 },
            ]}
          >
            <Text style={[styles.actionLabel, { color: tokens.ink }]}>
              {action.label}
            </Text>
          </Pressable>
        </View>
      ) : (
        toggle
      )}
      {expanded ? children : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE[3] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[3],
    minHeight: SIZE.rowMin,
    paddingHorizontal: SPACE[4],
    paddingVertical: SPACE[2],
    borderRadius: RADIUS.card,
    overflow: 'hidden',
  },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...TYPE.body, flex: 1 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: RADIUS.card,
    overflow: 'hidden',
  },
  withAction: { flex: 1, borderRadius: 0 },
  action: {
    minHeight: SIZE.hitMin,
    paddingHorizontal: SPACE[4],
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { ...TYPE.subhead, fontWeight: '600' },
  count: { ...TABULAR },
  flipped: { transform: [{ rotate: '180deg' }] },
})
