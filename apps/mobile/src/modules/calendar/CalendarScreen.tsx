import {
  type AgendaRow,
  addCalendarDays,
  type CalendarEvent,
  type CalendarPerson,
  type CalendarView,
  normalizeCalendarEvent,
  todayCalendarDate,
} from '@gather/core/calendar'
import Constants from 'expo-constants'
import { Stack } from 'expo-router'
import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react'
import {
  type FlatList,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useGroup } from '../../group/GroupProvider'
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
  events: CalendarEvent[]
  people: CalendarPerson[]
  hiddenCalendarIds?: string[]
}

export interface CalendarScreenProps {
  data?: CalendarScreenData
  today?: string
  onAdd?: (date: string) => void
  onEvent?: (event: CalendarEvent) => void
  onDeleteEvent?: (event: CalendarEvent) => void
  preferredView?: CalendarView
  sourceNodes?: ReactNode
  onViewChange?: (view: CalendarView) => void
  onOpenCalendars?: () => void
  onOpenPeople?: () => void
  hasDraft?: boolean
  onResumeDraft?: () => void
}

export function CalendarScreen({
  data,
  today = todayCalendarDate(),
  onAdd,
  onEvent,
  onDeleteEvent,
  preferredView = 'week',
  sourceNodes,
  onViewChange,
  onOpenCalendars,
  onOpenPeople,
  hasDraft = false,
  onResumeDraft,
}: CalendarScreenProps) {
  const { group } = useGroup()
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
  const hidden = useMemo(
    () => data?.hiddenCalendarIds ?? [],
    [data?.hiddenCalendarIds],
  )
  const events = useMemo(
    () => (data?.events ?? []).map(normalizeCalendarEvent),
    [data?.events],
  )
  const from = useMemo(
    () => addCalendarDays(navigation.activeDate, -21),
    [navigation.activeDate],
  )
  const toExclusive = useMemo(
    () => addCalendarDays(navigation.activeDate, 42),
    [navigation.activeDate],
  )
  const filteredEvents = useMemo(
    () => events.filter((event) => !hidden.includes(event.calendarId)),
    [events, hidden],
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
          events={filteredEvents}
          people={data?.people ?? []}
          onSelectDate={jumpToDate}
          onPage={(direction) =>
            setNavigation((current) => pageActiveDate(current, direction))
          }
          onToggle={() => setNavigation((current) => toggleHeader(current))}
          onView={(view: CalendarView) => {
            setNavigation((current) => setCalendarView(current, view))
            onViewChange?.(view)
          }}
          onAdd={() => onAdd?.(navigation.activeDate)}
          onOpenCalendars={() => onOpenCalendars?.()}
          onOpenPeople={() => onOpenPeople?.()}
        />
        <View style={styles.status} pointerEvents="none">
          {hidden.length > 0 ? (
            <Text style={[styles.filterStatus, { color: tokens.accent }]}>
              {t.calendar.filtersActive}
            </Text>
          ) : null}
          {!data ? (
            <Text style={[styles.loading, { color: tokens.muted }]}>
              {t.calendar.loading}
            </Text>
          ) : null}
          {hasDraft ? (
            <Text
              testID="calendar-resume-draft"
              onPress={onResumeDraft}
              style={[styles.filterStatus, { color: tokens.accent }]}
            >
              {t.calendar.resumeDraft}
            </Text>
          ) : null}
        </View>
        {sourceNodes}
        <CalendarAgenda
          from={from}
          toExclusive={toExclusive}
          selectedDate={navigation.activeDate}
          today={today}
          events={filteredEvents}
          people={data?.people ?? []}
          expandedDates={expandedDates}
          onSelectDate={jumpToDate}
          onEvent={(event) => onEvent?.(event)}
          onDeleteEvent={(event) => onDeleteEvent?.(event)}
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
        <Text accessibilityLabel={group.name} style={styles.hiddenGroup}>
          {group.name}
        </Text>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  status: { minHeight: 18, paddingHorizontal: 16, alignItems: 'center' },
  filterStatus: { fontSize: 11, fontWeight: '600' },
  loading: { fontSize: 12 },
  hiddenGroup: { position: 'absolute', width: 1, height: 1, opacity: 0 },
})
