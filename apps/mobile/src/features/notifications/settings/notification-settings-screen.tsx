/**
 * Settings → Notifications (APP-298): which notifications this person wants,
 * in every Group, and which Groups they have muted.
 *
 * Two areas by two reasons, as four switches, then one switch per Group. The
 * switches are the person's own and follow the account; whether this *phone*
 * may show them is iOS's, and the card on top says so when it may not, with
 * the one way to change it. Asking from here is the person asking, so iOS's
 * sheet follows the tap directly, with no line in between.
 *
 * Existing rows and controls only: `InsetList` rows with a native switch.
 */
import type { NotificationSwitch } from '@gather/core/notifications'
import { useMutation } from 'convex/react'
import { Alert, Linking, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SettingsCard } from '../../../components/SettingsCard'
import { api, type Id } from '../../../convex/api'
import { useQuery } from '../../../convex/queries'
import { useGroup } from '../../../group/GroupProvider'
import { fmt, useI18n } from '../../../i18n'
import { SPACE, TYPE, useTokens } from '../../../theme/tokens'
import { Button } from '../../../ui/button'
import { InsetList, InsetRow } from '../../../ui/inset-list'
import { SectionLabel } from '../../../ui/section-label'
import { usePushPermission } from '../use-push-permission'

const AREAS = [
  { area: 'tasks', reminders: 'taskReminders', assignments: 'taskAssignments' },
  {
    area: 'calendar',
    reminders: 'eventReminders',
    assignments: 'eventAssignments',
  },
] as const satisfies readonly {
  area: 'tasks' | 'calendar'
  reminders: NotificationSwitch
  assignments: NotificationSwitch
}[]

export function NotificationSettingsScreen() {
  const tokens = useTokens()
  const insets = useSafeAreaInsets()
  const { t } = useI18n()
  const text = t.notifications
  const { groups } = useGroup()
  const { permission, ask } = usePushPermission()
  const settings = useQuery(api.notifications.settings, {})

  const setSwitch = useMutation(
    api.notifications.setSwitch,
  ).withOptimisticUpdate((store, { name, enabled }) => {
    const current = store.getQuery(api.notifications.settings, {})
    if (current)
      store.setQuery(
        api.notifications.settings,
        {},
        { ...current, switches: { ...current.switches, [name]: enabled } },
      )
  })
  const setGroupMuted = useMutation(
    api.notifications.setGroupMuted,
  ).withOptimisticUpdate((store, { groupSlug, muted }) => {
    const current = store.getQuery(api.notifications.settings, {})
    const group = groups.find((g) => g.slug === groupSlug)
    if (!current || !group) return
    const others = current.mutedGroupIds.filter((id) => id !== group._id)
    store.setQuery(
      api.notifications.settings,
      {},
      { ...current, mutedGroupIds: muted ? [...others, group._id] : others },
    )
  })

  const failed = () => Alert.alert(text.failed)
  const muted = new Set<Id<'groups'>>(settings?.mutedGroupIds ?? [])

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: tokens.ground }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 24 },
      ]}
    >
      {permission === 'undetermined' ? (
        <SettingsCard description={text.permission.off}>
          <Button
            label={text.permission.allow}
            onPress={() => void ask('settings')}
          />
        </SettingsCard>
      ) : permission === 'denied' ? (
        <SettingsCard description={text.permission.denied}>
          <Button
            variant="secondary"
            label={text.permission.openSettings}
            onPress={() => void Linking.openSettings()}
          />
        </SettingsCard>
      ) : null}

      <Text style={[styles.description, { color: tokens.muted }]}>
        {text.description}
      </Text>

      {AREAS.map(({ area, reminders, assignments }) => (
        <View key={area} style={styles.section}>
          <SectionLabel>{text[area]}</SectionLabel>
          <InsetList>
            {(
              [
                [reminders, text.reminders],
                [assignments, text.assignments],
              ] as const
            ).map(([name, label]) => (
              <InsetRow
                key={name}
                title={label}
                trailing={
                  <Switch
                    value={settings?.switches[name] ?? true}
                    disabled={!settings}
                    accessibilityLabel={fmt(text.switchLabel, {
                      area: text[area],
                      kind: label,
                    })}
                    onValueChange={(enabled) => {
                      setSwitch({ name, enabled }).catch(failed)
                    }}
                    trackColor={{ false: tokens.surface2 }}
                  />
                }
              />
            ))}
          </InsetList>
        </View>
      ))}

      <View style={styles.section}>
        <SectionLabel>{text.groups}</SectionLabel>
        <InsetList>
          {groups.map((group) => (
            <InsetRow
              key={group._id}
              title={group.name}
              trailing={
                <Switch
                  value={!muted.has(group._id)}
                  disabled={!settings}
                  accessibilityLabel={fmt(text.muteLabel, {
                    group: group.name,
                  })}
                  onValueChange={(on) => {
                    setGroupMuted({ groupSlug: group.slug, muted: !on }).catch(
                      failed,
                    )
                  }}
                  trackColor={{ false: tokens.surface2 }}
                />
              }
            />
          ))}
        </InsetList>
        <Text style={[styles.footnote, { color: tokens.muted }]}>
          {text.groupsDescription}
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACE[4], paddingTop: SPACE[4], gap: SPACE[4] },
  description: { ...TYPE.subhead, paddingHorizontal: 4 },
  section: { gap: 7 },
  footnote: { ...TYPE.footnote, paddingHorizontal: 4 },
})
