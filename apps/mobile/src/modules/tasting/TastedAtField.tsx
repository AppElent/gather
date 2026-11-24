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
import { addDays, localMidnight, todayIn } from '@gather/core/civil-date'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { haptics } from '../../feedback/haptics'
import { useGroup } from '../../group/GroupProvider'
import { useI18n } from '../../i18n'
import { RADIUS, TYPE, useTokens } from '../../theme/tokens'
import { TASTING_UI_ICONS } from './icons'

/** The same day, `days` later or earlier. Never past today. */
function shiftTastedAt(iso: string, days: number, today: string): string {
  const shifted = addDays(iso, days)
  // You cannot have tasted it tomorrow. Clamping rather than disabling the
  // button keeps the two steppers the same size and the same shape.
  return shifted > today ? today : shifted
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
  const words = t.tastings.composer
  const Calendar = TASTING_UI_ICONS.Calendar

  const { group } = useGroup()
  const today = todayIn(group.timeZone)
  const yesterday = addDays(today, -1)
  const label =
    value === today
      ? words.today
      : value === yesterday
        ? words.yesterday
        : localMidnight(value).toLocaleDateString(locale, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })

  function step(days: number) {
    const next = shiftTastedAt(value, days, today)
    if (next === value) return
    haptics.selectionChanged()
    onChange(next)
  }

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: tokens.surface, borderColor: tokens.hair },
      ]}
    >
      <Calendar size={17} color={tokens.muted} strokeWidth={1.9} />
      <Text style={[styles.label, { color: tokens.muted }]}>
        {words.tastedAt}
      </Text>
      <Text style={[styles.value, { color: tokens.ink }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={words.earlierDay}
        disabled={disabled}
        onPress={() => step(-1)}
        hitSlop={8}
        style={({ pressed }) => [styles.step, pressed && styles.pressed]}
      >
        <Text style={[styles.glyph, { color: tokens.accentText }]}>−</Text>
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
        <Text style={[styles.glyph, { color: tokens.accentText }]}>+</Text>
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
    borderRadius: RADIUS.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: { ...TYPE.subhead },
  value: { ...TYPE.bodyStrong, flex: 1, textAlign: 'right' },
  step: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { ...TYPE.title2 },
  pressed: { opacity: 0.5 },
})
