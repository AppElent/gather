/**
 * A date or a time, picked the way the platform picks them.
 *
 * The field is a chip showing the formatted value. Tapping it opens the
 * platform's own picker: on iOS the wheel or calendar expands in place under
 * the row, as in Calendar's event editor; on Android the system dialog opens.
 *
 * iOS does not use the compact picker: hosted inside React Native it sizes to
 * nothing in a row, and tapping it switches to a keyboard-entry mode that
 * draws its editing value over the resting one.
 *
 * The chip and the picker are separate so a row of two chips (a start and an
 * end) can open one full-width picker below the row. The caller holds which one
 * is open. Values are `Date`s; callers keep whatever they store (an ISO day,
 * minutes since midnight) and convert at this edge.
 */
import { DateTimePicker } from '@expo/ui/community/datetime-picker'
import { Platform, Pressable, StyleSheet, Text } from 'react-native'

import { useI18n } from '../i18n'
import { RADIUS, useTokens } from '../theme/tokens'

type Mode = 'date' | 'time'

/** The iOS picker takes an underscore identifier; the app's locale is a language. */
const PICKER_LOCALE = { en: 'en_GB', nl: 'nl_NL' } as const

export function DateTimeChip({
  mode,
  value,
  open,
  onPress,
  accessibilityLabel,
  testID,
}: {
  mode: Mode
  value: Date
  open: boolean
  onPress: () => void
  accessibilityLabel: string
  testID?: string
}) {
  const tokens = useTokens('home')
  const { locale } = useI18n()
  const label =
    mode === 'date'
      ? value.toLocaleDateString(locale, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : value.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${accessibilityLabel}, ${label}`}
      accessibilityState={{ expanded: open }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: tokens.tile },
        pressed && styles.pressed,
      ]}
    >
      {/* The open chip takes the accent, as iOS marks the row it is editing. */}
      <Text
        style={[styles.chipText, { color: open ? tokens.accent : tokens.fg }]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

/**
 * The open picker. Render it only while a chip is open; on Android it is a
 * dialog that closes itself and reports through `onClose`.
 */
export function DateTimeWheel({
  mode,
  value,
  onChange,
  onClose,
}: {
  mode: Mode
  value: Date
  onChange: (next: Date) => void
  onClose: () => void
}) {
  const tokens = useTokens('home')
  const { locale } = useI18n()

  if (Platform.OS === 'ios') {
    return (
      <DateTimePicker
        value={value}
        mode={mode}
        display={mode === 'date' ? 'inline' : 'spinner'}
        locale={PICKER_LOCALE[locale]}
        accentColor={tokens.accent}
        onValueChange={(_, next) => onChange(next)}
      />
    )
  }

  return (
    <DateTimePicker
      value={value}
      mode={mode}
      is24Hour={locale === 'nl'}
      accentColor={tokens.accent}
      onValueChange={(_, next) => {
        onClose()
        onChange(next)
      }}
      onDismiss={onClose}
    />
  )
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.control,
  },
  pressed: { opacity: 0.6 },
  chipText: { fontSize: 17, fontVariant: ['tabular-nums'] },
})
