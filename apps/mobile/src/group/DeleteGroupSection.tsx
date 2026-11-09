/**
 * Deleting the Current Group, for its admin, from the Groups screen.
 *
 * The server's rule is the one drawn here: only an admin, and only once they
 * are its last Member (`groups.deleteGroup`). A Member who is not an admin sees
 * nothing; an admin with others still in the Group sees the control disabled
 * and the reason under it, rather than a refusal after the confirmation.
 *
 * What follows a delete is what follows leaving: the Group drops out of
 * `myGroups`, `GroupProvider` falls back to the landing Group and unwinds the
 * Group-scoped stacks, or shows the no-Group screen if it was the last one.
 * Nothing here navigates; Settings is not Group-scoped and keeps its place.
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
import { useTokens } from '../theme/tokens'
import { Button } from '../ui/button'
import { useGroup } from './GroupProvider'

export function DeleteGroupSection() {
  const tokens = useTokens()
  const { t } = useI18n()
  const text = t.shell.groups.delete
  const { group } = useGroup()
  const deleteGroup = useMutation(api.groups.deleteGroup)
  // `GroupProvider` holds the same subscription, so this reads its result.
  const myGroups = useQuery(api.groups.myGroups, {})
  const isAdmin =
    myGroups?.find((each) => each._id === group._id)?.role === 'admin'
  // Once a delete has gone through, the Group's own queries would only refuse
  // until `GroupProvider` moves on, so they are not asked again.
  const [deleted, setDeleted] = useState<Id<'groups'> | null>(null)
  const members = useQuery(
    api.groups.members,
    isAdmin && deleted !== group._id ? { slug: group.slug } : 'skip',
  )
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  if (!isAdmin || deleted === group._id) return null

  const othersRemain = members !== undefined && members.length > 1

  async function destroy() {
    const groupId = group._id
    setBusy(true)
    setFailed(false)
    try {
      await deleteGroup({ groupId })
      haptics.itemSaved()
      setDeleted(groupId)
    } catch {
      haptics.actionFailed()
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.section}>
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        style={[styles.heading, { color: tokens.fg }]}
      >
        {group.name}
      </Text>
      <AuthError message={failed ? text.failed : null} />
      <Button
        label={text.button}
        variant="danger"
        busy={busy}
        disabled={members === undefined || othersRemain}
        onPress={() =>
          confirmDestructive({
            title: fmt(text.title, { group: group.name }),
            message: text.body,
            confirm: text.confirm,
            cancel: t.common.actions.cancel,
            onConfirm: () => void destroy(),
          })
        }
      />
      {othersRemain ? (
        <Text style={[styles.note, { color: tokens.muted }]}>
          {text.othersFirst}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  heading: { fontSize: 16, fontWeight: '700' },
  note: { fontSize: 13, lineHeight: 19 },
})
