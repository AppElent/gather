/**
 * What Search looks like when the query itself failed, as opposed to finding
 * nothing. The distinction matters: "nothing found" invites another word,
 * this one invites another attempt.
 */
import type { ErrorBoundaryProps } from 'expo-router'
import { Stack } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useI18n } from '../i18n'
import { RADIUS, useTokens } from '../theme/tokens'

export function SearchError({ error, retry }: ErrorBoundaryProps) {
  const tokens = useTokens()
  const { t } = useI18n()

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t.search.title }} />
      <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
        <Text style={[styles.message, { color: tokens.fg }]}>
          {t.search.failed}
        </Text>
        {__DEV__ ? (
          <Text style={[styles.detail, { color: tokens.muted }]}>
            {error.message}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.actions.retry}
          onPress={() => {
            void retry()
          }}
          style={({ pressed }) => [
            styles.retry,
            { borderColor: tokens.border },
            pressed && { backgroundColor: tokens.tile },
          ]}
        >
          <Text style={[styles.retryText, { color: tokens.fg }]}>
            {t.actions.retry}
          </Text>
        </Pressable>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  message: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  detail: { fontSize: 13, textAlign: 'center' },
  retry: {
    minHeight: 48,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
    paddingHorizontal: 20,
  },
  retryText: { fontWeight: '600' },
})
