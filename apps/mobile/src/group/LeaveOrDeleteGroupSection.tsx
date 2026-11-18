/**
 * The ways out of the Current Group, from the Groups screen: leaving it, and
 * for its admin, deleting it.
 *
 * Both follow the server's rules (`groups.leaveGroup`, `groups.deleteGroup`)
 * and say so before the button is pressed, rather than refusing after the
 * confirmation:
 *
 * - Anybody may leave, except the only admin while anyone else is still in it
 *   (`leaveRule`). The phone cannot hand the admin role on, so the note says
 *   where that happens.
 * - Only an admin may delete, and only once they are its last Member. A Member
 *   who is not an admin does not see Delete.
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
import { useQuery } from '../convex/queries'
import { confirmDestructive } from '../feedback/confirmDestructive'
import { haptics } from '../feedback/haptics'
import { fmt, useI18n } from '../i18n'
import { TYPE, useTokens } from '../theme/tokens'
import { Button } from '../ui/button'
import { useGroup } from './GroupProvider'
import { leaveRule } from './leaveRule'

type Exit = 'leave' | 'delete'

export function LeaveOrDeleteGroupSection() {
  const tokens = useTokens()
  const { t } = useI18n()
  const { leave: leaveText, delete: deleteText } = t.shell.groups
  const { group } = useGroup()
  const leaveGroup = useMutation(api.groups.leaveGroup)
  const deleteGroup = useMutation(api.groups.deleteGroup)
  // `GroupProvider` holds the same subscription, so this reads its result.
  const myGroups = useQuery(api.groups.myGroups, {})
  const role = myGroups?.find((each) => each._id === group._id)?.role
  const isAdmin = role === 'admin'
  // Once the reader is out, the Group's own queries would only refuse until
  // `GroupProvider` moves on, so they are not asked again.
  const [gone, setGone] = useState<Id<'groups'> | null>(null)
  const members = useQuery(
    api.groups.members,
    isAdmin && gone !== group._id ? { slug: group.slug } : 'skip',
  )
  const [busy, setBusy] = useState<Exit | null>(null)
  const [failed, setFailed] = useState<Exit | null>(null)

  if (gone === group._id) return null

  const rule = leaveRule(role, members)
  const othersRemain = members !== undefined && members.length > 1

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
      <Button
        label={leaveText.button}
        variant="secondary"
        busy={busy === 'leave'}
        disabled={rule !== 'allowed' || busy !== null}
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
      {rule === 'only-admin' ? (
        <Text style={[styles.note, { color: tokens.muted }]}>
          {leaveText.onlyAdmin}
        </Text>
      ) : null}
      {isAdmin ? (
        <>
          <Button
            label={deleteText.button}
            variant="danger"
            busy={busy === 'delete'}
            disabled={members === undefined || othersRemain || busy !== null}
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
          {othersRemain ? (
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
