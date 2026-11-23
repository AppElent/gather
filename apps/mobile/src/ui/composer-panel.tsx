/**
 * What a keyboard composer draws in the keyboard's place (APP-587, APP-661):
 * a wheel or a calendar under the chips, with Done to bring the keyboard back.
 * The kinds hand it to the shell as `panel`.
 */
import type { ReactNode } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import { DateTimeWheel } from '../components/DateTimeField'
import { useI18n } from '../i18n'
import { TYPE, useTokens } from '../theme/tokens'

/** A wheel in the keyboard's place, with Done to bring the keyboard back. */
export function ComposerPanel({
  children,
  onDone,
  testID,
}: {
  children: ReactNode
  onDone: () => void
  testID?: string
}) {
  const { t } = useI18n()
  const tokens = useTokens('home')
  // Android's picker is a dialog that reports its own close.
  if (Platform.OS !== 'ios') return <>{children}</>
  return (
    <View style={styles.panel}>
      {children}
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={t.actions.done}
        onPress={onDone}
        hitSlop={12}
        style={({ pressed }) => [styles.done, pressed && styles.pressed]}
      >
        <Text style={[styles.doneText, { color: tokens.accentText }]}>{t.actions.done}</Text>
      </Pressable>
    </View>
  )
}

/**
 * Kies datum…: the month calendar. Picking a day is the whole choice, so it
 * sets the date and closes, as a menu item would; Done closes it unchanged.
 * Paging months does not pick a day, so it keeps the calendar open.
 */
export function ComposerDatePanel({
  value,
  onPick,
  onClose,
  testID,
}: {
  value: Date
  onPick: (day: Date) => void
  onClose: () => void
  testID?: string
}) {
  return (
    <ComposerPanel onDone={onClose} testID={testID}>
      <DateTimeWheel
        mode="date"
        value={value}
        onChange={(day) => {
          onPick(day)
          // Android's dialog has closed itself already, and said so.
          if (Platform.OS === 'ios') onClose()
        }}
        onClose={onClose}
      />
    </ComposerPanel>
  )
}

const styles = StyleSheet.create({
  panel: { alignSelf: 'stretch' },
  done: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' },
  doneText: { ...TYPE.bodyStrong },
  pressed: { opacity: 0.6 },
})
