/**
 * What Search looks like when the query itself failed, as opposed to finding
 * nothing. The distinction matters: "nothing found" invites another word,
 * this one invites another attempt.
 */
import type { ErrorBoundaryProps } from 'expo-router'
import { Stack } from 'expo-router'
import { useEffect } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useI18n } from '../i18n'
import { reportError } from '../observability/report'
import { RADIUS, TYPE, useTokens } from '../theme/tokens'

export function SearchError({ error, retry }: ErrorBoundaryProps) {
  const tokens = useTokens()
  const { t } = useI18n()

  useEffect(() => {
    reportError(error)
  }, [error])

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t.search.title }} />
      <View style={[styles.screen, { backgroundColor: tokens.ground }]}>
        <Text style={[styles.message, { color: tokens.ink }]}>
          {t.search.failed}
        </Text>
        {__DEV__ ? (
          <Text style={[styles.detail, { color: tokens.muted }]}>
            {error.message}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.common.actions.retry}
          onPress={() => {
            void retry()
          }}
          style={({ pressed }) => [
            styles.retry,
            { borderColor: tokens.hair },
            pressed && { backgroundColor: tokens.surface2 },
          ]}
        >
          <Text style={[styles.retryText, { color: tokens.ink }]}>
            {t.common.actions.retry}
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
  message: { ...TYPE.bodyStrong, textAlign: 'center' },
  detail: { ...TYPE.footnote, textAlign: 'center' },
  retry: {
    minHeight: 48,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 20,
  },
  retryText: { ...TYPE.bodyStrong },
})
