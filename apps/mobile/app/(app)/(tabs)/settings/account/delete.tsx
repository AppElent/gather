/**
 * The end of the account.
 *
 * This is the only destructive action in Gather that gets a screen instead of
 * an alert, and the reason is the same one that makes an alert right
 * everywhere else: an alert is a sentence, and what this destroys cannot be
 * said in one. It names the Groups that go and the Groups that stay, *before*
 * the confirmation, because "everything in them" means nothing until you can
 * see which households it is talking about.
 *
 * The confirmation itself is still an alert, naming the account
 * (`docs/mobile-interaction.md`: permanent things ask first, and the ask names
 * the thing).
 *
 * ## The order, which is not the obvious one
 *
 * Convex first, Clerk second. The purge needs an authenticated caller, and
 * there is no authenticated caller once the Clerk user is gone. What that
 * risks is purging a household for an account Clerk then refuses to delete —
 * which is why `deleteSelfEnabled` is checked *before* anything is called, and
 * the button simply is not offered when Clerk would say no.
 */
import { useUser } from '@clerk/expo'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { api } from '../../../../../../../convex/_generated/api'
import { readThrown } from '../../../../../src/auth/clerkErrors'
import { useSignOut } from '../../../../../src/auth/useSignOut'
import { useAvailability } from '../../../../../src/availability/AvailabilityProvider'
import { AuthButton } from '../../../../../src/components/AuthButton'
import { AuthError } from '../../../../../src/components/AuthError'
import { LoadingSkeleton } from '../../../../../src/components/LoadingSkeleton'
import { fmt, useI18n } from '../../../../../src/i18n'
import { RADIUS, useTokens } from '../../../../../src/theme/tokens'

export default function DeleteAccount() {
  const tokens = useTokens()
  const { t } = useI18n()
  const { user } = useUser()
  const insets = useSafeAreaInsets()
  const signOut = useSignOut()
  const { serviceActionsEnabled } = useAvailability()

  const preview = useQuery(api.accounts.deletionPreview, {})
  const deleteAccount = useMutation(api.accounts.deleteAccount)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Clerk refuses self-deletion unless the instance allows it, and a button
  // that purges the household and then fails is the worst outcome available.
  const allowed = user?.deleteSelfEnabled !== false

  /**
   * The two steps are caught separately because they fail differently. If the
   * purge refuses, nothing has happened and saying so is true. If Clerk then
   * refuses, the household is already gone and the login is not — signing in
   * again would build a fresh empty account — so the second message says that
   * rather than repeating the first.
   */
  async function destroy() {
    if (!user || busy) return
    setBusy(true)
    setError(null)

    try {
      await deleteAccount({})
    } catch (cause) {
      setError(readThrown(cause, t))
      setBusy(false)
      return
    }

    try {
      await user.delete()
    } catch {
      setError(t.account.deleteAccount.partlyFailed)
      setBusy(false)
      return
    }

    signOut()
  }

  function confirm() {
    Alert.alert(
      fmt(t.account.deleteAccount.confirmTitle, {
        // Clerk first: the Convex mirror of the address is refreshed from the
        // JWT on mount, so it can be a token older than a change made here.
        email: user?.primaryEmailAddress?.emailAddress ?? preview?.email ?? '',
      }),
      t.account.deleteAccount.confirmBody,
      [
        { text: t.actions.cancel, style: 'cancel' },
        {
          text: t.account.deleteAccount.confirm,
          style: 'destructive',
          onPress: () => void destroy(),
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
      <Text style={[styles.lead, { color: tokens.fg }]}>
        {t.account.deleteAccount.lead}
      </Text>

      {preview === undefined ? (
        <LoadingSkeleton rows={3} label={t.actions.loading} />
      ) : preview === null ? null : preview.deleted.length === 0 &&
        preview.kept.length === 0 ? (
        <Text style={[styles.body, { color: tokens.muted }]}>
          {t.account.deleteAccount.noGroups}
        </Text>
      ) : (
        <>
          <Consequence
            heading={t.account.deleteAccount.goesHeading}
            body={t.account.deleteAccount.goesBody}
            groups={preview.deleted}
            tone="danger"
          />
          <Consequence
            heading={t.account.deleteAccount.keptHeading}
            body={t.account.deleteAccount.keptBody}
            groups={preview.kept}
          />
        </>
      )}

      <AuthError
        message={
          error ?? (allowed ? null : t.account.deleteAccount.unavailable)
        }
      />

      <AuthButton
        testID="account-delete-submit"
        variant="danger"
        label={t.account.deleteAccount.submit}
        busy={busy}
        disabled={!allowed || !serviceActionsEnabled || preview === undefined}
        onPress={confirm}
      />
    </ScrollView>
  )
}

/** One half of the answer: these Groups, and what happens to them. */
function Consequence({
  heading,
  body,
  groups,
  tone,
}: {
  heading: string
  body: string
  groups: string[]
  tone?: 'danger'
}) {
  const tokens = useTokens()
  if (groups.length === 0) return null

  return (
    <View style={styles.block}>
      <Text
        accessibilityRole="header"
        style={[
          styles.heading,
          { color: tone === 'danger' ? tokens.danger : tokens.fg },
        ]}
      >
        {heading}
      </Text>
      <Text style={[styles.body, { color: tokens.muted }]}>{body}</Text>
      <View
        style={[
          styles.list,
          { backgroundColor: tokens.surface, borderColor: tokens.border },
        ]}
      >
        {groups.map((name, index) => (
          <Text
            key={name}
            style={[
              styles.group,
              { color: tokens.fg },
              index > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: tokens.border,
              },
            ]}
          >
            {name}
          </Text>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 20 },
  lead: { fontSize: 17, fontWeight: '600' },
  block: { gap: 8 },
  heading: { fontSize: 16, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 20 },
  list: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  group: { fontSize: 16, paddingVertical: 12 },
})
