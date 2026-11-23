import type {
  AgendaRow,
  CalendarEvent,
  CalendarPerson,
  CalendarView,
} from '@gather/core/calendar'
import Constants from 'expo-constants'
import { Stack } from 'expo-router'
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  type FlatList,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useI18n } from '../../i18n'
import { RADIUS, TYPE, useTokens } from '../../theme/tokens'
import { CalendarAgenda } from './CalendarAgenda'
import { CalendarHeader } from './CalendarHeader'
import {
  agendaRangeAround,
  agendaRangeForJump,
  chooseHeader,
  extendAgendaRange,
  initialCalendarNavigation,
  pageActiveDate,
  selectCalendarDate,
  setCalendarView,
  settleHeader,
  toggleHeader,
} from './calendarNavigation'

export interface CalendarScreenData {
  calendars: { id: string; name: string; color?: CalendarEvent['color'] }[]
  /** Normalized, with hidden calendars and the people filter already applied. */
  events: CalendarEvent[]
  people: CalendarPerson[]
  hiddenCalendarIds: string[]
}

export interface CalendarScreenProps {
  data: CalendarScreenData
  today: string
  /** Told whenever the visible date moves, so the events around it are loaded. */
  onActiveDate: (date: string) => void
  onEvent: (event: CalendarEvent) => void
  onDeleteEvent: (event: CalendarEvent) => void
  preferredView: CalendarView
  sourceNodes: ReactNode
  onViewChange: (view: CalendarView) => void
  onOpenCalendars: () => void
  onOpenPeople: () => void
  hasDraft: boolean
  onResumeDraft: () => void
}

export function CalendarScreen({
  data,
  today,
  onActiveDate,
  onEvent,
  onDeleteEvent,
  preferredView,
  sourceNodes,
  onViewChange,
  onOpenCalendars,
  onOpenPeople,
  hasDraft,
  onResumeDraft,
}: CalendarScreenProps) {
  const { t } = useI18n()
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const topInset = Math.max(
    insets.top,
    StatusBar.currentHeight ?? 0,
    Constants.statusBarHeight ?? 0,
    Platform.OS === 'android' ? 52 : 0,
  )
  const listRef = useRef<FlatList<AgendaRow>>(null)
  const [navigation, setNavigation] = useState(() =>
    initialCalendarNavigation(today, preferredView),
  )
  /**
   * The date of the first agenda row while the person scrolls. It drives the
   * header (month, week, selection) and Add, but never moves the list: only a
   * deliberate jump does that, so scrolling cannot pull the list back.
   */
  const [scrolledDate, setScrolledDate] = useState<string | null>(null)
  /** Bumped on every deliberate jump, even to the date already selected. */
  const [jumpId, setJumpId] = useState(0)
  const shownDate = scrolledDate ?? navigation.activeDate
  const [expandedByMonth, setExpandedByMonth] = useState<
    Record<string, readonly string[]>
  >({})
  const activeMonth = navigation.activeDate.slice(0, 7)
  useEffect(() => {
    onActiveDate(shownDate)
  }, [shownDate, onActiveDate])
  /** The whole months the agenda has loaded; scrolling grows it at either end. */
  const [range, setRange] = useState(() => agendaRangeAround(today))

  const expandedDates = expandedByMonth[activeMonth] ?? []

  const jumpToDate = useCallback((date: string) => {
    setScrolledDate(null)
    setJumpId((id) => id + 1)
    setRange((current) => agendaRangeForJump(current, date))
    setNavigation((current) => selectCalendarDate(current, date))
  }, [])

  const settle = (next: typeof navigation) => {
    setNavigation(next)
    // The preference, not the presentation: after an automatic collapse the
    // header already shows Week, and a drag that keeps it there is a choice.
    if (next.preferredView !== navigation.preferredView)
      onViewChange(next.preferredView)
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        testID="calendar-screen"
        style={[
          styles.screen,
          {
            backgroundColor: tokens.ground,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <CalendarHeader
          activeDate={shownDate}
          today={today}
          presentation={navigation.presentation}
          progress={navigation.headerProgress}
          topInset={topInset}
          events={data.events}
          people={data.people}
          onSelectDate={jumpToDate}
          onPage={(direction) =>
            jumpToDate(
              pageActiveDate({ ...navigation, activeDate: shownDate }, direction)
                .activeDate,
            )
          }
          onToggle={() => settle(toggleHeader(navigation))}
          onSettle={(progress, velocity) =>
            settle(chooseHeader(navigation, progress, velocity))
          }
          onView={(view: CalendarView) => {
            setNavigation((current) => setCalendarView(current, view))
            onViewChange(view)
          }}
          onOpenCalendars={onOpenCalendars}
          onOpenPeople={onOpenPeople}
        />
        {/* box-none: the row itself never takes a touch, but the draft pill does. */}
        <View style={styles.status} pointerEvents="box-none">
          {data.hiddenCalendarIds.length > 0 ? (
            <Text style={[styles.filterStatus, { color: tokens.accentText }]}>
              {t.calendar.filtersActive}
            </Text>
          ) : null}
          {hasDraft ? (
            <Pressable
              testID="calendar-resume-draft"
              accessibilityRole="button"
              onPress={onResumeDraft}
              hitSlop={8}
              style={({ pressed }) => [
                styles.draft,
                { backgroundColor: tokens.surface2 },
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text style={[styles.draftText, { color: tokens.ink }]}>
                {t.calendar.resumeDraft}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {sourceNodes}
        <CalendarAgenda
          from={range.from}
          toExclusive={range.toExclusive}
          selectedDate={navigation.activeDate}
          shownDate={shownDate}
          jumpId={jumpId}
          today={today}
          events={data.events}
          people={data.people}
          expandedDates={expandedDates}
          onSelectDate={jumpToDate}
          onEvent={onEvent}
          onDeleteEvent={onDeleteEvent}
          onExpandGap={(dates) => {
            setExpandedByMonth((current) => ({
              ...current,
              [activeMonth]: [
                ...new Set([...(current[activeMonth] ?? []), ...dates]),
              ],
            }))
            if (dates[0]) jumpToDate(dates[0])
          }}
          onVisibleDate={setScrolledDate}
          onDragUp={() => {
            // An automatic collapse: the list takes over the space, and the
            // saved preference stays whatever the person last chose. The
            // header springs to its new height by itself.
            if (navigation.presentation !== 'month') return
            setNavigation((current) => settleHeader(current, 0))
          }}
          onLoadEarlier={() =>
            setRange((current) => extendAgendaRange(current, -1))
          }
          onLoadLater={() =>
            setRange((current) => extendAgendaRange(current, 1))
          }
          listRef={listRef}
        />
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // Its own row below the week strip, not a line squeezed into the strip's
  // bottom edge where the day initials already sit.
  status: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    alignItems: 'center',
    gap: 6,
  },
  draft: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
  },
  draftText: { ...TYPE.bodyStrong },
  filterStatus: { ...TYPE.footnoteStrong },
})
