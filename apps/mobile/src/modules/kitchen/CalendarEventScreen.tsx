import { normalizeCalendarEvent } from '@gather/core/calendar'
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { Stack } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { useAvailability } from '../../availability/AvailabilityProvider'
import { useGroup } from '../../group/GroupProvider'
import { useI18n } from '../../i18n'
import { useRecordRecent } from '../../search/recentRecordsStore'
import { RADIUS, useTokens } from '../../theme/tokens'
import { CalendarEditor } from '../calendar/CalendarEditor'
import { useCalendarEditor } from '../calendar/useCalendarEditor'

function time(value?: number) {
  if (value === undefined) return null
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

export function CalendarEventScreen({ eventId }: { eventId: string }) {
  const { group } = useGroup()
  const { t, locale } = useI18n()
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const event = useQuery(api.kitchen.getCalendarEvent, {
    groupSlug: group.slug,
    id: eventId as Id<'calendarEvents'>,
  })
  const calendars = usePaginatedQuery(
    api.calendar.listCalendars,
    { groupSlug: group.slug },
    { initialNumItems: 100 },
  )
  const members = useQuery(api.groups.members, { slug: group.slug })
  const me = useQuery(api.users.me)
  const { serviceActionsEnabled } = useAvailability()
  const addEvent = useMutation(api.kitchen.addCalendarEvent)
  const updateEvent = useMutation(api.calendar.updateEvent)
  const removeEvent = useMutation(api.kitchen.removeCalendarEvent)
  const [editing, setEditing] = useState(false)
  const controller = useCalendarEditor({
    userId: me?._id ?? '',
    groupId: group._id,
    connected: serviceActionsEnabled && Boolean(me),
    create: async (payload) => {
      if (!payload.calendarId) throw new Error('calendar:calendarRequired')
      return await addEvent({
        groupSlug: group.slug,
        calendarId: payload.calendarId as never,
        title: payload.title,
        date: payload.date,
        allDay: payload.allDay,
        startMinutes: payload.startMinutes ?? undefined,
        endMinutes: payload.endMinutes ?? undefined,
        assigneeIds: payload.assigneeIds as Id<'users'>[],
        location: payload.location ?? undefined,
        notes: payload.notes ?? undefined,
      })
    },
    update: async (id, revision, payload) =>
      await updateEvent({
        groupSlug: group.slug,
        id: id as never,
        expectedRevision: revision,
        title: payload.title,
        calendarId: payload.calendarId as never,
        date: payload.date,
        allDay: payload.allDay,
        startMinutes: payload.startMinutes,
        endMinutes: payload.endMinutes,
        assigneeIds: payload.assigneeIds as Id<'users'>[],
        location: payload.location,
        notes: payload.notes,
      }),
    remove: async (id) => {
      await removeEvent({ groupSlug: group.slug, id: id as never })
    },
  })
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
    return <View style={{ flex: 1, backgroundColor: tokens.bg }} />
  if (event === null)
    return (
      <>
        <Stack.Screen
          options={{ headerShown: true, title: t.modules.byId.calendar.label }}
        />
        <View style={[styles.center, { backgroundColor: tokens.bg }]}>
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
        style={{ backgroundColor: tokens.bg }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: tokens.fg }]}
        >
          {event.title}
        </Text>
        <Pressable
          testID="calendar-event-edit"
          onPress={() => {
            controller.openEdit(model)
            setEditing(true)
          }}
          style={[styles.edit, { borderColor: tokens.border }]}
        >
          <Text style={{ color: tokens.accent }}>{t.actions.edit}</Text>
        </Pressable>
        <View
          style={[
            styles.card,
            { backgroundColor: tokens.surface, borderColor: tokens.border },
          ]}
        >
          <Text style={[styles.label, { color: tokens.muted }]}>
            {event.calendarName}
          </Text>
          <Text style={[styles.value, { color: tokens.fg }]}>{when}</Text>
          <Text style={[styles.value, { color: tokens.fg }]}>
            {event.allDay
              ? t.calendar.allDay
              : start && end
                ? `${start}–${end}`
                : t.calendar.time}
          </Text>
          <Text style={[styles.value, { color: tokens.fg }]}>
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
            <Text style={[styles.value, { color: tokens.fg }]}>
              {event.location}
            </Text>
          ) : null}
          {event.notes ? (
            <Text style={[styles.value, { color: tokens.fg }]}>
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
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.6 },
  card: {
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    padding: 14,
  },
  edit: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: { fontSize: 13.5 },
  value: { fontSize: 16 },
})
