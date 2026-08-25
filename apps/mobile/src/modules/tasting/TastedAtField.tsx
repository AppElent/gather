/**
 * The day it was tasted — a date, deliberately, and never a time.
 *
 * A tasting happens over an evening, not at 19:04, so the record is a plain
 * `YYYY-MM-DD`. It defaults to today because most logging happens the same
 * night, and it steps because the case that matters is writing up Saturday's
 * dinner on Monday (story 12) — two presses, not a calendar.
 *
 * Steppers rather than a native date picker for the Baby log's reason: the
 * picker is a modal inside a form, it looks different on each platform, and
 * "two days ago" is the whole range anybody uses. A date far in the past is
 * rare enough to be worth four presses.
 *
 * Formatted in the **app's** language, not the device's — this app has its own
 * language toggle and a screen that mixes the two reads as a bug (ADR-0011).
 */
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { haptics } from '../../feedback/haptics'
import { useI18n } from '../../i18n'
import { RADIUS, useTokens } from '../../theme/tokens'
import { TASTING_UI_ICONS } from './icons'

const DAY_MS = 24 * 60 * 60 * 1000

/** Today, as the plain day string the mutation takes. */
export function todayIso(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10)
}

/** The same day, `days` later or earlier. Never past today. */
export function shiftIso(iso: string, days: number, now = Date.now()): string {
  const shifted = new Date(`${iso}T00:00:00Z`).getTime() + days * DAY_MS
  // You cannot have tasted it tomorrow. Clamping rather than disabling the
  // button keeps the two steppers the same size and the same shape.
  return new Date(Math.min(shifted, new Date(todayIso(now)).getTime()))
    .toISOString()
    .slice(0, 10)
}

export function TastedAtField({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (next: string) => void
  disabled?: boolean
}) {
  const tokens = useTokens('tasting')
  const { t, locale } = useI18n()
  const tint = tokens.tintOf('tasting')
  const words = t.tastings.composer
  const Calendar = TASTING_UI_ICONS.Calendar

  const today = todayIso()
  const yesterday = shiftIso(today, -1)
  const label =
    value === today
      ? words.today
      : value === yesterday
        ? words.yesterday
        : new Date(`${value}T00:00:00Z`).toLocaleDateString(locale, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            timeZone: 'UTC',
          })

  function step(days: number) {
    const next = shiftIso(value, days)
    if (next === value) return
    haptics.selectionChanged()
    onChange(next)
  }

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: tokens.surface, borderColor: tokens.border },
      ]}
    >
      <Calendar size={17} color={tokens.muted} strokeWidth={1.9} />
      <Text style={[styles.label, { color: tokens.muted }]}>
        {words.tastedAt}
      </Text>
      <Text style={[styles.value, { color: tokens.fg }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={words.earlierDay}
        disabled={disabled}
        onPress={() => step(-1)}
        hitSlop={8}
        style={({ pressed }) => [styles.step, pressed && styles.pressed]}
      >
        <Text style={[styles.glyph, { color: tint.fg }]}>−</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={words.laterDay}
        disabled={disabled || value === today}
        onPress={() => step(1)}
        hitSlop={8}
        style={({ pressed }) => [
          styles.step,
          (pressed || value === today) && styles.pressed,
        ]}
      >
        <Text style={[styles.glyph, { color: tint.fg }]}>+</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    paddingLeft: 14,
    paddingRight: 4,
    borderRadius: RADIUS.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: 15 },
  value: { flex: 1, textAlign: 'right', fontSize: 16, fontWeight: '600' },
  step: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontSize: 22, fontWeight: '600', lineHeight: 26 },
  pressed: { opacity: 0.5 },
})
