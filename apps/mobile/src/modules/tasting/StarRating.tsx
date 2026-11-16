/**
 * The score: 1–5 in half steps, one scale for every Kind.
 *
 * Half steps are the whole reason this is not five buttons. Each star is the
 * empty outline with a whole glyph over it: `star.fill` for a full point and
 * `star.leadinghalf.filled` for a half (lucide's left-half star off iOS).
 *
 * **Each star carries two 44pt targets, not one.** The left half sets `n - 0.5`
 * and the right sets `n`, and both are taller than the star so a thumb landing
 * slightly low still hits — `apps/mobile/DESIGN_SYSTEM.md`'s rule about anything
 * under 44×44. That is also why the touch targets are absolutely positioned
 * rather than being the star itself.
 *
 * Read-only is the same component with the targets left out, so the stars on a
 * subject's header and the stars in the composer cannot drift apart.
 */
import { TASTING_RATING } from '@gather/core/tastings'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { haptics } from '../../feedback/haptics'
import { fmt, useI18n } from '../../i18n'
import { TABULAR, TYPE, useTokens } from '../../theme/tokens'
import { TASTING_UI_ICONS } from './icons'

const STARS = [1, 2, 3, 4, 5]

export interface StarRatingProps {
  /** `null` renders an empty row — nothing has been rated yet. */
  value: number | null
  /** Absent makes it read-only. */
  onChange?: (next: number) => void
  size?: number
  /** The number beside the stars. Off where a row is tight. */
  showValue?: boolean
  /** "from 3" — the count an average must never appear without. */
  count?: number
}

export function StarRating({
  value,
  onChange,
  size = 34,
  showValue = true,
  count,
}: StarRatingProps) {
  const tokens = useTokens('tasting')
  const { t } = useI18n()
  const Star = TASTING_UI_ICONS.Star
  const StarFilled = TASTING_UI_ICONS.StarFilled
  const StarHalf = TASTING_UI_ICONS.StarHalf
  const score = value ?? 0
  const words = t.tastings.composer

  function set(next: number) {
    if (!onChange) return
    haptics.selectionChanged()
    onChange(next)
  }

  return (
    <View style={styles.row}>
      <View
        accessibilityRole={onChange ? 'adjustable' : 'image'}
        accessibilityLabel={
          value === null
            ? t.tastings.index.noScore
            : fmt(words.scoreValue, { value: value.toFixed(1) })
        }
        accessibilityValue={
          onChange
            ? { min: TASTING_RATING.min, max: TASTING_RATING.max, now: score }
            : undefined
        }
        style={styles.stars}
      >
        {STARS.map((n) => {
          const filled = score - (n - 1)
          const Overlay =
            filled >= 1 ? StarFilled : filled >= 0.5 ? StarHalf : null
          return (
            <View key={n} style={{ width: size, height: size }}>
              <Star size={size} color={tokens.muted} strokeWidth={1.5} />
              {Overlay ? (
                <View style={styles.overlay} pointerEvents="none">
                  <Overlay
                    size={size}
                    color={tokens.ink}
                    fill={tokens.ink}
                    strokeWidth={1.5}
                  />
                </View>
              ) : null}
              {onChange ? (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={fmt(words.scoreValue, {
                      value: (n - 0.5).toFixed(1),
                    })}
                    onPress={() => set(n - 0.5)}
                    style={[
                      styles.half,
                      { width: size / 2, height: size + 10 },
                    ]}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={fmt(words.scoreValue, {
                      value: n.toFixed(1),
                    })}
                    onPress={() => set(n)}
                    style={[
                      styles.half,
                      { left: size / 2, width: size / 2, height: size + 10 },
                    ]}
                  />
                </>
              ) : null}
            </View>
          )
        })}
      </View>

      {showValue && value !== null ? (
        <Text
          style={[
            // Text, not a glyph: the big composer stars take a heading-sized
            // score, a row's small stars a footnote-sized one.
            size >= 24 ? styles.valueLarge : styles.valueSmall,
            { color: tokens.ink },
          ]}
        >
          {value.toFixed(1)}
        </Text>
      ) : null}

      {/* The average never appears without what it rests on: 5.0 from one
        person is not 5.0 from four. */}
      {count !== undefined && value !== null ? (
        <Text style={[styles.count, { color: tokens.muted }]}>
          {fmt(t.tastings.index.fromCount, { count })}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stars: { flexDirection: 'row', gap: 3 },
  overlay: { position: 'absolute', left: 0, top: 0 },
  half: { position: 'absolute', left: 0, top: -5 },
  valueLarge: { ...TYPE.title2, ...TABULAR, letterSpacing: -0.5 },
  valueSmall: { ...TYPE.footnoteStrong, ...TABULAR },
  count: { ...TYPE.footnote },
})
