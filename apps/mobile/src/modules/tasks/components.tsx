/**
 * The handful of pieces every taskActions screen is made of.
 *
 * Geometry is lifted from `modules/baby/Checklist.tsx` on purpose â€” 16px card
 * radius, 14px inset, a 21px box with a 1.6 stroke, 15.5px row text â€” because
 * the Tasks Module is meant to *adopt* that component rather than replace it,
 * and a taskActions drawn at different sizes would be judging a different screen.
 *
 * One thing here is deliberately not what the app does today: `PressRow`
 * highlights with a background fill and an Android ripple rather than
 * `opacity: 0.6`. `docs/mobile-interaction.md` calls the opacity default wrong
 * on both platforms, and a new screen is where that gets fixed rather than
 * inherited.
 */
import type { ReactNode } from 'react'
import {
  Platform,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native'

import { UI_ICONS } from '../../theme/icons'
import { RADIUS, useTokens } from '../../theme/tokens'

/**
 * The strip across the top of every taskActions.
 *
 * It is not decoration: these screens sit inside the real app, one tap from
 * real settings, and a made-up task list is indistinguishable from a real one
 * at a glance. It says so once per screen and then gets out of the way.
 */
/** The section heading above a card. */
export function SectionLabel({ children }: { children: ReactNode }) {
  const tokens = useTokens('home')
  return (
    <Text style={[styles.sectionLabel, { color: tokens.muted }]}>
      {typeof children === 'string' ? children.toUpperCase() : children}
    </Text>
  )
}

export function Card({
  children,
  style,
}: {
  children: ReactNode
  style?: ViewStyle
}) {
  const tokens = useTokens('home')
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: tokens.surface, borderColor: tokens.border },
        style,
      ]}
    >
      {children}
    </View>
  )
}

/**
 * A row inside a card, with the press feedback the platform actually uses.
 *
 * The divider is drawn on the bottom of every row but the last, and inset by
 * nothing â€” the card's own 14px padding is the inset, which is what makes a
 * run of rows read as one object rather than as stacked cards.
 */
export function PressRow({
  children,
  last = false,
  style,
  ...props
}: PressableProps & {
  children: ReactNode
  last?: boolean
  style?: ViewStyle
}) {
  const tokens = useTokens('home')

  return (
    <Pressable
      {...props}
      android_ripple={{ color: tokens.tile }}
      style={({ pressed }) => [
        styles.row,
        !last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: tokens.border,
        },
        // iOS fills the row; Android's ripple does its own drawing and must not
        // be painted over.
        pressed &&
          Platform.OS !== 'android' && { backgroundColor: tokens.tile },
        style,
      ]}
    >
      {children}
    </Pressable>
  )
}

/** The 21px box, ticked or not. */
export function Checkbox({ checked }: { checked: boolean }) {
  const tokens = useTokens('home')
  const tint = tokens.tintOf('home')
  const Check = UI_ICONS.Check

  return (
    <View
      style={[
        styles.box,
        {
          borderColor: checked ? tint.fg : tokens.border,
          backgroundColor: checked ? tint.fg : 'transparent',
        },
      ]}
    >
      {checked ? (
        <Check size={14} color={tokens.surface} strokeWidth={3} />
      ) : null}
    </View>
  )
}

/**
 * A label on a task, or a suggestion in the label sheet.
 *
 * `remove` draws the cross. A lit chip has always removed itself on tap, but
 * nothing said so â€” a filled pill reads as a state, not as a button, and the
 * first report back from the taskActions was that labels could only be added.
 * The cross is not a second target: the whole chip is still one press.
 */
export function Chip({
  label,
  on = false,
  remove = false,
  onPress,
  accessibilityLabel,
}: {
  label: string
  on?: boolean
  remove?: boolean
  onPress?: () => void
  accessibilityLabel?: string
}) {
  const tokens = useTokens('home')
  const tint = tokens.tintOf('home')
  const X = UI_ICONS.X
  const body = (
    <View
      style={[
        styles.chip,
        remove && styles.chipWithRemove,
        {
          backgroundColor: on ? tint.bg : tokens.tile,
          borderColor: on ? tint.fg : 'transparent',
        },
      ]}
    >
      <Text style={[styles.chipText, { color: on ? tint.fg : tokens.muted }]}>
        {label}
      </Text>
      {remove ? (
        <X
          size={12}
          color={on ? tint.fg : tokens.muted}
          strokeWidth={2.6}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      ) : null}
    </View>
  )

  if (!onPress) return body

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => (pressed ? styles.pressedChip : undefined)}
    >
      {body}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: RADIUS.control,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  bannerText: { fontSize: 12.5, lineHeight: 18, fontWeight: '600' },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingHorizontal: 4,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 50,
  },
  box: {
    width: 21,
    height: 21,
    borderRadius: 6,
    borderWidth: 1.6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  chipWithRemove: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chipText: { fontSize: 11.5, fontWeight: '700' },
  pressedChip: { opacity: 0.7 },
})
