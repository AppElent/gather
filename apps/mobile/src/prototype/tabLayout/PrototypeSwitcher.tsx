/**
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * The floating pills that flip between the treatments — one per axis, stacked.
 * The top one is the bar (`variant.ts`). The one under it forces every quick
 * action to a single kind (`kindOverride.ts`), which is a measuring instrument
 * rather than a design choice: the design is that each Module declares its own,
 * and `declared` is the setting that shows it.
 *
 * Top-centre, not bottom-centre as the prototype recipe asks for: the bottom of
 * this screen is the thing being evaluated, and a pill sitting on top of the
 * tab bar would hide the only part that matters. High-contrast black-on-white
 * so it reads as scaffolding rather than as a control the design owns.
 *
 * `__DEV__` guards the render, so a stray merge cannot ship it.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { UI_ICONS } from '../../theme/icons'
import { cycleOverride, OVERRIDE_NAMES, useOverride } from './kindOverride'
import { cycleVariant, useVariant, VARIANT_NAMES } from './variant'

export function PrototypeSwitcher() {
  const insets = useSafeAreaInsets()
  const variant = useVariant()
  const override = useOverride()

  if (!__DEV__) return null

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { top: insets.top + 6 }]}
    >
      <Pill
        axis="variant"
        text={`${variant} — ${VARIANT_NAMES[variant]}`}
        onCycle={cycleVariant}
      />
      <Pill
        axis="quick action kind"
        text={`Actions: ${OVERRIDE_NAMES[override]}`}
        onCycle={cycleOverride}
        muted
      />
    </View>
  )
}

function Pill({
  axis,
  text,
  onCycle,
  muted,
}: {
  axis: string
  text: string
  onCycle: (step: 1 | -1) => void
  muted?: boolean
}) {
  const Left = UI_ICONS.ChevronLeft
  const Right = UI_ICONS.ChevronRight

  return (
    <View style={[styles.pill, muted && styles.pillMuted]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Previous ${axis}`}
        onPress={() => onCycle(-1)}
        hitSlop={10}
        style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
      >
        <Left size={18} color="#ffffff" />
      </Pressable>

      <Text style={styles.label} numberOfLines={1}>
        {text}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Next ${axis}`}
        onPress={() => onCycle(1)}
        hitSlop={10}
        style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
      >
        <Right size={18} color="#ffffff" />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 5,
    zIndex: 1000,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(12,12,12,0.92)',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  // Dimmer so the two pills read as a hierarchy rather than as one control
  // split in half.
  pillMuted: { backgroundColor: 'rgba(12,12,12,0.72)' },
  arrow: { padding: 3 },
  pressed: { opacity: 0.55 },
  label: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    maxWidth: 250,
  },
})
