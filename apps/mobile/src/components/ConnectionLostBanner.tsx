import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAvailability } from '../availability/AvailabilityProvider'
import { useI18n } from '../i18n'
import { TYPE, useTokens } from '../theme/tokens'

export function ConnectionLostBanner() {
  const tokens = useTokens()
  const { t } = useI18n()
  const { retry, retrying } = useAvailability()
  const insets = useSafeAreaInsets()

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.banner,
        {
          backgroundColor: tokens.surface,
          borderBottomColor: tokens.hair,
          paddingTop: insets.top + 8,
        },
      ]}
    >
      <Text style={[styles.message, { color: tokens.ink }]}>
        {t.gate.connectionLost}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ busy: retrying, disabled: retrying }}
        disabled={retrying}
        onPress={retry}
        style={({ pressed }) => [pressed && !retrying && styles.pressed]}
      >
        <Text style={[styles.retry, { color: tokens.accentText }]}>
          {t.gate.retry}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  message: { ...TYPE.footnote, flex: 1 },
  retry: { ...TYPE.footnoteStrong },
  pressed: { opacity: 0.65 },
})
