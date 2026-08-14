/**
 * Behind the door, before the Groups have arrived.
 *
 * Deliberately not a route, for `AuthUnavailable`'s reason: reaching it is not
 * navigating anywhere, and it has to be able to vanish the moment the query
 * answers. It hides the splash too, because on a cold start with a retained
 * session this is the first screen mounted.
 *
 * There is nothing to retry. The Convex query is a live subscription — it
 * resolves itself when the connection does — and what a lasting failure should
 * look like is #165's, not a button invented here.
 */
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { useI18n } from '../i18n'
import { useTokens } from '../theme/tokens'
import { useHideSplash } from '../useHideSplash'

export function GroupPending() {
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
        {t.group.loading}
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
