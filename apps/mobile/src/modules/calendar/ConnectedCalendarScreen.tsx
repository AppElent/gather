import type {
  CalendarEvent,
  CalendarPeopleFilter,
  CalendarView,
} from '@gather/core/calendar'
import { localIsoDate } from '@gather/core/civil-date'
import { useMutation } from 'convex/react'
import { useState } from 'react'
import { Alert } from 'react-native'
import { api, type Id } from '../../convex/api'
import { confirmDestructive } from '../../feedback/confirmDestructive'
import { useGroup } from '../../group/GroupProvider'
import { fmt, useI18n } from '../../i18n'
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
  const [today] = useState(() => localIsoDate())
  const [activeDate, setActiveDate] = useState(today)
  const [filterSheet, setFilterSheet] = useState<'people' | null>(null)
  const [management, setManagement] = useState(false)
  const data = useCalendarData(group.slug, activeDate)
  const setPreferences = useMutation(api.calendar.setPreferences)
  const visibility = useMutation(api.calendar.setCalendarVisibility)
  const [editorVisible, setEditorVisible] = useState(false)
  const editor = useCalendarEditor()

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
        onActiveDate={setActiveDate}
        preferredView={data.view}
        sourceNodes={sourceNodes}
        onOpenCalendars={() => setManagement(true)}
        onOpenPeople={() => setFilterSheet('people')}
        onViewChange={saveView}
        onAdd={openNew}
        onEvent={openEvent}
        onDeleteEvent={(event) =>
          confirmDestructive({
            title: fmt(t.calendar.confirmDelete, { title: event.title }),
            confirm: t.calendar.deleteEvent,
            cancel: t.common.actions.cancel,
            onConfirm: () => void editor.deleteForEvent(event.id),
          })
        }
        hasDraft={editor.draft?.status === 'dismissed'}
        onResumeDraft={() => {
          editor.resume()
          setEditorVisible(true)
        }}
      />
      {filterSheet ? (
        <CalendarFilters
          people={data.people}
          peopleFilter={data.peopleFilter}
          onClose={() => setFilterSheet(null)}
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
