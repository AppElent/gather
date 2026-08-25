/**
 * Five stars, read or tapped.
 *
 * The whole point of it on a phone: recording "that was good" is one thumb and
 * not a form. Tapping the star you are already on clears the rating, which is
 * the only way back to *unrated* without an extra control — and is what people
 * expect from every other five-star row they have ever used.
 *
 * `onChange` absent means read-only, and that is how a recipe shared into your
 * Group renders. Nothing is greyed out and nothing is hidden: the stars are
 * still the record, they simply do not answer a tap, because offering an action
 * that can only fail is worse than not offering it (ADR-0009's sibling rule).
 */
import { Pressable, StyleSheet, View } from 'react-native'

import { type ModuleGroup, useTokens } from '../../theme/tokens'
import { RECIPE_UI_ICONS } from './icons'

const STARS = [1, 2, 3, 4, 5] as const

export interface StarRatingProps {
  value: number | undefined
  /** Absent for a recipe you may only read. */
  onChange?: (rating: number | undefined) => void
  size?: number
  group?: ModuleGroup
  /** Resolved by the caller: "Rate Sunday roast", already in the reader's language. */
  accessibilityLabel?: string
  testID?: string
}

export function StarRating({
  value,
  onChange,
  size = 22,
  group = 'kitchen',
  accessibilityLabel,
  testID,
}: StarRatingProps) {
  const tokens = useTokens(group)
  const tint = tokens.tintOf(group)

  return (
    <View
      style={styles.row}
      accessibilityRole={onChange ? 'adjustable' : 'text'}
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 5, now: value ?? 0 }}
      testID={testID}
    >
      {STARS.map((star) => {
        const filled = (value ?? 0) >= star
        const Star = filled ? RECIPE_UI_ICONS.StarFilled : RECIPE_UI_ICONS.Star
        const glyph = (
          <Star
            size={size}
            color={filled ? tint.fg : tokens.border}
            fill={filled ? tint.fg : 'none'}
            strokeWidth={1.8}
          />
        )
        if (!onChange)
          return (
            <View key={star} style={styles.star}>
              {glyph}
            </View>
          )
        return (
          <Pressable
            key={star}
            accessibilityRole="button"
            accessibilityLabel={String(star)}
            testID={testID && `${testID}-${star}`}
            hitSlop={8}
            // Tapping the current rating clears it; anything else sets it.
            onPress={() => onChange(value === star ? undefined : star)}
            style={({ pressed }) => [styles.star, pressed && styles.pressed]}
          >
            {glyph}
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  star: { paddingVertical: 6, paddingHorizontal: 3 },
  pressed: { opacity: 0.6 },
})
