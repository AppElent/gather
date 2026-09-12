import { MenuView } from '@expo/ui/community/menu'
import {
  type CalendarEvent,
  type CalendarPerson,
  type CalendarView,
  calendarMonthGrid,
  visibleMarksForDate,
} from '@gather/core/calendar'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'

import { WeekdayStrip } from '../../components/MonthGridView'
import { useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { useTokens } from '../../theme/tokens'

export interface CalendarHeaderProps {
  activeDate: string
  today: string
  presentation: CalendarView
  progress: number
  events: readonly CalendarEvent[]
  people: readonly CalendarPerson[]
  onSelectDate: (date: string) => void
  onPage: (direction: -1 | 1) => void
  onToggle: () => void
  onView: (view: CalendarView) => void
  onAdd: () => void
  onOpenCalendars: () => void
  onOpenPeople: () => void
  topInset?: number
}

function displayDate(
  date: string,
  locale: string,
  options: Intl.DateTimeFormatOptions,
) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(locale, options)
}

function MonthDays({
  activeDate,
  today,
  events,
  people,
  onSelectDate,
}: Pick<
  CalendarHeaderProps,
  'activeDate' | 'today' | 'events' | 'people' | 'onSelectDate'
>) {
  const tokens = useTokens('home')
  const { locale } = useI18n()
  const grid = calendarMonthGrid(activeDate)
  return (
    <View testID="calendar-month-grid">
      <WeekdayStrip locale={locale} />
      {grid.map((week, index) => (
        <View key={index} style={styles.week}>
          {week.map((date, column) => {
            if (!date) return <View key={column} style={styles.day} />
            const marks = visibleMarksForDate(date, events, people)
            const selected = date === activeDate
            const isToday = date === today
            return (
              <Pressable
                key={date}
                testID={`calendar-day-${date}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={displayDate(date, locale, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
                onPress={() => onSelectDate(date)}
                style={styles.day}
              >
                <View
                  style={[
                    styles.dayInner,
                    selected && { backgroundColor: tokens.accent },
                    isToday &&
                      !selected && {
                        borderColor: tokens.accent,
                        borderWidth: 1.5,
                      },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      {
                        color: selected
                          ? tokens.onAccent
                          : isToday
                            ? tokens.accent
                            : tokens.fg,
                      },
                    ]}
                  >
                    {Number(date.slice(-2))}
                  </Text>
                </View>
                <View style={styles.marks}>
                  {marks.marks.map((mark) => (
                    <Text
                      key={mark.key}
                      style={[
                        styles.mark,
                        { color: tokens.tintOf(mark.color).fg },
                      ]}
                    >
                      {mark.initial ?? '•'}
                    </Text>
                  ))}
                  {marks.overflow > 0 ? (
                    <Text style={[styles.more, { color: tokens.muted }]}>
                      +{marks.overflow}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            )
          })}
        </View>
      ))}
    </View>
  )
}

function WeekDays({
  activeDate,
  today,
  events,
  people,
  onSelectDate,
}: Pick<
  CalendarHeaderProps,
  'activeDate' | 'today' | 'events' | 'people' | 'onSelectDate'
>) {
  const tokens = useTokens('home')
  const { locale } = useI18n()
  const first = new Date(`${activeDate}T12:00:00`)
  const monday = new Date(first)
  monday.setDate(first.getDate() - ((first.getDay() + 6) % 7))
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    return date.toISOString().slice(0, 10)
  })
  return (
    <View testID="calendar-week-grid">
      <WeekdayStrip locale={locale} />
      <View style={styles.week}>
        {dates.map((date) => {
          const selected = date === activeDate
          const isToday = date === today
          const marks = visibleMarksForDate(date, events, people)
          return (
            <Pressable
              key={date}
              testID={`calendar-day-${date}`}
              onPress={() => onSelectDate(date)}
              style={styles.day}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={displayDate(date, locale, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            >
              <View
                style={[
                  styles.dayInner,
                  selected && { backgroundColor: tokens.accent },
                  isToday &&
                    !selected && {
                      borderColor: tokens.accent,
                      borderWidth: 1.5,
                    },
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    {
                      color: selected
                        ? tokens.onAccent
                        : isToday
                          ? tokens.accent
                          : tokens.fg,
                    },
                  ]}
                >
                  {Number(date.slice(-2))}
                </Text>
              </View>
              <View style={styles.marks}>
                {marks.marks.slice(0, 2).map((mark) => (
                  <Text
                    key={mark.key}
                    style={[
                      styles.mark,
                      { color: tokens.tintOf(mark.color).fg },
                    ]}
                  >
                    {mark.initial ?? '•'}
                  </Text>
                ))}
              </View>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

export function CalendarHeader(props: CalendarHeaderProps) {
  const { t, locale } = useI18n()
  const tokens = useTokens('home')
  const Add = UI_ICONS.Plus
  const More = UI_ICONS.CircleEllipsis
  const dragProgress = useSharedValue(props.progress)
  const dragging = useSharedValue(false)
  const gesture = Gesture.Pan()
    .runOnJS(true)
    .onBegin(() => {
      dragProgress.value = props.progress
      dragging.value = true
    })
    .onUpdate((event) => {
      dragProgress.value = Math.max(
        0,
        Math.min(1, props.progress + event.translationY / 240),
      )
    })
    .onEnd((event) => {
      dragging.value = false
      if (
        Math.abs(event.translationX) > Math.abs(event.translationY) &&
        Math.abs(event.translationX) > 24
      ) {
        runOnJS(props.onPage)(event.translationX < 0 ? 1 : -1)
      } else {
        runOnJS(props.onToggle)()
      }
    })
  const animatedStyle = useAnimatedStyle(() => ({
    maxHeight: interpolate(
      dragging.value ? dragProgress.value : props.progress,
      [0, 1],
      [202, 392],
    ),
  }))
  const title = displayDate(props.activeDate, locale, {
    month: 'long',
    year: 'numeric',
  })

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: tokens.bg, paddingTop: props.topInset ?? 0 },
        animatedStyle,
      ]}
    >
      <View style={styles.toolbar}>
        <Pressable
          testID="calendar-today"
          accessibilityRole="button"
          accessibilityLabel={t.calendar.accessibility.today}
          onPress={() => props.onSelectDate(props.today)}
          style={styles.today}
        >
          <Text style={[styles.todayText, { color: tokens.accent }]}>
            {t.calendar.today}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={title}
          onPress={() => props.onSelectDate(props.activeDate)}
        >
          <Text style={[styles.title, { color: tokens.fg }]}>{title}</Text>
        </Pressable>
        <View style={styles.actions}>
          <Pressable
            testID="calendar-new"
            accessibilityRole="button"
            accessibilityLabel={t.calendar.accessibility.add}
            onPress={props.onAdd}
            style={[styles.iconButton, { backgroundColor: tokens.tile }]}
          >
            <Add size={19} color={tokens.fg} />
          </Pressable>
          <MenuView
            shouldOpenOnLongPress={false}
            actions={[
              {
                id: 'month',
                title: t.calendar.month,
                state: props.presentation === 'month' ? 'on' : 'off',
              },
              {
                id: 'week',
                title: t.calendar.weekAgenda,
                state: props.presentation === 'week' ? 'on' : 'off',
              },
              {
                id: 'agenda',
                title: t.calendar.agenda,
                state: props.presentation === 'agenda' ? 'on' : 'off',
              },
              { id: 'calendars', title: t.calendar.calendars },
              { id: 'people', title: t.calendar.people },
            ]}
            onPressAction={({ nativeEvent }) => {
              if (nativeEvent.event === 'calendars') props.onOpenCalendars()
              else if (nativeEvent.event === 'people') props.onOpenPeople()
              else props.onView(nativeEvent.event as CalendarView)
            }}
          >
            <Pressable
              testID="calendar-view-menu"
              accessibilityRole="button"
              accessibilityLabel={t.calendar.accessibility.viewMenu}
              style={[styles.iconButton, { backgroundColor: tokens.tile }]}
            >
              <More size={19} color={tokens.fg} />
            </Pressable>
          </MenuView>
        </View>
      </View>
      <GestureDetector gesture={gesture}>
        <Pressable
          testID="calendar-header-handle"
          accessibilityRole="button"
          accessibilityLabel={t.calendar.accessibility.headerHandle}
          onPress={props.onToggle}
          style={styles.handleArea}
        >
          <View style={[styles.handle, { backgroundColor: tokens.border }]} />
        </Pressable>
      </GestureDetector>
      <View style={styles.pager}>
        <Pressable
          accessibilityLabel={t.calendar.views.week}
          onPress={() => props.onPage(-1)}
          style={styles.arrow}
        >
          <Text style={[styles.arrowText, { color: tokens.accent }]}>‹</Text>
        </Pressable>
        <View style={styles.gridWrap}>
          {props.presentation === 'month' ? (
            <MonthDays {...props} />
          ) : props.presentation === 'agenda' ? null : (
            <WeekDays {...props} />
          )}
        </View>
        <Pressable
          accessibilityLabel={t.calendar.views.week}
          onPress={() => props.onPage(1)}
          style={styles.arrow}
        >
          <Text style={[styles.arrowText, { color: tokens.accent }]}>›</Text>
        </Pressable>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', paddingHorizontal: 12 },
  toolbar: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  today: { minWidth: 54, minHeight: 44, justifyContent: 'center' },
  todayText: { fontSize: 15, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', textTransform: 'capitalize' },
  actions: { flexDirection: 'row', gap: 7 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleArea: { height: 26, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 42, height: 5, borderRadius: 3 },
  pager: { flexDirection: 'row', alignItems: 'center' },
  arrow: { width: 26, alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontSize: 30, lineHeight: 34 },
  gridWrap: { flex: 1 },
  week: { flexDirection: 'row' },
  day: { flex: 1, alignItems: 'center', paddingVertical: 1, minHeight: 45 },
  dayInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { fontSize: 14, fontWeight: '600' },
  marks: { flexDirection: 'row', height: 13, alignItems: 'center', gap: 1 },
  mark: { fontSize: 9, fontWeight: '800' },
  more: { fontSize: 8, fontWeight: '700' },
})
