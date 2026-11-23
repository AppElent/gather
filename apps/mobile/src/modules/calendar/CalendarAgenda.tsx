import {
  type AgendaRow,
  agendaRows,
  type CalendarEvent,
  type CalendarPerson,
} from '@gather/core/calendar'
import { addMonths, minutesToClock } from '@gather/core/civil-date'
import { useEffect, useMemo, useRef } from 'react'
import {
  FlatList,
  type FlatListProps,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { NativeContextMenu } from '../../components/NativeContextMenu'
import { SwipeableRow } from '../../components/SwipeableRow'
import { fmt, useI18n } from '../../i18n'
import { RADIUS, TABULAR, TYPE, useTokens } from '../../theme/tokens'
import { headingCase } from './calendarLabels'
import { agendaMonths } from './calendarNavigation'

export interface CalendarAgendaProps {
  /** The first loaded month's first day. */
  from: string
  /** The first day after the last loaded month. */
  toExclusive: string
  /** The date a deliberate jump asked for; kept visible even inside a gap. */
  selectedDate: string
  /** The date the header shows, which follows scrolling. */
  shownDate?: string
  /** Changes on every deliberate jump, so jumping to the same date scrolls too. */
  jumpId?: number
  today: string
  events: readonly CalendarEvent[]
  /**
   * Whether a month's events are all in. A month still loading says so
   * instead of "No events". Left out, every month counts as loaded.
   */
  monthLoaded?: (month: string) => boolean
  people: readonly CalendarPerson[]
  onSelectDate: (date: string) => void
  onEvent: (event: CalendarEvent) => void
  onDeleteEvent?: (event: CalendarEvent) => void
  onExpandGap?: (dates: readonly string[]) => void
  expandedDates?: readonly string[]
  listRef?: React.RefObject<FlatList<AgendaRow> | null>
  /**
   * The first row's date while the person scrolls the list. Never after a
   * jump until they touch the list again: a jump near the end of the loaded
   * rows cannot bring its day to the top, and the row above it is not the
   * date they chose.
   */
  onVisibleDate?: (date: string) => void
  /** The person dragged the list upward, toward later dates. */
  onDragUp?: () => void
  /** The person scrolled near the first loaded day: load the month before. */
  onLoadEarlier?: () => void
  /** The list came near its last loaded day: load the month after. */
  onLoadLater?: () => void
}

/** Points the list must travel up in one drag before the header collapses. */
const COLLAPSE_AFTER = 16

/** An agenda row, marked when its month's events have not all arrived yet. */
type AgendaListRow = AgendaRow & { loading?: boolean }

type ViewableChange = Parameters<
  NonNullable<FlatListProps<AgendaListRow>['onViewableItemsChanged']>
>[0]

function rowDate(row: AgendaRow) {
  return row.kind === 'gap' ? row.from : row.date
}

function minutes(value?: number) {
  return value == null ? '' : minutesToClock(value)
}

export function CalendarAgenda({
  from,
  toExclusive,
  selectedDate,
  shownDate = selectedDate,
  jumpId = 0,
  today,
  events,
  monthLoaded,
  people,
  onSelectDate,
  onEvent,
  onDeleteEvent,
  onExpandGap,
  expandedDates = [],
  listRef,
  onVisibleDate,
  onDragUp,
  onLoadEarlier,
  onLoadLater,
}: CalendarAgendaProps) {
  const { t, locale } = useI18n()
  const tokens = useTokens('home')
  // Month by month, so an empty run never spans two months: a month added at
  // either end then leaves every row already on screen, and its key, alone,
  // which is what lets the list hold its place while it grows.
  const rows = useMemo(() => {
    return agendaMonths({ from, toExclusive }).flatMap(
      (month): AgendaListRow[] => {
        const monthRows = agendaRows(
          events,
          month,
          addMonths(month, 1),
          today,
          selectedDate,
          expandedDates,
        )
        // Same rows and keys either way, so a month whose events land holds
        // its place in the list; only the empty rows' words change.
        if (!monthLoaded || monthLoaded(month)) return monthRows
        return monthRows.map((row) => ({ ...row, loading: true }))
      },
    )
  }, [events, expandedDates, from, monthLoaded, selectedDate, toExclusive, today])
  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.id, person.name])),
    [people],
  )

  /**
   * A jump stays "current" until the person touches the list: while it is,
   * rows arriving above the target (a month loading) re-aim it, and the rows
   * it scrolls past do not move the header. Touching the list ends it, so a
   * late load never pulls the list back from under a finger.
   */
  const pendingJump = useRef(true)
  /** The jump the person last dragged the list after; null before any drag. */
  const draggedSince = useRef<number | null>(null)
  const dragStart = useRef<number | null>(null)
  const latest = useRef({ onVisibleDate, onDragUp, jumpId })
  latest.current = { onVisibleDate, onDragUp, jumpId }

  const lastJump = useRef<number | null>(null)

  useEffect(() => {
    if (lastJump.current !== jumpId) {
      lastJump.current = jumpId
      pendingJump.current = true
    }
    if (!pendingJump.current) return
    const index = rows.findIndex(
      (row) => row.kind === 'day' && row.date === selectedDate,
    )
    if (index < 0) return
    listRef?.current?.scrollToIndex({
      index,
      animated: true,
      viewPosition: 0,
    })
  }, [jumpId, listRef, rows, selectedDate])

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: ViewableChange) => {
      // Only a person scrolling moves the header; a jump, its scroll and the
      // layout after it keep the date they chose.
      if (draggedSince.current !== latest.current.jumpId) return
      const first = viewableItems.find((token) => token.isViewable)
      if (first?.item) latest.current.onVisibleDate?.(rowDate(first.item))
    },
  ).current

  /** The list's own height and offset, for the check below. */
  const viewport = useRef(0)
  /** The rows an earlier month was last asked for, so each set asks once. */
  const askedEarlierFor = useRef<AgendaListRow[] | null>(null)
  const lastOffset = useRef(0)
  const lastContentHeight = useRef(0)

  /**
   * Within a screen of the first row, ask for the month before. Not
   * `onStartReached`: after a prepend the list waits for the scroll event
   * that `maintainVisibleContentPosition` owes it and drops the check, so at
   * the very top it stalled until the person scrolled away and back.
   */
  const maybeLoadEarlier = (offset: number) => {
    const towardEarlier = offset < lastOffset.current
    lastOffset.current = offset
    // Not while a jump is under way: it is aiming at a row, and the list
    // sits at its very start until the first layout. And only on the way
    // toward earlier days, so a drag toward later ones keeps its collapse.
    if (pendingJump.current || !viewport.current || !towardEarlier) return
    if (offset > viewport.current) return
    if (askedEarlierFor.current === rows) return
    askedEarlierFor.current = rows
    onLoadEarlier?.()
  }

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = event.nativeEvent.contentOffset.y
    const grew = event.nativeEvent.contentSize.height - lastContentHeight.current
    const moved = offset - lastOffset.current
    lastContentHeight.current = event.nativeEvent.contentSize.height
    // Rows that grow above the visible ones (a month landing, events arriving
    // for one, cells measured late) move the offset by their height. That is
    // the list holding its place, not the finger, so the drag's start moves
    // with it instead of reading as a drag toward later days.
    if (dragStart.current !== null && grew > 0 && moved > 0)
      dragStart.current += Math.min(grew, moved)
    maybeLoadEarlier(offset)
    if (dragStart.current === null) return
    if (event.nativeEvent.contentOffset.y - dragStart.current > COLLAPSE_AFTER) {
      dragStart.current = null
      latest.current.onDragUp?.()
    }
  }

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
        {/* Clipped to the card's own corners, so the Delete action behind
            the row shows only when the row is swiped. */}
        <View style={styles.eventClip}>
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
              { backgroundColor: tokens.surface, borderColor: tokens.hair },
              pressed && styles.pressed,
            ]}
          >
            <View
              style={[
                styles.colorBar,
                { backgroundColor: tokens.tintOf(event.color).fill },
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
              <Text style={[styles.eventTitle, { color: tokens.ink }]}>
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
        </View>
      </NativeContextMenu>
    )
  }

  const shortDay = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
    })

  function renderRow({ item }: { item: AgendaListRow }) {
    if (item.kind === 'gap' && item.loading) {
      return (
        <View
          testID={`calendar-gap-${item.from}`}
          style={[styles.gap, { borderColor: tokens.hair }]}
        >
          <Text style={[styles.gapText, { color: tokens.muted }]}>
            {t.calendar.loadingEvents}
          </Text>
        </View>
      )
    }
    if (item.kind === 'gap') {
      return (
        <Pressable
          testID={`calendar-gap-${item.from}`}
          onPress={() => onExpandGap?.(item.dates)}
          style={[styles.gap, { borderColor: tokens.hair }]}
          accessibilityRole="button"
        >
          <Text style={[styles.gapText, { color: tokens.muted }]}>
            {fmt(t.calendar.noEventsRange, {
              from: shortDay(item.from),
              to: shortDay(item.to),
            })}
          </Text>
        </Pressable>
      )
    }
    const label = headingCase(
      new Date(`${item.date}T12:00:00`).toLocaleDateString(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
      locale,
    )
    return (
      <View testID={`calendar-agenda-day-${item.date}`}>
        <Pressable
          onPress={() => {
            onSelectDate(item.date)
          }}
          style={styles.dayHeading}
          accessibilityRole="header"
        >
          {/* The selected day is set in ink and the others in muted; the long
              label already says which day it is, so there is no second, ISO
              copy of it. */}
          <Text
            style={[
              styles.dayTitle,
              { color: item.date === shownDate ? tokens.ink : tokens.muted },
            ]}
          >
            {item.date === today ? `${t.calendar.today} · ${label}` : label}
          </Text>
        </Pressable>
        {item.events.length === 0 ? (
          <Text style={[styles.empty, { color: tokens.muted }]}>
            {item.loading
              ? t.calendar.loadingEvents
              : t.calendar.nothingPlanned}
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
      viewabilityConfig={VIEWABILITY}
      onViewableItemsChanged={onViewableItemsChanged}
      scrollEventThrottle={16}
      onScroll={onScroll}
      // Rows added above the first visible one (an earlier month, or events
      // arriving for one) push the content down by exactly their height, so
      // the row under the finger stays put.
      maintainVisibleContentPosition={MAINTAIN_POSITION}
      onLayout={(event) => {
        viewport.current = event.nativeEvent.layout.height
      }}
      onEndReachedThreshold={1}
      onEndReached={() => onLoadLater?.()}
      onScrollBeginDrag={(event) => {
        pendingJump.current = false
        draggedSince.current = jumpId
        dragStart.current = event.nativeEvent.contentOffset.y
      }}
      onScrollEndDrag={() => {
        dragStart.current = null
      }}
      onScrollToIndexFailed={(info) => {
        // Variable-height rows: land near the estimate, then re-aim once the
        // rows on the way are measured. The jump is still pending, so the
        // next layout of `rows` retries it; a finger on the list cancels it.
        listRef?.current?.scrollToOffset({
          offset: info.averageItemLength * info.index,
          animated: false,
        })
        requestAnimationFrame(() => {
          if (!pendingJump.current) return
          listRef?.current?.scrollToIndex({
            index: info.index,
            animated: false,
            viewPosition: 0,
          })
        })
      }}
    />
  )
}

const MAINTAIN_POSITION = { minIndexForVisible: 0 }

/** A row counts as "the first row" once half of it is on screen. */
const VIEWABILITY = { itemVisiblePercentThreshold: 50 }

const styles = StyleSheet.create({
  content: { paddingHorizontal: 12, paddingBottom: 120 },
  dayHeading: {
    minHeight: 50,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayTitle: { ...TYPE.bodyStrong },
  empty: { ...TYPE.footnote, paddingHorizontal: 8, paddingBottom: 12 },
  event: {
    minHeight: 68,
    flexDirection: 'row',
    borderRadius: RADIUS.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  eventClip: {
    marginBottom: 8,
    borderRadius: RADIUS.card,
    overflow: 'hidden',
  },
  colorBar: { width: 4 },
  eventBody: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 3 },
  eventTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  when: { ...TYPE.footnoteStrong, ...TABULAR },
  calendar: { ...TYPE.footnote, flexShrink: 1 },
  eventTitle: { ...TYPE.bodyStrong },
  meta: { ...TYPE.footnote },
  gap: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginVertical: 8,
  },
  gapText: { ...TYPE.footnote },
  pressed: { opacity: 0.7 },
})
