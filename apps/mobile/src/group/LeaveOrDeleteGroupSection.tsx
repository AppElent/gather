/**
 * The ways out of the Current Group, from the Groups screen: leaving it, and
 * for its admin, deleting it.
 *
 * Both follow the server's rules (`groups.leaveGroup`, `groups.deleteGroup`)
 * and say so before the button is pressed, rather than refusing after the
 * confirmation:
 *
 * - Anybody may leave, except the only admin while anyone else is still in it.
 *   The phone cannot hand the admin role on, so the note says where that
 *   happens.
 * - The last Member does not see Leave: they are offered Delete instead,
 *   whatever their role, because leaving would strand an empty Group.
 * - Otherwise only an admin sees Delete, held back while others remain.
 *
 * Which of these applies is the server's answer (`groups.leaveStatus`, see
 * `groupExits`), not a count of `groups.members`, so the two cannot disagree.
 *
 * What follows either is the same: the Group drops out of `myGroups`,
 * `GroupProvider` falls back to the landing Group and unwinds the Group-scoped
 * stacks, or shows the no-Group screen if it was the last one. Nothing here
 * navigates; Settings is not Group-scoped and keeps its place.
 */
import { useMutation } from 'convex/react'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { AuthError } from '../components/AuthError'
import { api, type Id } from '../convex/api'
import { useLiveQuery } from '../convex/queries'
import { confirmDestructive } from '../feedback/confirmDestructive'
import { haptics } from '../feedback/haptics'
import { fmt, useI18n } from '../i18n'
import { TYPE, useTokens } from '../theme/tokens'
import { Button } from '../ui/button'
import { useGroup } from './GroupProvider'
import { groupExits } from './leaveRule'

type Exit = 'leave' | 'delete'

export function LeaveOrDeleteGroupSection() {
  const tokens = useTokens()
  const { t } = useI18n()
  const { leave: leaveText, delete: deleteText } = t.shell.groups
  const { group } = useGroup()
  const leaveGroup = useMutation(api.groups.leaveGroup)
  const deleteGroup = useMutation(api.groups.deleteGroup)
  // Once the reader is out, the Group's own queries would only refuse until
  // `GroupProvider` moves on, so they are not asked again.
  const [gone, setGone] = useState<Id<'groups'> | null>(null)
  const status = useLiveQuery(
    api.groups.leaveStatus,
    gone !== group._id ? { slug: group.slug } : 'skip',
  )
  const [busy, setBusy] = useState<Exit | null>(null)
  const [failed, setFailed] = useState<Exit | null>(null)

  if (gone === group._id) return null

  const exits = groupExits(group.role, status)

  async function run(which: Exit) {
    if (busy) return
    const groupId = group._id
    setBusy(which)
    setFailed(null)
    try {
      if (which === 'leave') await leaveGroup({ groupId })
      else await deleteGroup({ groupId })
      haptics.itemSaved()
      setGone(groupId)
    } catch (error) {
      // Our sentence on screen, the server's in the log (see `GroupForms`).
      console.warn(`[gather] ${which} group failed`, error)
      haptics.actionFailed()
      setFailed(which)
    } finally {
      setBusy(null)
    }
  }

  return (
    <View style={styles.section}>
      <Text
        accessibilityRole="header"
        style={[styles.heading, { color: tokens.ink }]}
      >
        {group.name}
      </Text>
      <AuthError
        message={
          failed === 'leave'
            ? leaveText.failed
            : failed === 'delete'
              ? deleteText.failed
              : null
        }
      />
      {exits.leave !== 'hidden' ? (
        <Button
          label={leaveText.button}
          variant="secondary"
          busy={busy === 'leave'}
          disabled={exits.leave !== 'offer' || busy !== null}
          testID="leave-group"
          onPress={() =>
            confirmDestructive({
              title: fmt(leaveText.title, { group: group.name }),
              message: leaveText.body,
              confirm: leaveText.confirm,
              cancel: t.common.actions.cancel,
              onConfirm: () => void run('leave'),
            })
          }
        />
      ) : (
        <Text
          testID="last-member-note"
          style={[styles.note, { color: tokens.muted }]}
        >
          {leaveText.lastMember}
        </Text>
      )}
      {exits.leave === 'only-admin' ? (
        <Text style={[styles.note, { color: tokens.muted }]}>
          {leaveText.onlyAdmin}
        </Text>
      ) : null}
      {exits.delete !== 'hidden' ? (
        <>
          <Button
            label={deleteText.button}
            variant="danger"
            busy={busy === 'delete'}
            disabled={exits.delete !== 'offer' || busy !== null}
            testID="delete-group"
            onPress={() =>
              confirmDestructive({
                title: fmt(deleteText.title, { group: group.name }),
                message: deleteText.body,
                confirm: deleteText.confirm,
                cancel: t.common.actions.cancel,
                onConfirm: () => void run('delete'),
              })
            }
          />
          {exits.delete === 'others-first' ? (
            <Text style={[styles.note, { color: tokens.muted }]}>
              {deleteText.othersFirst}
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  heading: { ...TYPE.bodyStrong },
  note: { ...TYPE.footnote },
})
