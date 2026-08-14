/**
 * The two ways to end up in a Group you are not in yet: start one, or use
 * somebody's invite code.
 *
 * A component rather than part of the Groups screen because it is needed in two
 * places that cannot share a route — the Groups screen, and the no-Group state
 * that `GroupProvider` draws *instead of* the shell. The second is the reason
 * this exists at all: until #164 that screen told people to open the web,
 * which is a dead end on the one screen where somebody has nothing else to do.
 *
 * ## Why a failure never shows what was thrown
 *
 * `convex/groups.ts` throws English sentences ("Invalid invite code"). The web
 * shows them, because the web has `errorMessage` and a reader who is already
 * looking at an English shell if they are English. Here the shell may well be
 * in Dutch, and a Dutch reader getting one English sentence out of the backend
 * is worse than a translated one that says less. So the message is ours, from
 * the shared tree, and the thrown detail is warned rather than dropped — the
 * one place it can still be read is a Metro log or a bug report.
 *
 * The trade is real: "Invalid invite code" and "you are offline" become the
 * same sentence on screen. It is the right trade while the backend's refusals
 * are not translated — and ADR-0009 already says a refusal inside a Group does
 * not get to say which refusal it is.
 */
import { useMutation } from 'convex/react'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { api } from '../../../../convex/_generated/api'
import { useI18n } from '../i18n'
import { RADIUS, useTokens } from '../theme/tokens'
import { AuthButton } from './AuthButton'
import { AuthField } from './AuthField'

type Form = 'create' | 'join'

export function GroupForms() {
  const tokens = useTokens()
  const { t } = useI18n()
  const text = t.shell.groups
  const createGroup = useMutation(api.groups.createGroup)
  const joinByInvite = useMutation(api.groups.joinByInvite)

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<Form | null>(null)
  // Which form failed, not just what it said: both cards are on screen at once
  // on the no-Group screen, and a message floating above the pair reads as
  // belonging to whichever one you were not using.
  const [failed, setFailed] = useState<Form | null>(null)

  function run(which: Form, call: () => Promise<unknown>) {
    // `busy` only takes effect on the next render, so a keyboard "done"
    // followed immediately by a tap would otherwise fire twice — and
    // `createGroup` is not idempotent: two taps, two identically-named Groups
    // with different slugs. Every entry point comes through here.
    if (busy) return
    setBusy(which)
    setFailed(null)
    void call()
      .then(() => {
        // Cleared on success only. A code that was refused stays in the field
        // so it can be corrected rather than retyped.
        if (which === 'create') setName('')
        else setCode('')
      })
      .catch((error) => {
        // The reader gets our sentence; the thrown one is worth exactly as much
        // as a log line, and nothing at all if it is dropped here.
        console.warn(`[gather] ${which} group failed`, error)
        setFailed(which)
      })
      .finally(() => setBusy(null))
  }

  // One submit per form, shared by the button and the keyboard's "done", so the
  // two cannot drift about what counts as submittable.
  function submitCreate() {
    const trimmed = name.trim()
    if (trimmed) run('create', () => createGroup({ name: trimmed }))
  }

  function submitJoin() {
    const trimmed = code.trim()
    if (trimmed) run('join', () => joinByInvite({ inviteCode: trimmed }))
  }

  return (
    <View style={styles.forms}>
      <View
        style={[
          styles.card,
          { backgroundColor: tokens.surface, borderColor: tokens.border },
        ]}
      >
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: tokens.fg }]}
        >
          {text.createTitle}
        </Text>
        <Text style={[styles.body, { color: tokens.muted }]}>
          {text.createBody}
        </Text>
        <AuthField
          label={text.createLabel}
          value={name}
          onChangeText={setName}
          placeholder={text.createPlaceholder}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={submitCreate}
        />
        <AuthButton
          label={text.create}
          busy={busy === 'create'}
          disabled={!name.trim() || busy !== null}
          onPress={submitCreate}
        />
        {failed === 'create' ? (
          <Text
            accessibilityRole="alert"
            style={[styles.error, { color: tokens.danger }]}
          >
            {text.createFailed}
          </Text>
        ) : null}
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: tokens.surface, borderColor: tokens.border },
        ]}
      >
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: tokens.fg }]}
        >
          {text.joinTitle}
        </Text>
        <Text style={[styles.body, { color: tokens.muted }]}>
          {text.joinBody}
        </Text>
        <AuthField
          label={text.joinLabel}
          value={code}
          onChangeText={setCode}
          placeholder={text.joinPlaceholder}
          // An invite code is eight characters of generated hex. Every
          // convenience the keyboard offers on a word is wrong for it.
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={submitJoin}
        />
        <AuthButton
          variant="secondary"
          label={text.join}
          busy={busy === 'join'}
          disabled={!code.trim() || busy !== null}
          onPress={submitJoin}
        />
        {failed === 'join' ? (
          <Text
            accessibilityRole="alert"
            style={[styles.error, { color: tokens.danger }]}
          >
            {text.joinFailed}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  forms: { gap: 12 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    padding: 16,
    gap: 12,
  },
  title: { fontSize: 16, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 20 },
  error: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
})
