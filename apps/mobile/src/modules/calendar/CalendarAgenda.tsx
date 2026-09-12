import {
  type AgendaRow,
  agendaRows,
  type CalendarEvent,
  type CalendarPerson,
} from '@gather/core/calendar'
import { useEffect, useMemo } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'

import { NativeContextMenu } from '../../components/NativeContextMenu'
import { SwipeableRow } from '../../components/SwipeableRow'
import { useI18n } from '../../i18n'
import { RADIUS, useTokens } from '../../theme/tokens'

export interface CalendarAgendaProps {
  from: string
  toExclusive: string
  selectedDate: string
  today: string
  events: readonly CalendarEvent[]
  people: readonly CalendarPerson[]
  onSelectDate: (date: string) => void
  onEvent: (event: CalendarEvent) => void
  onDeleteEvent?: (event: CalendarEvent) => void
  onExpandGap?: (dates: readonly string[]) => void
  expandedDates?: readonly string[]
  listRef?: React.RefObject<FlatList<AgendaRow> | null>
}

function minutes(value?: number) {
  if (value == null) return ''
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

export function CalendarAgenda({
  from,
  toExclusive,
  selectedDate,
  today,
  events,
  people,
  onSelectDate,
  onEvent,
  onDeleteEvent,
  onExpandGap,
  expandedDates = [],
  listRef,
}: CalendarAgendaProps) {
  const { t, locale } = useI18n()
  const tokens = useTokens('home')
  const rows = useMemo(
    () => agendaRows(events, from, toExclusive, selectedDate, expandedDates),
    [events, expandedDates, from, selectedDate, toExclusive],
  )
  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.id, person.name])),
    [people],
  )

  useEffect(() => {
    const index = rows.findIndex(
      (row) => row.kind === 'day' && row.date === selectedDate,
    )
    if (index >= 0)
      listRef?.current?.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.1,
      })
  }, [listRef, rows, selectedDate])

  function renderEvent(event: CalendarEvent) {
    const who = event.assigneeIds
      .map((id) => peopleById.get(id) ?? t.calendar.formerMember)
      .join(', ')
    const when = event.allDay
      ? t.calendar.allDay
      : `${minutes(event.startMinutes)}–${minutes(event.endMinutes)}`
    return (
      <NativeContextMenu
        key={event.id}
        actions={[
          { id: 'edit', title: t.calendar.edit },
          { id: 'duplicate', title: t.calendar.duplicate },
          {
            id: 'delete',
            title: t.calendar.deleteEvent,
            attributes: { destructive: true },
          },
        ]}
        onAction={(action) => {
          if (action === 'delete') onDeleteEvent?.(event)
          else onEvent(event)
        }}
      >
        <SwipeableRow
          deleteLabel={t.calendar.deleteEvent}
          onDelete={() => onDeleteEvent?.(event)}
        >
          <Pressable
            testID={`calendar-event-${event.id}`}
            accessibilityRole="button"
            accessibilityLabel={`${event.title}, ${when}`}
            onPress={() => onEvent(event)}
            style={({ pressed }) => [
              styles.event,
              { backgroundColor: tokens.surface, borderColor: tokens.border },
              pressed && styles.pressed,
            ]}
          >
            <View
              style={[
                styles.colorBar,
                { backgroundColor: tokens.tintOf(event.color).fg },
              ]}
            />
            <View style={styles.eventBody}>
              <View style={styles.eventTop}>
                <Text style={[styles.when, { color: tokens.muted }]}>
                  {when}
                </Text>
                <Text style={[styles.calendar, { color: tokens.muted }]}>
                  {event.calendarName ?? event.calendarId}
                </Text>
              </View>
              <Text style={[styles.eventTitle, { color: tokens.fg }]}>
                {event.title}
              </Text>
              {who ? (
                <Text style={[styles.meta, { color: tokens.muted }]}>
                  {who}
                </Text>
              ) : null}
              {event.location ? (
                <Text style={[styles.meta, { color: tokens.muted }]}>
                  {event.location}
                </Text>
              ) : null}
            </View>
          </Pressable>
        </SwipeableRow>
      </NativeContextMenu>
    )
  }

  function renderRow({ item }: { item: AgendaRow }) {
    if (item.kind === 'gap') {
      return (
        <Pressable
          testID={`calendar-gap-${item.from}`}
          onPress={() => onExpandGap?.(item.dates)}
          style={[styles.gap, { borderColor: tokens.border }]}
          accessibilityRole="button"
        >
          <Text style={[styles.gapText, { color: tokens.muted }]}>
            {t.calendar.noEventsRange
              .replace('{from}', item.from)
              .replace('{to}', item.to)}
          </Text>
        </Pressable>
      )
    }
    const label = new Date(`${item.date}T12:00:00`).toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
    return (
      <View testID={`calendar-agenda-day-${item.date}`}>
        <Pressable
          onPress={() => {
            onSelectDate(item.date)
          }}
          style={styles.dayHeading}
          accessibilityRole="header"
        >
          <Text style={[styles.dayTitle, { color: tokens.fg }]}>
            {item.date === today ? t.calendar.today : label}
          </Text>
          <Text
            style={[
              styles.dayDate,
              {
                color:
                  item.date === selectedDate ? tokens.accent : tokens.muted,
              },
            ]}
          >
            {item.date}
          </Text>
        </Pressable>
        {item.events.length === 0 ? (
          <Text style={[styles.empty, { color: tokens.muted }]}>
            {t.calendar.nothingPlanned}
          </Text>
        ) : (
          item.events.map(renderEvent)
        )}
      </View>
    )
  }

  return (
    <FlatList
      ref={listRef}
      testID="calendar-agenda"
      data={rows}
      keyExtractor={(row) => row.key}
      renderItem={renderRow}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      onScrollToIndexFailed={(info) =>
        listRef?.current?.scrollToOffset({
          offset: info.averageItemLength * info.index,
          animated: false,
        })
      }
    />
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 12, paddingBottom: 120 },
  dayHeading: {
    minHeight: 50,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayTitle: { fontSize: 16, fontWeight: '700', textTransform: 'capitalize' },
  dayDate: { fontSize: 12 },
  empty: { paddingHorizontal: 8, paddingBottom: 12, fontSize: 13 },
  event: {
    minHeight: 68,
    flexDirection: 'row',
    borderRadius: RADIUS.control,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
    overflow: 'hidden',
  },
  colorBar: { width: 4 },
  eventBody: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 3 },
  eventTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  when: { fontSize: 12, fontWeight: '600' },
  calendar: { fontSize: 11, flexShrink: 1 },
  eventTitle: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 12 },
  gap: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginVertical: 8,
  },
  gapText: { fontSize: 13 },
  pressed: { opacity: 0.7 },
})
