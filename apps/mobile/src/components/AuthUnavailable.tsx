import { StyleSheet, Text, View } from 'react-native'
import { useI18n } from '../i18n'
import { useTokens } from '../theme/tokens'
import { useHideSplash } from '../useHideSplash'
import { AuthButton } from './AuthButton'

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
      style={[styles.wrap, { backgroundColor: tokens.bg }]}
    >
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: tokens.fg }]}
      >
        {t.gate.title}
      </Text>
      <Text
        accessibilityLiveRegion="polite"
        style={[styles.text, { color: tokens.muted }]}
      >
        {t.gate.offline}
      </Text>
      <AuthButton
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
  title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.4 },
  text: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  retry: { minWidth: 150 },
})
