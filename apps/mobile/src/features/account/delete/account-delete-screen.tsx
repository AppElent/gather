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
 * (`apps/mobile/DESIGN_SYSTEM.md`: permanent things ask first, and the ask names
 * the thing).
 *
 * ## The order, which is not the obvious one
 *
 * Convex first, Clerk second. The purge needs an authenticated caller, and
 * there is no authenticated caller once the Clerk user is gone. What that
 * risks is purging a household for an account Clerk then refuses to delete —
 * which is why `deleteSelfEnabled` is checked *before* anything is called, and
 * the button simply is not offered unless Clerk has said yes
 * (`settings/accountDeletion.ts`).
 *
 * The run itself is not this screen's. The purge unmounts it (`GroupProvider`
 * has no Group left to draw), so the deletion lives in
 * `AccountDeleteProvider`, above the gates, and this screen only starts it
 * and shows the purge's own refusal — the one failure after which nothing has
 * been deleted and the screen is still here to say so.
 */
import { useUser } from '@clerk/expo'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { readThrown } from '../../../auth/clerkErrors'
import { useAvailability } from '../../../availability/AvailabilityProvider'
import { AuthButton } from '../../../components/AuthButton'
import { AuthError } from '../../../components/AuthError'
import { LoadingSkeleton } from '../../../components/LoadingSkeleton'
import { api } from '../../../convex/api'
import { useQuery } from '../../../convex/queries'
import { confirmDestructive } from '../../../feedback/confirmDestructive'
import { fmt, useI18n } from '../../../i18n'
import { accountDeletion } from '../../../settings/accountDeletion'
import { RADIUS, TYPE, useTokens } from '../../../theme/tokens'
import { useAccountDelete } from './account-delete-provider'

export function AccountDeleteScreen() {
  const tokens = useTokens()
  const { t } = useI18n()
  const { user } = useUser()
  const insets = useSafeAreaInsets()
  const { serviceActionsEnabled } = useAvailability()
  const { state, start } = useAccountDelete()

  const preview = useQuery(api.accounts.deletionPreview, {})
  const busy = state.step === 'purging'
  const error = state.step === 'refused' ? readThrown(state.cause, t) : null

  // Clerk refuses self-deletion unless the instance allows it, and a button
  // that purges the household and then fails is the worst outcome available.
  const deletion = accountDeletion(user)
  const allowed = deletion === 'allowed'

  function confirm() {
    confirmDestructive({
      title: fmt(t.account.deleteAccount.confirmTitle, {
        // Clerk first: the Convex mirror of the address is refreshed from the
        // JWT on mount, so it can be a token older than a change made here.
        email: user?.primaryEmailAddress?.emailAddress ?? preview?.email ?? '',
      }),
      message: t.account.deleteAccount.confirmBody,
      confirm: t.common.actions.delete,
      cancel: t.common.actions.cancel,
      onConfirm: start,
    })
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
          error ??
          (deletion === 'withheld' ? t.account.deleteAccount.unavailable : null)
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
  lead: { ...TYPE.lead, fontWeight: '600' },
  block: { gap: 8 },
  heading: { ...TYPE.lead, fontWeight: '700' },
  body: TYPE.body,
  list: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  group: { ...TYPE.lead, paddingVertical: 12 },
})
