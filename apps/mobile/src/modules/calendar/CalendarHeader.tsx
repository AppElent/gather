import { MenuView } from '@expo/ui/community/menu'
import {
  type CalendarEvent,
  type CalendarPerson,
  type CalendarView,
  visibleMarksForDate,
} from '@gather/core/calendar'
import { monthGrid, weekOf } from '@gather/core/civil-date'
import { useRef, useState } from 'react'
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
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'

import { WeekdayStrip } from '../../components/MonthGridView'
import { useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, SIZE, TABULAR, TYPE, useTokens } from '../../theme/tokens'
import { headingCase } from './calendarLabels'

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
  /** A vertical header drag ended at `progress` (0 week, 1 month), moving at `velocity` points a second (positive is down). */
  onSettle: (progress: number, velocity: number) => void
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

/**
 * A day's marks under its number, the same in Month and Week: one mark plus a
 * `+n` for the rest, so a busy day never looks lighter in one view.
 */
function DayMarks({
  marks,
}: {
  marks: ReturnType<typeof visibleMarksForDate>
}) {
  const tokens = useTokens('home')
  return (
    <View style={styles.marks}>
      {marks.marks.map((mark) => (
        <Text
          key={mark.key}
          style={[styles.mark, { color: tokens.tintOf(mark.color).text }]}
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
  )
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
                <DayMarks marks={marks} />
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
              <DayMarks marks={marks} />
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

/** Points of travel that make a sideways drag a page turn. */
const PAGE_DISTANCE = 40
/** A sideways flick this fast pages even when it travelled less. */
const PAGE_VELOCITY = 500
/** One row of the month grid: the day cell's minimum height. */
const ROW_HEIGHT = 45
/**
 * The strip along the left edge the header leaves alone, so the platform's
 * edge-swipe back still belongs to the navigator.
 */
const EDGE_BACK = 24
/** The header's height limit at rest: far above any month grid. */
const UNCLIPPED = 10_000

export function CalendarHeader(props: CalendarHeaderProps) {
  const { t, locale } = useI18n()
  const tokens = useTokens('home')
  const Add = UI_ICONS.Plus
  const More = UI_ICONS.CircleEllipsis
  const dragProgress = useSharedValue(props.progress)
  const dragging = useSharedValue(false)
  // The header's two resting heights are measured, never assumed: at a large
  // text size the month grid is far taller than any fixed number, and a clip
  // would cut off its last weeks. At rest nothing clips; only a drag
  // interpolates between the week and month heights last laid out.
  const weekHeight = useSharedValue(0)
  const monthHeight = useSharedValue(0)
  /** Which way the current drag was read: decided once, at activation. */
  const axis = useRef<'x' | 'y' | null>(null)
  const startProgress = useRef(props.progress)
  /**
   * While a vertical drag is under way the month grid is drawn whatever the
   * presentation, so pulling the week strip down reveals the month's rows
   * under the finger instead of empty space.
   */
  const [previewMonth, setPreviewMonth] = useState(false)

  const expandedHeight = () =>
    monthHeight.value ||
    (weekHeight.value ? weekHeight.value + 5 * ROW_HEIGHT : 0)
  const span = () => {
    const expanded = expandedHeight()
    return expanded && weekHeight.value
      ? Math.max(expanded - weekHeight.value, ROW_HEIGHT)
      : 240
  }

  // On the JS thread: every callback below ends in React state, and none of
  // them runs per frame except the progress write, which is a shared value.
  const gesture = Gesture.Pan()
    .runOnJS(true)
    .hitSlop({ left: -EDGE_BACK })
    .activeOffsetX([-12, 12])
    .activeOffsetY([-10, 10])
    .onStart((event) => {
      axis.current =
        Math.abs(event.translationX) > Math.abs(event.translationY) ? 'x' : 'y'
      if (axis.current === 'y') {
        startProgress.current = props.progress
        dragProgress.value = props.progress
        dragging.value = true
        setPreviewMonth(true)
      }
    })
    .onUpdate((event) => {
      if (axis.current !== 'y') return
      dragProgress.value = Math.max(
        0,
        Math.min(1, startProgress.current + event.translationY / span()),
      )
    })
    .onEnd((event) => {
      if (axis.current === 'x') {
        if (
          Math.abs(event.translationX) > PAGE_DISTANCE ||
          Math.abs(event.velocityX) > PAGE_VELOCITY
        )
          props.onPage(event.translationX < 0 ? 1 : -1)
        return
      }
      if (axis.current === 'y')
        props.onSettle(dragProgress.value, event.velocityY)
    })
    // `onFinalize`, not `onEnd`: a touch that never became a drag (a tap on a
    // day, a cancelled pan) ends here too, and a header left "dragging" keeps
    // its clip and hides the month's rows.
    .onFinalize(() => {
      axis.current = null
      dragging.value = false
      setPreviewMonth(false)
    })

  const onLayout = (event: LayoutChangeEvent) => {
    if (dragging.value) return
    const height = event.nativeEvent.layout.height
    if (props.presentation === 'month') monthHeight.value = height
    else if (props.presentation === 'week') weekHeight.value = height
  }
  const animatedStyle = useAnimatedStyle(() => {
    // A real number, not `undefined`: an animated style that drops a prop
    // leaves the last native value in place, so the drag's final clamp would
    // stick and clip the month grid under the agenda.
    if (!dragging.value) return { maxHeight: UNCLIPPED }
    const known = Math.max(weekHeight.value, monthHeight.value)
    const collapsed = weekHeight.value || known
    const expanded =
      monthHeight.value ||
      (weekHeight.value ? weekHeight.value + 5 * ROW_HEIGHT : known)
    return {
      maxHeight: interpolate(dragProgress.value, [0, 1], [collapsed, expanded]),
    }
  })
  const showMonth =
    props.presentation === 'month' ||
    (previewMonth && props.presentation === 'week')
  const paging =
    props.presentation === 'month'
      ? {
          previous: t.calendar.accessibility.previousMonth,
          next: t.calendar.accessibility.nextMonth,
        }
      : {
          previous: t.calendar.accessibility.previousWeek,
          next: t.calendar.accessibility.nextWeek,
        }
  const title = headingCase(
    displayDate(props.activeDate, locale, {
      month: 'long',
      year: 'numeric',
    }),
    locale,
  )

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
      {/* One drag surface over the handle and the dates: vertical moves
          between Week and Month, sideways pages. Taps still reach the days. */}
      <GestureDetector gesture={gesture}>
        <View>
          <Pressable
            testID="calendar-header-handle"
            accessibilityRole="button"
            accessibilityLabel={t.calendar.accessibility.headerHandle}
            onPress={props.onToggle}
            style={styles.handleArea}
          >
            <View style={[styles.handle, { backgroundColor: tokens.hair }]} />
          </Pressable>
          <View style={styles.pager}>
            <Pressable
              testID="calendar-page-previous"
              accessibilityRole="button"
              accessibilityLabel={paging.previous}
              onPress={() => props.onPage(-1)}
              style={styles.arrow}
            >
              <Text style={[styles.arrowText, { color: tokens.accentText }]}>
                ‹
              </Text>
            </Pressable>
            <View style={styles.gridWrap}>
              {showMonth ? (
                <MonthDays {...props} />
              ) : props.presentation === 'agenda' ? null : (
                <WeekDays {...props} />
              )}
            </View>
            <Pressable
              testID="calendar-page-next"
              accessibilityRole="button"
              accessibilityLabel={paging.next}
              onPress={() => props.onPage(1)}
              style={styles.arrow}
            >
              <Text style={[styles.arrowText, { color: tokens.accentText }]}>
                ›
              </Text>
            </Pressable>
          </View>
        </View>
      </GestureDetector>
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
  title: { ...TYPE.title2 },
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
