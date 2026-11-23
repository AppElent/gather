import { useAuth } from '@clerk/expo'
import { normalizeCalendarEvent } from '@gather/core/calendar'
import { minutesToClock } from '@gather/core/civil-date'
import { Stack } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { onSheetsClosing } from '../../components/openSheets'
import { api, type Id } from '../../convex/api'
import { usePaginatedQuery, useQuery } from '../../convex/queries'
import { useGroup } from '../../group/GroupProvider'
import { useI18n } from '../../i18n'
import { useRecordRecent } from '../../search/recentRecordsStore'
import { RADIUS, TYPE, useTokens } from '../../theme/tokens'
import { draftKey, keepDraft, keptDraft } from '../../ui/composer-drafts'
import { CalendarEditor } from './CalendarEditor'
import { isDraftDirty } from './calendarDraft'
import { useCalendarEditor } from './useCalendarEditor'

function time(value?: number) {
  return value === undefined ? null : minutesToClock(value)
}

export function CalendarEventScreen({ eventId }: { eventId: string }) {
  const { group } = useGroup()
  const { userId } = useAuth()
  const { t, locale } = useI18n()
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const event = useQuery(api.calendar.getCalendarEvent, {
    groupSlug: group.slug,
    id: eventId as Id<'calendarEvents'>,
  })
  const calendars = usePaginatedQuery(
    api.calendar.listCalendars,
    { groupSlug: group.slug },
    { initialNumItems: 100 },
  )
  const members = useQuery(api.groups.members, { slug: group.slug })
  const [editing, setEditing] = useState(false)
  const controller = useCalendarEditor()
  // A share closed the editor (APP-622): which draft it was on, so Edit comes
  // back on that one, a copy included. The draft itself is the editor's own.
  const keptKey = draftKey(userId, group._id, `calendar:event:${eventId}`)
  const onScreen = useRef(editing ? controller.draft : null)
  onScreen.current = editing ? controller.draft : null
  useEffect(
    () =>
      onSheetsClosing(() => {
        const draft = onScreen.current
        if (draft && isDraftDirty(draft)) keepDraft(keptKey, draft.draftId)
      }),
    [keptKey],
  )
  useRecordRecent(
    event && event !== null
      ? {
          id: event._id,
          type: 'calendarEvent',
          title: event.title,
          detail: event.date,
        }
      : null,
  )

  if (event === undefined)
    return <View style={{ flex: 1, backgroundColor: tokens.ground }} />
  if (event === null)
    return (
      <>
        <Stack.Screen
          options={{ headerShown: true, title: t.modules.byId.calendar.label }}
        />
        <View style={[styles.center, { backgroundColor: tokens.ground }]}>
          <Text style={{ color: tokens.muted }}>{t.search.noResults}</Text>
        </View>
      </>
    )

  const start = time(event.startMinutes)
  const end = time(event.endMinutes)
  const model = normalizeCalendarEvent({
    ...event,
    id: event._id,
    assigneeIds: event.assigneeIds,
    location: event.location,
    notes: event.notes,
    revision: event.revision,
  })
  const when = new Date(`${event.date}T12:00:00`).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: event.title }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.ground }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: tokens.ink }]}
        >
          {event.title}
        </Text>
        <Pressable
          testID="calendar-event-edit"
          onPress={() => {
            const kept = keptDraft<string>(keptKey)
            keepDraft(keptKey, undefined)
            const draft = controller.draft
            if (kept === undefined || draft?.draftId !== kept)
              controller.openEdit(model)
            // One whose save failed since is still shown, with why.
            else if (draft.status === 'dismissed') controller.resume()
            setEditing(true)
          }}
          style={[styles.edit, { borderColor: tokens.hair }]}
        >
          <Text style={{ color: tokens.accentText }}>
            {t.common.actions.edit}
          </Text>
        </Pressable>
        <View
          style={[
            styles.card,
            { backgroundColor: tokens.surface, borderColor: tokens.hair },
          ]}
        >
          <Text style={[styles.label, { color: tokens.muted }]}>
            {event.calendarName}
          </Text>
          <Text style={[styles.value, { color: tokens.ink }]}>{when}</Text>
          <Text style={[styles.value, { color: tokens.ink }]}>
            {event.allDay
              ? t.calendar.allDay
              : start && end
                ? `${start}–${end}`
                : t.calendar.time}
          </Text>
          <Text style={[styles.value, { color: tokens.ink }]}>
            {event.assigneeIds.length
              ? event.assigneeIds
                  .map(
                    (id) =>
                      members?.find((member) => member.userId === id)?.name ??
                      t.calendar.formerMember,
                  )
                  .join(', ')
              : t.calendar.unassigned}
          </Text>
          {event.location ? (
            <Text style={[styles.value, { color: tokens.ink }]}>
              {event.location}
            </Text>
          ) : null}
          {event.notes ? (
            <Text style={[styles.value, { color: tokens.ink }]}>
              {event.notes}
            </Text>
          ) : null}
        </View>
      </ScrollView>
      {editing && controller.draft ? (
        <CalendarEditor
          controller={controller}
          people={(members ?? []).map((member) => ({
            id: member.userId,
            name: member.name,
          }))}
          calendars={calendars.results.map((calendar) => ({
            id: calendar._id,
            name: calendar.name,
          }))}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 14 },
  title: { ...TYPE.title2, letterSpacing: -0.6 },
  card: {
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    padding: 14,
  },
  edit: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: { ...TYPE.footnote },
  value: { ...TYPE.body },
})
