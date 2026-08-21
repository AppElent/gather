/**
 * The When row: what moment this entry is recorded at.
 *
 * It defaults to now and stays collapsed, because most logging happens as it
 * happens and a date picker in the way of every feed is four taps nobody asked
 * for. It opens when you press it, because the 3am feed gets written up at 7am
 * and an entry that can only say "now" is wrong on exactly the ones that
 * matter.
 *
 * Open, it is three steppers — day, hour, minutes — and nothing else. Relative
 * shortcuts ("30m ago") were tried and dropped: they answer only the case where
 * you happen to want exactly that offset, they push the controls that always
 * work further down the sheet, and a row of chips beside a stepper reads as the
 * set of allowed answers rather than as a shortcut.
 *
 * The time is formatted in the **app's** language, not the device's, because
 * this app has its own language toggle and a screen that mixes the two reads
 * as a bug (ADR-0011).
 */
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useI18n } from '../../i18n'
import { RADIUS, useTokens } from '../../theme/tokens'
import { daysApart, shiftDays, shiftMinutes } from './entryTime'

export interface DateTimeFieldProps {
  value: number
  onChange: (next: number) => void
  /** The moment the sheet opened — what "Today" and "Yesterday" are measured from. */
  now: number
  open: boolean
  onToggle: () => void
}

export function DateTimeField({
  value,
  onChange,
  now,
  open,
  onToggle,
}: DateTimeFieldProps) {
  const tokens = useTokens('home')
  const { t, locale } = useI18n()
  const tint = tokens.tintOf('home')
  const text = t.baby.log.entry

  const time = new Date(value).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  })
  const offset = daysApart(now, value)
  const day =
    offset === 0
      ? text.today
      : offset === -1
        ? text.yesterday
        : new Date(value).toLocaleDateString(locale, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })

  function stepper(
    label: string,
    display: string,
    decreaseLabel: string,
    increaseLabel: string,
    onStep: (direction: 1 | -1) => void,
    grow: number,
  ) {
    return (
      <View style={[styles.stepperWrap, { flex: grow }]}>
        <Text style={[styles.stepperLabel, { color: tokens.muted }]}>
          {label.toUpperCase()}
        </Text>
        <View
          style={[
            styles.stepper,
            { borderColor: tokens.border, backgroundColor: tokens.surface },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={decreaseLabel}
            onPress={() => onStep(-1)}
            style={({ pressed }) => [styles.step, pressed && styles.pressed]}
          >
            <Text style={[styles.stepGlyph, { color: tint.fg }]}>−</Text>
          </Pressable>
          <Text
            numberOfLines={1}
            style={[styles.stepValue, { color: tokens.fg }]}
          >
            {display}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={increaseLabel}
            onPress={() => onStep(1)}
            style={({ pressed }) => [styles.step, pressed && styles.pressed]}
          >
            <Text style={[styles.stepGlyph, { color: tint.fg }]}>+</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  const parts = new Date(value)

  return (
    <View
      style={[
        styles.wrap,
        { borderColor: tokens.border, backgroundColor: tokens.bg },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${text.when}, ${day} ${time}. ${text.editWhen}`}
        onPress={onToggle}
        style={({ pressed }) => [styles.summary, pressed && styles.pressed]}
      >
        <Text style={[styles.summaryLabel, { color: tokens.muted }]}>
          {text.when}
        </Text>
        <Text style={[styles.summaryValue, { color: tokens.fg }]}>
          {offset === 0 ? time : `${day} ${time}`}
        </Text>
        <Text style={[styles.summaryAction, { color: tint.fg }]}>
          {open ? t.actions.done : text.editWhen}
        </Text>
      </Pressable>

      {open ? (
        <View style={[styles.editor, { borderTopColor: tokens.border }]}>
          <View style={styles.steppers}>
            {stepper(
              text.date,
              day,
              text.earlierDay,
              text.laterDay,
              (direction) => onChange(shiftDays(value, direction)),
              1.5,
            )}
            {stepper(
              text.hour,
              String(parts.getHours()).padStart(2, '0'),
              text.earlierHour,
              text.laterHour,
              (direction) => onChange(shiftMinutes(value, direction * 60)),
              1,
            )}
            {stepper(
              text.minute,
              String(parts.getMinutes()).padStart(2, '0'),
              text.earlierMinute,
              text.laterMinute,
              (direction) => onChange(shiftMinutes(value, direction * 5)),
              1,
            )}
          </View>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
    overflow: 'hidden',
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  summaryLabel: { fontSize: 15 },
  summaryValue: { flex: 1, fontSize: 16, fontWeight: '600' },
  summaryAction: { fontSize: 14, fontWeight: '600' },
  editor: { borderTopWidth: StyleSheet.hairlineWidth, padding: 12, gap: 12 },
  steppers: { flexDirection: 'row', gap: 8 },
  stepperWrap: { gap: 5 },
  stepperLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
    overflow: 'hidden',
  },
  step: {
    width: 40,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepGlyph: { fontSize: 22, fontWeight: '600', lineHeight: 26 },
  stepValue: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.6 },
})
