/**
 * What went wrong, said once, above the actions.
 *
 * `accessibilityLiveRegion="polite"` is what makes TalkBack read the message
 * when it appears — without it a screen-reader user taps Sign in, nothing is
 * announced, and the form looks like it simply did not respond.
 */
import { StyleSheet, Text, View } from 'react-native'

import { UI_ICONS } from '../theme/icons'
import { RADIUS, TYPE, useTokens } from '../theme/tokens'

export function AuthError({ message }: { message: string | null }) {
  const tokens = useTokens()
  if (!message) return null

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[
        styles.box,
        { borderColor: tokens.danger, backgroundColor: tokens.surface },
      ]}
    >
      <UI_ICONS.CircleAlert size={17} color={tokens.danger} strokeWidth={1.9} />
      <Text style={[styles.text, { color: tokens.ink }]}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    borderWidth: 1,
    borderRadius: RADIUS.card,
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  text: { ...TYPE.subhead, flex: 1 },
})
