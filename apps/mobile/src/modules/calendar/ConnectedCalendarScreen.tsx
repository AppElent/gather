import { useAuth } from '@clerk/expo'
import type {
  CalendarEvent,
  CalendarPeopleFilter,
  CalendarView,
} from '@gather/core/calendar'
import { todayIn } from '@gather/core/civil-date'
import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api, type Id } from '../../convex/api'
import { useQuery } from '../../convex/queries'
import { confirmDestructive } from '../../feedback/confirmDestructive'
import { useGroup } from '../../group/GroupProvider'
import { fmt, useI18n } from '../../i18n'
import { showAlert } from '../../observability/native-presentation'
import { AddEvent, type HandOver } from './AddEventComposer'
import { CalendarEditor } from './CalendarEditor'
import { CalendarEventSource } from './CalendarEventSource'
import { CalendarFilters } from './CalendarFilters'
import { CalendarManagementSheet } from './CalendarManagementSheet'
import { CalendarScreen } from './CalendarScreen'
import { isDraftDirty } from './calendarDraft'
import { type EventDraft, toCalendarDraft } from './eventComposerDraft'
import { useCalendarData } from './useCalendarData'
import { useCalendarEditor } from './useCalendarEditor'

export function ConnectedCalendarScreen() {
  const { group } = useGroup()
  const { t } = useI18n()
  const today = todayIn(group.timeZone)
  const [activeDate, setActiveDate] = useState(today)
  const [lastToday, setLastToday] = useState(today)
  if (lastToday !== today) {
    setLastToday(today)
    if (activeDate === lastToday) setActiveDate(today)
  }
  const [filterSheet, setFilterSheet] = useState<'people' | null>(null)
  const [management, setManagement] = useState(false)
  const data = useCalendarData(group.slug, activeDate)
  const setPreferences = useMutation(api.calendar.setPreferences)
  const visibility = useMutation(api.calendar.setCalendarVisibility)
  const [editorVisible, setEditorVisible] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const editor = useCalendarEditor()
  const { userId } = useAuth()
  const me = useQuery(api.users.me)

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
    showAlert(t.calendar.unsavedChanges, undefined, [
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
    ], { holdsShare: true })
  }
  /**
   * The composer's All details: the full editor takes its draft, unless the
   * editor still holds unsaved changes of its own and the person keeps them.
   */
  const openDetails = (draft: EventDraft) =>
    new Promise<HandOver>((resolve) => {
      const take = () => {
        editor.openDraft(toCalendarDraft(draft, me?._id ?? '', group._id))
        setEditorVisible(true)
        resolve('taken')
      }
      const held = editor.draft
      if (!held || !isDraftDirty(held)) return take()
      showAlert(t.calendar.unsavedChanges, undefined, [
        {
          text: t.calendar.resumeDraft,
          onPress: () => {
            editor.resume()
            setEditorVisible(true)
            resolve('resumed')
          },
        },
        {
          text: t.calendar.continueAnyway,
          style: 'destructive',
          onPress: () => {
            editor.discard()
            take()
          },
        },
        { text: t.calendar.stay, style: 'cancel', onPress: () => resolve('stay') },
      ], { holdsShare: true, onDismiss: () => resolve('stay') })
    })
  // Back once the editor has saved, closed or set its draft aside.
  const composerHidden =
    editorVisible &&
    Boolean(editor.draft) &&
    editor.draft?.status !== 'dismissed'
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
        // The floating button's composer: already open, it stays the one.
        onAddEvent={() => {
          if (!composerHidden) setComposerOpen(true)
        }}
        onViewChange={saveView}
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
      <AddEvent
        key={userId ?? 'signed-out'}
        calendars={data.calendars}
        people={data.people}
        date={activeDate}
        hidden={composerHidden}
        open={composerOpen}
        onOpenChange={setComposerOpen}
        onAllDetails={openDetails}
      />
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
