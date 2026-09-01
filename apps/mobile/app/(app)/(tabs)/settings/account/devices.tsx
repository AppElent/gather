/**
 * Where you are signed in, and how to stop being signed in there.
 *
 * The session you are holding is in the list and is not revocable from itself:
 * that is what Sign out already is, and a Sign out button next to This device
 * that did the same thing by a different route would be two answers to one
 * question.
 *
 * Revoking is permanent and asks first, naming the device
 * (`docs/mobile-interaction.md`). The list is Clerk's and is fetched rather
 * than subscribed to, so it reloads after a revoke instead of hoping.
 */
import { useSession, useUser } from '@clerk/expo'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { readThrown } from '../../../../../src/auth/clerkErrors'
import { AuthError } from '../../../../../src/components/AuthError'
import { SettingsCard } from '../../../../../src/components/SettingsCard'
import { fmt, useI18n } from '../../../../../src/i18n'
import { useTokens } from '../../../../../src/theme/tokens'

interface Row {
  id: string
  device: string
  where: string | null
  lastActive: Date
  current: boolean
  revoke: () => Promise<unknown>
}

export default function Devices() {
  const tokens = useTokens()
  const { t, locale } = useI18n()
  const { user } = useUser()
  const { session } = useSession()
  const insets = useSafeAreaInsets()

  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    try {
      const sessions = await user.getSessions()
      setRows(
        sessions.map((s) => ({
          id: s.id,
          device:
            [s.latestActivity?.browserName, s.latestActivity?.deviceType]
              .filter(Boolean)
              .join(' · ') || t.account.sessions.unknownDevice,
          where:
            [s.latestActivity?.city, s.latestActivity?.country]
              .filter(Boolean)
              .join(', ') || null,
          lastActive: s.lastActiveAt,
          current: s.id === session?.id,
          revoke: () => s.revoke(),
        })),
      )
    } catch (cause) {
      setError(readThrown(cause, t))
    }
  }, [user, session?.id, t])

  useEffect(() => {
    void load()
  }, [load])

  function confirmRevoke(row: Row) {
    Alert.alert(
      fmt(t.account.sessions.revokeTitle, { device: row.device }),
      t.account.sessions.revokeBody,
      [
        { text: t.actions.cancel, style: 'cancel' },
        {
          text: t.account.sessions.signOutOf,
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await row.revoke()
                await load()
              } catch (cause) {
                setError(readThrown(cause, t))
              }
            })()
          },
        },
      ],
    )
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: tokens.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 24 },
      ]}
    >
      <AuthError message={error} />

      <SettingsCard description={t.account.sessions.description}>
        {rows === null ? (
          <ActivityIndicator
            accessibilityLabel={t.actions.loading}
            style={styles.loading}
          />
        ) : (
          rows.map((row, index) => (
            <View
              key={row.id}
              style={[
                styles.row,
                index > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: tokens.border,
                },
              ]}
            >
              <View style={styles.rowText}>
                <Text style={[styles.device, { color: tokens.fg }]}>
                  {row.current ? t.account.sessions.thisDevice : row.device}
                </Text>
                <Text style={[styles.detail, { color: tokens.muted }]}>
                  {[
                    row.where,
                    fmt(t.account.sessions.lastActive, {
                      when: row.lastActive.toLocaleDateString(locale, {
                        day: 'numeric',
                        month: 'short',
                      }),
                    }),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              {row.current ? null : (
                <Pressable
                  testID={`account-revoke-${row.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={fmt(t.account.sessions.revokeTitle, {
                    device: row.device,
                  })}
                  hitSlop={12}
                  onPress={() => confirmRevoke(row)}
                  style={({ pressed }) => [pressed && styles.pressed]}
                >
                  <Text style={[styles.revoke, { color: tokens.danger }]}>
                    {t.account.sessions.signOutOf}
                  </Text>
                </Pressable>
              )}
            </View>
          ))
        )}
      </SettingsCard>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },
  loading: { paddingVertical: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingVertical: 8,
  },
  rowText: { flex: 1, gap: 2 },
  device: { fontSize: 16, fontWeight: '600' },
  detail: { fontSize: 13 },
  revoke: { fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.6 },
})
