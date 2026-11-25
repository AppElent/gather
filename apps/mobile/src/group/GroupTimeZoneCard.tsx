/**
 * The zone of the Current Group's "today" (APP-475), on the Groups screen.
 * An admin picks any zone, or goes back to each device's own. Everyone else
 * reads it.
 */
import {
  groupRefusalSentence,
  groupTimeZoneRefusalSentence,
} from '@gather/core/refusals'
import { currentZoneName, deviceTimeZone, sameTimeZone, timeZoneLabel, timeZonePlace } from '@gather/core/time-zones'
import { useMutation } from 'convex/react'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { AuthError } from '../components/AuthError'
import { api } from '../convex/api'
import { haptics } from '../feedback/haptics'
import { fmt, useI18n } from '../i18n'
import { RADIUS, TYPE, useTokens } from '../theme/tokens'
import { Button } from '../ui/button'
import { useGroup } from './GroupProvider'
import { TimeZoneSheet } from './TimeZoneSheet'

export function GroupTimeZoneCard() {
  const { group } = useGroup()
  // Keyed so a failure in one Group is not shown under the next.
  return <TimeZoneCard key={group._id} />
}

function TimeZoneCard() {
  const tokens = useTokens()
  const { t, locale } = useI18n()
  const text = t.shell.groups.timeZone
  const { group } = useGroup()
  const setTimeZone = useMutation(api.groups.setTimeZone)
  const isAdmin = group.role === 'admin'
  const [busy, setBusy] = useState<'choose' | 'device' | 'clear' | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [choosing, setChoosing] = useState(false)
  const device = deviceTimeZone()
  const label = (zone: string) =>
    timeZoneLabel(currentZoneName(zone), locale, text.places)

  async function save(
    which: 'choose' | 'device' | 'clear',
    timeZone: string | null,
  ) {
    if (busy) return
    setBusy(which)
    setProblem(null)
    try {
      await setTimeZone({ groupId: group._id, timeZone })
      haptics.itemSaved()
    } catch (error) {
      // Our sentence on screen, the server's in the log (see `GroupForms`).
      console.warn('[gather] set group time zone failed', error)
      haptics.actionFailed()
      const refused = groupTimeZoneRefusalSentence(error, text.refusals)
      setProblem(
        (refused &&
          fmt(refused, { zone: timeZonePlace(timeZone ?? device, text.places) })) ??
          groupRefusalSentence(error, t.common.errors.groupRefusals) ??
          text.failed,
      )
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
        {group.timeZone
          ? label(group.timeZone)
          : fmt(text.unset, { zone: label(device) })}
      </Text>
      <Text style={[styles.note, { color: tokens.muted }]}>{text.note}</Text>
      <AuthError message={problem} />
      {!isAdmin ? (
        <Text style={[styles.note, { color: tokens.muted }]}>
          {text.adminOnly}
        </Text>
      ) : null}
      {isAdmin ? (
        <Button
          variant="secondary"
          label={text.choose}
          busy={busy === 'choose'}
          disabled={busy !== null}
          onPress={() => setChoosing(true)}
          testID="choose-group-time-zone"
        />
      ) : null}
      {isAdmin && !sameTimeZone(group.timeZone, device) ? (
        <Button
          variant="secondary"
          label={text.useDevice}
          busy={busy === 'device'}
          disabled={busy !== null}
          onPress={() => void save('device', device)}
          testID="use-device-time-zone"
        />
      ) : null}
      {isAdmin && group.timeZone !== undefined ? (
        <Button
          variant="secondary"
          label={text.clear}
          busy={busy === 'clear'}
          disabled={busy !== null}
          onPress={() => void save('clear', null)}
          testID="clear-group-time-zone"
        />
      ) : null}
      {choosing ? (
        <TimeZoneSheet
          selected={group.timeZone}
          onChoose={(zone) => {
            setChoosing(false)
            void save('choose', zone)
          }}
          onClose={() => setChoosing(false)}
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
