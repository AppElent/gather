/**
 * What is behind the splash when the splash gives up.
 *
 * Deliberately not a route: reaching it does not mean navigating anywhere, and
 * it must be able to disappear the instant Clerk resolves. There is no retry
 * button because there is nothing to retry — `@clerk/expo` keeps trying on its
 * own, and the moment `isLoaded` flips the root navigator replaces this with
 * the real first screen.
 */
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { useHideSplash } from '../useHideSplash'
import { useTokens } from '../theme/tokens'
import { useI18n } from '../i18n'

export function AuthUnavailable() {
  const tokens = useTokens()
  const { t } = useI18n()
  const onLayout = useHideSplash()

  return (
    <View
      onLayout={onLayout}
      style={[styles.wrap, { backgroundColor: tokens.bg }]}
    >
      <ActivityIndicator color={tokens.muted} />
      <Text
        accessibilityLiveRegion="polite"
        style={[styles.text, { color: tokens.muted }]}
      >
        {t.gate.offline}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 44,
  },
  text: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
})
