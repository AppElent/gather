import type {
  AgendaRow,
  CalendarEvent,
  CalendarPerson,
  CalendarView,
} from '@gather/core/calendar'
import { addDays } from '@gather/core/civil-date'
import Constants from 'expo-constants'
import { Stack } from 'expo-router'
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
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
import { useTokens } from '../../theme/tokens'
import { CalendarAgenda } from './CalendarAgenda'
import { CalendarHeader } from './CalendarHeader'
import {
  initialCalendarNavigation,
  pageActiveDate,
  selectCalendarDate,
  setCalendarView,
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
  onAdd: (date: string) => void
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
  onAdd,
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
  const [expandedByMonth, setExpandedByMonth] = useState<
    Record<string, readonly string[]>
  >({})
  const activeMonth = navigation.activeDate.slice(0, 7)
  useEffect(() => {
    onActiveDate(navigation.activeDate)
  }, [navigation.activeDate, onActiveDate])
  const from = useMemo(
    () => addDays(navigation.activeDate, -21),
    [navigation.activeDate],
  )
  const toExclusive = useMemo(
    () => addDays(navigation.activeDate, 42),
    [navigation.activeDate],
  )

  const expandedDates = expandedByMonth[activeMonth] ?? []

  const jumpToDate = useCallback((date: string) => {
    setNavigation((current) => selectCalendarDate(current, date))
  }, [])

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        testID="calendar-screen"
        style={[
          styles.screen,
          {
            backgroundColor: tokens.bg,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <CalendarHeader
          activeDate={navigation.activeDate}
          today={today}
          presentation={navigation.presentation}
          progress={navigation.headerProgress}
          topInset={topInset}
          events={data.events}
          people={data.people}
          onSelectDate={jumpToDate}
          onPage={(direction) =>
            setNavigation((current) => pageActiveDate(current, direction))
          }
          onToggle={() => setNavigation((current) => toggleHeader(current))}
          onView={(view: CalendarView) => {
            setNavigation((current) => setCalendarView(current, view))
            onViewChange(view)
          }}
          onAdd={() => onAdd(navigation.activeDate)}
          onOpenCalendars={onOpenCalendars}
          onOpenPeople={onOpenPeople}
        />
        {/* box-none: the row itself never takes a touch, but the draft pill does. */}
        <View style={styles.status} pointerEvents="box-none">
          {data.hiddenCalendarIds.length > 0 ? (
            <Text style={[styles.filterStatus, { color: tokens.accent }]}>
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
                { backgroundColor: tokens.tile },
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text style={[styles.draftText, { color: tokens.accent }]}>
                {t.calendar.resumeDraft}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {sourceNodes}
        <CalendarAgenda
          from={from}
          toExclusive={toExclusive}
          selectedDate={navigation.activeDate}
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
    borderRadius: 999,
  },
  draftText: { fontSize: 14, fontWeight: '600' },
  filterStatus: { fontSize: 11, fontWeight: '600' },
})
