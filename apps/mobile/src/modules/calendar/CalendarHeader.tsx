import { MenuView } from '@expo/ui/community/menu'
import {
  type CalendarEvent,
  type CalendarPerson,
  type CalendarView,
  visibleMarksForDate,
} from '@gather/core/calendar'
import { monthGrid, weekOf } from '@gather/core/civil-date'
import {
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
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
import { RADIUS, SIZE, TABULAR, TYPE, useTokens } from '../../theme/tokens'

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
  const grid = monthGrid(activeDate)
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
                    selected && { backgroundColor: tokens.ink },
                    isToday &&
                      !selected && {
                        borderColor: tokens.ink,
                        borderWidth: 1.5,
                      },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      {
                        color: selected
                          ? tokens.onInk
                          : tokens.ink,
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
                        { color: tokens.tintOf(mark.color).text },
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
  const dates = weekOf(activeDate)
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
                  selected && { backgroundColor: tokens.ink },
                  isToday &&
                    !selected && {
                      borderColor: tokens.ink,
                      borderWidth: 1.5,
                    },
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    {
                      color: selected
                        ? tokens.onInk
                        : tokens.ink,
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
                      { color: tokens.tintOf(mark.color).text },
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
  // The header's two resting heights are measured, never assumed: at a large
  // text size the month grid is far taller than any fixed number, and a clip
  // would cut off its last weeks. At rest nothing clips; only a drag
  // interpolates between the week and month heights last laid out.
  const weekHeight = useSharedValue(0)
  const monthHeight = useSharedValue(0)
  const onLayout = (event: LayoutChangeEvent) => {
    if (dragging.value) return
    const height = event.nativeEvent.layout.height
    if (props.presentation === 'month') monthHeight.value = height
    else if (props.presentation === 'week') weekHeight.value = height
  }
  const animatedStyle = useAnimatedStyle(() => {
    if (!dragging.value) return { maxHeight: undefined }
    const known = Math.max(weekHeight.value, monthHeight.value)
    const collapsed = weekHeight.value || known
    const expanded = monthHeight.value || known
    return {
      maxHeight: interpolate(dragProgress.value, [0, 1], [collapsed, expanded]),
    }
  })
  const title = displayDate(props.activeDate, locale, {
    month: 'long',
    year: 'numeric',
  })

  return (
    <Animated.View
      onLayout={onLayout}
      style={[
        styles.container,
        { backgroundColor: tokens.ground, paddingTop: props.topInset ?? 0 },
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
          <Text style={[styles.todayText, { color: tokens.accentText }]}>
            {t.calendar.today}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={title}
          onPress={() => props.onSelectDate(props.activeDate)}
          style={styles.titleButton}
        >
          <Text style={[styles.title, { color: tokens.ink }]}>{title}</Text>
        </Pressable>
        <View style={styles.actions}>
          <Pressable
            testID="calendar-new"
            accessibilityRole="button"
            accessibilityLabel={t.calendar.accessibility.add}
            onPress={props.onAdd}
            style={[styles.iconButton, { backgroundColor: tokens.surface2 }]}
          >
            <Add size={19} color={tokens.ink} />
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
              style={[styles.iconButton, { backgroundColor: tokens.surface2 }]}
            >
              <More size={19} color={tokens.ink} />
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
          <View style={[styles.handle, { backgroundColor: tokens.hair }]} />
        </Pressable>
      </GestureDetector>
      <View style={styles.pager}>
        <Pressable
          accessibilityLabel={t.calendar.views.week}
          onPress={() => props.onPage(-1)}
          style={styles.arrow}
        >
          <Text style={[styles.arrowText, { color: tokens.accentText }]}>‹</Text>
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
          <Text style={[styles.arrowText, { color: tokens.accentText }]}>›</Text>
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
  today: { minWidth: 54, minHeight: SIZE.hitMin, justifyContent: 'center' },
  todayText: { ...TYPE.bodyStrong },
  titleButton: { flexShrink: 1, minHeight: SIZE.hitMin, justifyContent: 'center' },
  title: { ...TYPE.title2, textTransform: 'capitalize' },
  actions: { flexDirection: 'row', gap: 7 },
  iconButton: {
    width: SIZE.hitMin,
    height: SIZE.hitMin,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleArea: { minHeight: 26, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 42, height: 5, borderRadius: 3 },
  pager: { flexDirection: 'row', alignItems: 'center' },
  arrow: { minWidth: 26, alignItems: 'center', justifyContent: 'center' },
  arrowText: { ...TYPE.title2 },
  gridWrap: { flex: 1 },
  week: { flexDirection: 'row' },
  day: { flex: 1, alignItems: 'center', paddingVertical: 1, minHeight: 45 },
  dayInner: {
    minWidth: 32,
    minHeight: 32,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { ...TYPE.bodyStrong, ...TABULAR },
  marks: { flexDirection: 'row', minHeight: 13, alignItems: 'center', gap: 1 },
  mark: { ...TYPE.footnoteStrong },
  more: { ...TYPE.footnoteStrong, ...TABULAR },
})
