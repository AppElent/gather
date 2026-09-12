import type {
  CalendarEvent,
  CalendarPeopleFilter,
  CalendarView,
} from '@gather/core/calendar'
import { todayCalendarDate } from '@gather/core/calendar'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { Alert } from 'react-native'
import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { useAvailability } from '../../availability/AvailabilityProvider'
import { useGroup } from '../../group/GroupProvider'
import { useI18n } from '../../i18n'
import { CalendarEditor } from './CalendarEditor'
import { CalendarEventSource } from './CalendarEventSource'
import { CalendarFilters } from './CalendarFilters'
import { CalendarManagementSheet } from './CalendarManagementSheet'
import { CalendarScreen } from './CalendarScreen'
import { isDraftDirty } from './calendarDraft'
import { useCalendarData } from './useCalendarData'
import { useCalendarEditor } from './useCalendarEditor'

export function ConnectedCalendarScreen() {
  const { group } = useGroup()
  const { t } = useI18n()
  const [today] = useState(todayCalendarDate)
  const [filterSheet, setFilterSheet] = useState<'people' | null>(null)
  const [management, setManagement] = useState(false)
  const data = useCalendarData(group.slug, today)
  const { serviceActionsEnabled } = useAvailability()
  const me = useQuery(api.users.me)
  const setPreferences = useMutation(api.calendar.setPreferences)
  const visibility = useMutation(api.kitchen.setCalendarVisibility)
  const addEvent = useMutation(api.kitchen.addCalendarEvent)
  const updateEvent = useMutation(api.calendar.updateEvent)
  const removeEvent = useMutation(api.kitchen.removeCalendarEvent)
  const [editorVisible, setEditorVisible] = useState(false)
  const editor = useCalendarEditor({
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

  const saveView = (view: CalendarView) => {
    void setPreferences({ groupSlug: group.slug, view })
  }
  const savePeople = (peopleFilter: CalendarPeopleFilter | null) => {
    void setPreferences({
      groupSlug: group.slug,
      peopleFilter: peopleFilter
        ? {
            userIds: [...peopleFilter.userIds] as Id<'users'>[],
            includeUnassigned: peopleFilter.includeUnassigned,
          }
        : null,
    })
  }
  const sourceNodes = data.sources.map((source) => (
    <CalendarEventSource
      key={source.sourceKey}
      {...source}
      groupSlug={group.slug}
      onEvents={data.onEvents}
    />
  ))
  const withDraftGuard = (continueWith: () => void) => {
    const draft = editor.draft
    if (!draft || !isDraftDirty(draft) || draft.status === 'dismissed')
      return continueWith()
    Alert.alert(t.calendar.unsavedChanges, undefined, [
      {
        text: t.calendar.resumeDraft,
        onPress: () => {
          editor.resume()
          setEditorVisible(true)
        },
      },
      {
        text: t.calendar.continueAnyway,
        style: 'destructive',
        onPress: () => {
          editor.discard()
          continueWith()
        },
      },
      { text: t.calendar.stay, style: 'cancel' },
    ])
  }
  const openNew = (date: string) =>
    withDraftGuard(() => {
      const firstCalendar =
        data.calendars
          .slice()
          .sort(
            (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
          )[0]?.id ?? null
      editor.openNew(date, firstCalendar)
      setEditorVisible(true)
    })
  const openEvent = (event: CalendarEvent) =>
    withDraftGuard(() => {
      editor.openEdit(event)
      setEditorVisible(true)
    })
  return (
    <>
      <CalendarScreen
        key={
          data.preferencesReady
            ? 'calendar-preferences-ready'
            : 'calendar-preferences-loading'
        }
        data={data}
        today={today}
        preferredView={data.view}
        sourceNodes={sourceNodes}
        onOpenCalendars={() => setManagement(true)}
        onOpenPeople={() => setFilterSheet('people')}
        onViewChange={saveView}
        onAdd={openNew}
        onEvent={openEvent}
        onDeleteEvent={(event) =>
          Alert.alert(
            t.calendar.confirmDelete.replace('{title}', event.title),
            undefined,
            [
              { text: t.actions.cancel, style: 'cancel' },
              {
                text: t.calendar.deleteEvent,
                style: 'destructive',
                onPress: () => void editor.deleteForEvent?.(event.id),
              },
            ],
          )
        }
        hasDraft={editor.draft?.status === 'dismissed'}
        onResumeDraft={() => {
          editor.resume()
          setEditorVisible(true)
        }}
      />
      {filterSheet ? (
        <CalendarFilters
          calendars={data.calendars}
          hiddenCalendarIds={data.hiddenCalendarIds ?? []}
          people={data.people}
          peopleFilter={data.peopleFilter}
          mode="people"
          onClose={() => setFilterSheet(null)}
          onCalendar={() => undefined}
          onPeople={savePeople}
        />
      ) : null}
      {management ? (
        <CalendarManagementSheet
          groupSlug={group.slug}
          calendars={data.calendars}
          hiddenCalendarIds={data.hiddenCalendarIds ?? []}
          onVisibility={(id, visible) => {
            void visibility({
              groupSlug: group.slug,
              calendarId: id as never,
              visible,
            })
          }}
          onCreated={(id) => editor.changeField('calendarId', id)}
          onClose={() => setManagement(false)}
        />
      ) : null}
      {editorVisible && editor.draft?.status !== 'dismissed' ? (
        <CalendarEditor
          controller={editor}
          people={data.people}
          calendars={data.calendars}
          onCreateCalendar={() => setManagement(true)}
          onClose={() => setEditorVisible(false)}
        />
      ) : null}
    </>
  )
}
