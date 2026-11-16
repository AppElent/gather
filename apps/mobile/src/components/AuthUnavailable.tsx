import { StyleSheet, Text, View } from 'react-native'
import { useI18n } from '../i18n'
import { TYPE, useTokens } from '../theme/tokens'
import { Button } from '../ui/button'
import { useHideSplash } from '../useHideSplash'

export function AuthUnavailable({
  onRetry,
  retrying,
}: {
  onRetry: () => void
  retrying: boolean
}) {
  const tokens = useTokens()
  const { t } = useI18n()
  const onLayout = useHideSplash()

  return (
    <View
      onLayout={onLayout}
      style={[styles.wrap, { backgroundColor: tokens.ground }]}
    >
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: tokens.ink }]}
      >
        {t.gate.title}
      </Text>
      <Text
        accessibilityLiveRegion="polite"
        style={[styles.text, { color: tokens.muted }]}
      >
        {t.gate.offline}
      </Text>
      <Button
        label={t.gate.retry}
        busy={retrying}
        disabled={retrying}
        onPress={onRetry}
        style={styles.retry}
      />
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
  title: { ...TYPE.title2, letterSpacing: -0.4 },
  text: { ...TYPE.subhead, textAlign: 'center' },
  retry: { minWidth: 150 },
})
