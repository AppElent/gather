/**
 * The zone of the Current Group's "today" (APP-475), on the Groups screen.
 * An admin sets it to this phone's zone or goes back to each device's own;
 * picking any other zone is on the web. Everyone else reads it.
 */
import { useMutation } from 'convex/react'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { AuthError } from '../components/AuthError'
import { api } from '../convex/api'
import { useQuery } from '../convex/queries'
import { haptics } from '../feedback/haptics'
import { fmt, useI18n } from '../i18n'
import { deviceTimeZone } from '../modules/tasks/reminder'
import { RADIUS, TYPE, useTokens } from '../theme/tokens'
import { Button } from '../ui/button'
import { useGroup } from './GroupProvider'

export function GroupTimeZoneCard() {
  const { group } = useGroup()
  // Keyed so a failure in one Group is not shown under the next.
  return <TimeZoneCard key={group._id} />
}

function TimeZoneCard() {
  const tokens = useTokens()
  const { t } = useI18n()
  const text = t.shell.groups.timeZone
  const { group } = useGroup()
  const setTimeZone = useMutation(api.groups.setTimeZone)
  // `GroupProvider` holds the same subscription, so this reads its result.
  const myGroups = useQuery(api.groups.myGroups, {})
  const role = myGroups?.find((each) => each._id === group._id)?.role
  const [busy, setBusy] = useState<'device' | 'clear' | null>(null)
  const [failed, setFailed] = useState(false)
  const device = deviceTimeZone()

  async function save(which: 'device' | 'clear') {
    if (busy) return
    setBusy(which)
    setFailed(false)
    try {
      await setTimeZone({
        groupId: group._id,
        timeZone: which === 'device' ? device : null,
      })
      haptics.itemSaved()
    } catch (error) {
      // Our sentence on screen, the server's in the log (see `GroupForms`).
      console.warn('[gather] set group time zone failed', error)
      haptics.actionFailed()
      setFailed(true)
    } finally {
      setBusy(null)
    }
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
      <Text
        testID="group-time-zone"
        style={[styles.value, { color: tokens.ink }]}
      >
        {group.timeZone ?? fmt(text.unset, { zone: device })}
      </Text>
      <Text style={[styles.note, { color: tokens.muted }]}>{text.note}</Text>
      <AuthError message={failed ? text.failed : null} />
      {role === 'member' ? (
        <Text style={[styles.note, { color: tokens.muted }]}>
          {text.adminOnly}
        </Text>
      ) : null}
      {role === 'admin' && group.timeZone !== device ? (
        <Button
          variant="secondary"
          label={text.useDevice}
          busy={busy === 'device'}
          disabled={busy !== null}
          onPress={() => void save('device')}
          testID="use-device-time-zone"
        />
      ) : null}
      {role === 'admin' && group.timeZone !== undefined ? (
        <Button
          variant="secondary"
          label={text.clear}
          busy={busy === 'clear'}
          disabled={busy !== null}
          onPress={() => void save('clear')}
          testID="clear-group-time-zone"
        />
      ) : null}
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
  value: { ...TYPE.body },
  note: { ...TYPE.subhead },
})
