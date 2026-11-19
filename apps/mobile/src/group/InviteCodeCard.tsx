/**
 * The Current Group's invite code, with the native share sheet, on the Groups
 * screen. Any Member may invite (ADR-0006), so every Member sees it.
 *
 * A code, not a link: the person it reaches opens Groups and joins with it, in
 * the app or on the web. Invite links wait for the app-links work (APP-84), so
 * nothing here builds a URL.
 *
 * The code is its own query (`groups.inviteCode`), asked for the one Group on
 * screen, because holding it lets somebody in. When it cannot load, the card
 * says so and offers Retry in place of Share (`useInviteCode`).
 */
import { Share, StyleSheet, Text, View } from 'react-native'
import { AuthError } from '../components/AuthError'
import { fmt, useI18n } from '../i18n'
import { RADIUS, TYPE, useTokens } from '../theme/tokens'
import { Button } from '../ui/button'
import { useGroup } from './GroupProvider'
import { useInviteCode } from './useInviteCode'

export function InviteCodeCard() {
  const tokens = useTokens()
  const { t } = useI18n()
  const text = t.shell.groups.invite
  const { group } = useGroup()
  const invite = useInviteCode(group.slug)
  const code = invite.state === 'ready' ? invite.code : undefined

  function share() {
    if (code === undefined) return
    // The sheet's own Cancel is not a failure, and there is nothing to retry
    // when the sheet cannot open, so neither is reported.
    void Share.share({
      message: fmt(text.shareMessage, {
        group: group.name,
        join: t.shell.groups.joinTitle,
        code,
      }),
    }).catch((error) => console.warn('[gather] share invite failed', error))
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: tokens.surface, borderColor: tokens.hair },
      ]}
    >
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: tokens.ink }]}
      >
        {text.title}
      </Text>
      {invite.state === 'failed' ? (
        <AuthError message={text.failed} />
      ) : (
        <Text
          selectable
          testID="invite-code"
          style={[
            styles.code,
            { color: code === undefined ? tokens.muted : tokens.ink },
          ]}
        >
          {code ?? t.common.errors.loading}
        </Text>
      )}
      <Text style={[styles.note, { color: tokens.muted }]}>{text.note}</Text>
      {invite.state === 'failed' ? (
        <Button
          variant="secondary"
          label={t.common.actions.retry}
          onPress={invite.retry}
          testID="retry-invite-code"
        />
      ) : (
        <Button
          variant="secondary"
          label={text.share}
          disabled={code === undefined}
          onPress={share}
          testID="share-invite-code"
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    padding: 16,
    gap: 12,
  },
  title: { ...TYPE.bodyStrong },
  code: { ...TYPE.title2 },
  note: { ...TYPE.subhead },
})
