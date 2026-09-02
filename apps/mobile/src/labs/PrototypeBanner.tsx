/**
 * The strip every Labs screen carries.
 *
 * A prototype that looks exactly like the app is a prototype somebody will
 * report a bug against, or worse, believe. One line, at the top, saying that
 * what follows is made up and goes nowhere — it costs 30 points and it is the
 * only thing standing between a design exercise and a support ticket.
 */
import { StyleSheet, Text, View } from 'react-native'

import { useI18n } from '../i18n'
import { RADIUS, useTokens } from '../theme/tokens'

export function PrototypeBanner() {
  const tokens = useTokens('home')
  const tint = tokens.tintOf('home')
  const { t } = useI18n()

  return (
    <View
      testID="prototype-banner"
      accessibilityRole="alert"
      style={[styles.banner, { backgroundColor: tint.bg }]}
    >
      <Text style={[styles.text, { color: tint.fg }]}>{t.labs.banner}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.control,
  },
  text: { fontSize: 12, fontWeight: '600' },
})
