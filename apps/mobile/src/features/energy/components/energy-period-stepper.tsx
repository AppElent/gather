/**
 * The period a screen shows, with a step back and a step forward (Costs per
 * month's month pill, Usage's day, month and year). Forward stops at the
 * running period: there is nothing to show after today.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { haptics } from '../../../feedback/haptics'
import { UI_ICONS } from '../../../theme/icons'
import { RADIUS, SIZE, SPACE, TYPE, useTokens } from '../../../theme/tokens'

export function EnergyPeriodStepper({
  label,
  previousLabel,
  nextLabel,
  onPrevious,
  onNext,
  canGoNext,
  testID,
}: {
  label: string
  previousLabel: string
  nextLabel: string
  onPrevious: () => void
  onNext: () => void
  canGoNext: boolean
  testID?: string
}) {
  const tokens = useTokens()
  const step = (go: () => void) => () => {
    haptics.selectionChanged()
    go()
  }
  return (
    <View style={styles.row}>
      <Pressable
        testID={testID ? `${testID}-previous` : undefined}
        accessibilityRole="button"
        accessibilityLabel={previousLabel}
        onPress={step(onPrevious)}
        style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
      >
        <View style={[styles.circle, { backgroundColor: tokens.surface }]}>
          <UI_ICONS.ChevronLeft size={16} color={tokens.ink} strokeWidth={2.6} />
        </View>
      </Pressable>
      <View
        accessibilityRole="header"
        style={[styles.pill, { backgroundColor: tokens.surface }]}
      >
        <Text
          testID={testID ? `${testID}-label` : undefined}
          style={[TYPE.subhead, styles.label, { color: tokens.ink }]}
        >
          {label}
        </Text>
      </View>
      <Pressable
        testID={testID ? `${testID}-next` : undefined}
        accessibilityRole="button"
        accessibilityLabel={nextLabel}
        accessibilityState={{ disabled: !canGoNext }}
        disabled={!canGoNext}
        onPress={step(onNext)}
        style={({ pressed }) => [
          styles.arrow,
          !canGoNext && styles.inert,
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.circle, { backgroundColor: tokens.surface }]}>
          <UI_ICONS.ChevronRight size={16} color={tokens.ink} strokeWidth={2.6} />
        </View>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE[1],
  },
  arrow: {
    width: SIZE.hitMin,
    height: SIZE.hitMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    flexShrink: 1,
  },
  label: { fontWeight: '600', textAlign: 'center' },
  inert: { opacity: 0.35 },
  pressed: { opacity: 0.7 },
})
