/**
 * The Calendar prototype: one screen, three layouts, live.
 *
 * The canvas decided that Month, Week+agenda and Agenda all ship, behind the
 * control iOS already has for "how should this be displayed" — and that they
 * are **one component with a `view` state and three bodies**, not three
 * screens, because three screens drift. That rule is why the bodies below sit
 * in one file however long it gets: splitting them is the drift.
 *
 * What this file does *not* decide is which of three ways you change that view,
 * what a month cell says, or how you add an event. Those are the three axes in
 * `axes.ts`, and every combination of them renders here. See `../variants.ts`
 * for why a mix beats a set of finished screens.
 *
 * Everything is in memory. `prototypes/calendar/build-brief.md` lists the five
 * schema changes the real Module needs; all five are faked in `fixtures.ts`.
 */
import { MenuView } from '@expo/ui/community/menu'
import { Stack } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Segmented } from '../../components/Segmented'
import { haptics } from '../../feedback/haptics'
import { useI18n } from '../../i18n'
import {
  monthGrid,
  monthOf,
  parseDay,
  shiftMonth,
  toIso,
} from '../../modules/tasks/taskDates'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, useTokens } from '../../theme/tokens'
import { PrototypeBanner } from '../PrototypeBanner'
import type {
  CalendarView,
  CellVariant,
  ComposerVariant,
  NavVariant,
} from './axes'
import { CALENDAR_VIEWS } from './axes'
import { CalendarComposer, type Draft } from './CalendarComposer'
import {
  LAB_CALENDARS,
  LAB_HIDDEN_CALENDAR_IDS,
  LAB_MEMBERS,
  type LabEvent,
  labEvents,
} from './fixtures'
import {
  agendaRows,
  cellMarks,
  dayHeading,
  eventsOn,
  timeLabel,
  visibleEvents,
} from './model'

/** One row of the month grid. Fixed, because the fluid header interpolates it. */
const ROW_HEIGHT = 58
const WEEKDAY_STRIP = 22
/** How far the agenda travels between the week strip and the whole month. */
const FLUID_RANGE = ROW_HEIGHT * 5

/** The app's sheet feel, reused so the header settles like everything else. */
const SPRING = { damping: 18, stiffness: 190, mass: 0.9 }

export interface CalendarLabProps {
  nav: NavVariant
  cell: CellVariant
  composer: ComposerVariant
}

export function CalendarLab({ nav, cell, composer }: CalendarLabProps) {
  const tokens = useTokens('home')
  const tint = tokens.tintOf('home')
  const insets = useSafeAreaInsets()
  const { t, locale } = useI18n()

  const today = useMemo(() => toIso(new Date()), [])
  const [events, setEvents] = useState<LabEvent[]>(() => labEvents(today))
  const [hidden, setHidden] = useState<string[]>(LAB_HIDDEN_CALENDAR_IDS)
  const [selected, setSelected] = useState(today)
  const [month, setMonth] = useState(() => monthOf(today))
  const [view, setView] = useState<CalendarView>('week')
  const [draft, setDraft] = useState<Draft | null>(null)

  const shown = useMemo(() => visibleEvents(events, hidden), [events, hidden])
  const grid = useMemo(() => monthGrid(month.year, month.month), [month])

  /**
   * The rule the drawing turned up: `monthGrid` always answers six rows so a
   * sheet does not jump as you page it, and on a full screen that trailing
   * all-null row is 52 points of nothing. The screen drops it; the composer's
   * picker, which is a sheet, does not.
   */
  const weeks = useMemo(
    () =>
      grid.weeks[5].every((day) => day === null)
        ? grid.weeks.slice(0, 5)
        : grid.weeks,
    [grid],
  )
  const selectedWeek = useMemo(
    () => weeks.find((week) => week.includes(selected)) ?? weeks[0],
    [weeks, selected],
  )

  /** 1 = the whole month is open, 0 = one week. Only the fluid nav moves it. */
  const openness = useSharedValue(1)
  const dragFrom = useSharedValue(1)

  const pickDay = (iso: string) => {
    haptics.selectionChanged()
    setSelected(iso)
    const of = monthOf(iso)
    if (of.year !== month.year || of.month !== month.month) setMonth(of)
  }

  const goToday = () => {
    haptics.selectionChanged()
    setSelected(today)
    setMonth(monthOf(today))
  }

  const changeView = (next: CalendarView) => {
    haptics.selectionChanged()
    setView(next)
  }

  const toggleCalendar = (id: string) =>
    setHidden((current) =>
      current.includes(id)
        ? current.filter((each) => each !== id)
        : [...current, id],
    )

  const openNew = () =>
    setDraft({
      mode: 'create',
      date: selected,
      title: '',
      calendarId: LAB_CALENDARS[0].id,
      who: [],
      allDay: false,
    })

  const openEdit = (event: LabEvent) =>
    setDraft({
      mode: 'edit',
      id: event.id,
      date: event.date,
      title: event.title,
      calendarId: event.calendarId,
      who: event.who,
      allDay: event.allDay,
      start: event.start,
      end: event.end,
    })

  /**
   * Create commits on the button; an edit applies live. That is the canvas's
   * answer to the Save question, and it is why one callback does both: the card
   * calls it once at the end for a create and on every change for an edit, and
   * neither case needs a different screen.
   */
  const applyDraft = (next: Draft) => {
    if (next.mode === 'edit') {
      setEvents((current) =>
        current.map((event) =>
          event.id === next.id
            ? {
                ...event,
                title: next.title,
                date: next.date,
                calendarId: next.calendarId,
                who: next.who,
                allDay: next.allDay,
                start: next.start,
                end: next.end,
              }
            : event,
        ),
      )
      return
    }
    haptics.itemSaved()
    setEvents((current) => [
      ...current,
      {
        id: `draft-${current.length}`,
        title: next.title.trim(),
        date: next.date,
        calendarId: next.calendarId,
        who: next.who,
        allDay: next.allDay,
        start: next.start,
        end: next.end,
      },
    ])
    setSelected(next.date)
  }

  const deleteEvent = (id: string) =>
    setEvents((current) => current.filter((event) => event.id !== id))

  const monthName = grid.first.toLocaleDateString(locale, { month: 'long' })
  const yearName = grid.first.toLocaleDateString(locale, { year: 'numeric' })

  /* ── the fluid header's gesture ───────────────────────────────────────
   * Only `transform` moves: the grid is drawn at its full height and slid up
   * so the selected week lands in the top slot, and the agenda — which is
   * opaque — slides down over whatever is left. Animating the container's
   * height instead would force a layout pass every frame.
   *
   * The drag is on the header rather than handed off from the agenda's scroll.
   * Handing a scroll to a header is a real gesture problem and this prototype
   * is not where it gets solved; what it has to answer is whether month and
   * week as a continuum read as a preference at all. */
  const selectedRow = Math.max(
    0,
    weeks.findIndex((week) => week.includes(selected)),
  )

  const pan = Gesture.Pan()
    .onBegin(() => {
      dragFrom.value = openness.value
    })
    .onUpdate((event) => {
      const next = dragFrom.value + event.translationY / FLUID_RANGE
      openness.value = Math.min(1, Math.max(0, next))
    })
    .onEnd((event) => {
      const settled = openness.value + event.velocityY / 2400 > 0.5 ? 1 : 0
      openness.value = withSpring(settled, SPRING)
    })

  const gridSlide = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          openness.value,
          [0, 1],
          [-selectedRow * ROW_HEIGHT, 0],
        ),
      },
    ],
  }))

  const agendaSlide = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          openness.value,
          [0, 1],
          [ROW_HEIGHT, weeks.length * ROW_HEIGHT],
        ),
      },
    ],
  }))

  const headerHeight = WEEKDAY_STRIP + weeks.length * ROW_HEIGHT

  const monthCells = (week: (string | null)[], key: string) => (
    <View key={key} style={styles.weekRow}>
      {week.map((iso, column) =>
        iso === null ? (
          <View key={column} style={styles.cell} />
        ) : (
          <DayCell
            key={iso}
            iso={iso}
            today={today}
            selected={selected}
            events={eventsOn(shown, iso)}
            variant={cell}
            locale={locale}
            onPress={pickDay}
          />
        ),
      )}
    </View>
  )

  const agenda = (
    <Agenda
      from={view === 'agenda' || nav === 'fluid' ? today : selected}
      today={today}
      events={shown}
      onOpen={openEdit}
      locale={locale}
    />
  )

  // No `GestureHandlerRootView` here: `app/_layout.tsx` already wraps the app
  // in one, and a nested root swallows gestures rather than adding any.
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t.labs.calendar.title,
          headerRight:
            nav === 'menu'
              ? () => (
                  <ViewMenu
                    view={view}
                    onView={changeView}
                    calendars={LAB_CALENDARS.map((calendar) => ({
                      id: calendar.id,
                      name: calendar.name,
                      shown: !hidden.includes(calendar.id),
                    }))}
                    onToggleCalendar={toggleCalendar}
                  />
                )
              : undefined,
        }}
      />

      <View style={[styles.fill, { backgroundColor: tokens.bg }]}>
        <PrototypeBanner />

        <View style={styles.titleRow}>
          <Text
            accessibilityRole="header"
            style={[styles.month, { color: tokens.fg }]}
          >
            {monthName}
            <Text style={{ color: tokens.muted, fontWeight: '400' }}>
              {` ${yearName}`}
            </Text>
          </Text>
          <Pressable
            testID="calendar-today"
            accessibilityRole="button"
            accessibilityLabel={t.labs.calendar.today}
            hitSlop={10}
            onPress={goToday}
          >
            <Text style={[styles.todayLink, { color: tint.fg }]}>
              {t.labs.calendar.today}
            </Text>
          </Pressable>
          <Pressable
            testID="calendar-new"
            accessibilityRole="button"
            accessibilityLabel={t.labs.calendar.newEvent}
            hitSlop={10}
            onPress={openNew}
          >
            <UI_ICONS.Plus size={23} color={tint.fg} strokeWidth={2.3} />
          </Pressable>
        </View>

        {nav === 'segmented' ? (
          <View style={styles.segmented}>
            <Segmented
              options={CALENDAR_VIEWS.map((id) => ({
                value: id,
                label: t.labs.calendar.views[id],
              }))}
              value={view}
              onChange={changeView}
            />
          </View>
        ) : null}

        {nav === 'fluid' ? (
          /* Month and week stop being two things you choose between and become
             one thing you drag. There is no view menu at all here — which is
             the disagreement worth putting on a device. */
          <View style={styles.fill}>
            <GestureDetector gesture={pan}>
              <View
                testID="calendar-fluid-header"
                accessibilityLabel={t.labs.calendar.dragHint}
                style={[
                  styles.header,
                  { height: headerHeight, backgroundColor: tokens.surface },
                ]}
              >
                <WeekdayHeader locale={locale} />
                <Animated.View style={gridSlide}>
                  {weeks.map((week, index) => monthCells(week, `w${index}`))}
                </Animated.View>
              </View>
            </GestureDetector>
            <Animated.View
              style={[
                styles.fluidBody,
                { top: WEEKDAY_STRIP, backgroundColor: tokens.bg },
                agendaSlide,
              ]}
            >
              <View
                style={[styles.grabRow, { backgroundColor: tokens.bg }]}
                pointerEvents="none"
              >
                <View
                  style={[styles.grabber, { backgroundColor: tokens.border }]}
                />
              </View>
              {agenda}
            </Animated.View>
          </View>
        ) : (
          <View style={styles.fill}>
            {view !== 'agenda' ? (
              <View
                style={[styles.header, { backgroundColor: tokens.surface }]}
              >
                <WeekdayHeader locale={locale} />
                {view === 'month'
                  ? weeks.map((week, index) => monthCells(week, `w${index}`))
                  : monthCells(selectedWeek, 'selected')}
                <View style={styles.monthNav}>
                  <Pressable
                    testID="calendar-previous-month"
                    accessibilityRole="button"
                    accessibilityLabel={t.labs.calendar.previousMonth}
                    hitSlop={12}
                    onPress={() => setMonth(shiftMonth(month, -1))}
                  >
                    <UI_ICONS.ChevronLeft
                      size={19}
                      color={tokens.muted}
                      strokeWidth={2.2}
                    />
                  </Pressable>
                  <View
                    style={[styles.grabber, { backgroundColor: tokens.border }]}
                  />
                  <Pressable
                    testID="calendar-next-month"
                    accessibilityRole="button"
                    accessibilityLabel={t.labs.calendar.nextMonth}
                    hitSlop={12}
                    onPress={() => setMonth(shiftMonth(month, 1))}
                  >
                    <UI_ICONS.ChevronRight
                      size={19}
                      color={tokens.muted}
                      strokeWidth={2.2}
                    />
                  </Pressable>
                </View>
              </View>
            ) : null}
            {/* Month shows the day you picked; week and agenda show what is
                coming. That is the only difference between the three bodies. */}
            {view === 'month' ? (
              <DayList
                iso={selected}
                today={today}
                events={eventsOn(shown, selected)}
                onOpen={openEdit}
                locale={locale}
              />
            ) : (
              agenda
            )}
          </View>
        )}

        <CalendarComposer
          variant={composer}
          draft={draft}
          selected={selected}
          today={today}
          locale={locale}
          onChange={applyDraft}
          onClose={() => setDraft(null)}
          onDelete={deleteEvent}
          onOpen={openNew}
          bottomInset={insets.bottom}
        />
      </View>
    </>
  )
}

/**
 * The view menu — iOS's `ellipsis.circle`, and a native menu behind it.
 *
 * It carries Calendars… as well as the three layouts, because a menu with one
 * section reads like a control that should have been a button.
 */
function ViewMenu({
  view,
  onView,
  calendars,
  onToggleCalendar,
}: {
  view: CalendarView
  onView: (next: CalendarView) => void
  calendars: { id: string; name: string; shown: boolean }[]
  onToggleCalendar: (id: string) => void
}) {
  const tokens = useTokens('home')
  const tint = tokens.tintOf('home')
  const { t } = useI18n()

  return (
    <MenuView
      testID="calendar-view-menu"
      actions={[
        {
          id: 'views',
          title: t.labs.calendar.title,
          displayInline: true,
          subactions: CALENDAR_VIEWS.map((id) => ({
            id: `view-${id}`,
            title: t.labs.calendar.views[id],
            state: view === id ? ('on' as const) : ('off' as const),
          })),
        },
        {
          id: 'calendars',
          title: t.labs.calendar.calendars,
          displayInline: true,
          subactions: calendars.map((calendar) => ({
            id: `calendar-${calendar.id}`,
            title: calendar.name,
            state: calendar.shown ? ('on' as const) : ('off' as const),
          })),
        },
      ]}
      onPressAction={({ nativeEvent }) => {
        const id = nativeEvent.event
        if (id.startsWith('view-')) {
          onView(id.slice('view-'.length) as CalendarView)
          return
        }
        if (id.startsWith('calendar-')) {
          haptics.selectionChanged()
          onToggleCalendar(id.slice('calendar-'.length))
        }
      }}
      shouldOpenOnLongPress={false}
    >
      <View
        accessibilityRole="button"
        accessibilityLabel={t.labs.calendar.viewMenu}
        style={styles.headerButton}
      >
        <UI_ICONS.CircleEllipsis size={23} color={tint.fg} strokeWidth={1.9} />
      </View>
    </MenuView>
  )
}

function WeekdayHeader({ locale }: { locale: string }) {
  const tokens = useTokens()
  return (
    <View style={styles.weekdays}>
      {Array.from({ length: 7 }, (_, index) =>
        // 1 January 2024 was a Monday, so the strip starts where the grid does.
        new Date(2024, 0, 1 + index).toLocaleDateString(locale, {
          weekday: 'narrow',
        }),
      ).map((name, index) => (
        <Text
          // Narrow weekday names repeat (T, T / S, S), so the index is the key.
          key={index}
          style={[styles.weekdayName, { color: tokens.muted }]}
        >
          {name.toUpperCase()}
        </Text>
      ))}
    </View>
  )
}

/**
 * One cell. Colour is the calendar; an initial is the person.
 *
 * `marks` is the canvas verdict: an initial in a tinted circle for each person
 * on an event, and a dot in the calendar's colour where nobody is on it — which
 * on the day this ships is every event, because `calendarEvents` has no
 * assignee column. `bars` is the rival that says how many and whose calendar,
 * and nothing at all about who.
 */
function DayCell({
  iso,
  today,
  selected,
  events,
  variant,
  locale,
  onPress,
}: {
  iso: string
  today: string
  selected: string
  events: LabEvent[]
  variant: CellVariant
  locale: string
  onPress: (iso: string) => void
}) {
  const tokens = useTokens('home')
  const tint = tokens.tintOf('home')
  const { t } = useI18n()
  const isToday = iso === today
  const isSelected = iso === selected
  const { marks, overflow } = cellMarks(events, LAB_MEMBERS)

  const spoken = [
    parseDay(iso).toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }),
    events.length === 0
      ? t.labs.calendar.nothingOn
      : events.every((event) => event.who.length === 0)
        ? t.labs.calendar.marksNobody
        : events.map((event) => event.title).join(', '),
  ].join(', ')

  return (
    <Pressable
      testID={`calendar-day-${iso}`}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={spoken}
      onPress={() => onPress(iso)}
      style={[
        styles.cell,
        isSelected && { backgroundColor: tokens.tile, borderColor: tint.fg },
      ]}
    >
      <View style={[styles.dayNumber, isToday && { backgroundColor: tint.fg }]}>
        <Text
          style={[
            styles.dayNumberText,
            { color: isToday ? tokens.surface : tokens.muted },
          ]}
        >
          {parseDay(iso).getDate()}
        </Text>
      </View>

      {variant === 'marks' ? (
        <View style={styles.marks}>
          {marks.map((mark) => {
            const calendar = LAB_CALENDARS.find(
              (each) => each.id === mark.calendarId,
            )
            const colours = tokens.tintOf(calendar?.tint ?? 'home')
            return mark.kind === 'nobody' ? (
              <View
                key={mark.key}
                style={[styles.dot, { backgroundColor: colours.fg }]}
              />
            ) : (
              <View
                key={mark.key}
                style={[styles.initial, { backgroundColor: colours.bg }]}
              >
                <Text style={[styles.initialText, { color: colours.fg }]}>
                  {mark.initial}
                </Text>
              </View>
            )
          })}
          {overflow > 0 ? (
            <Text style={[styles.overflow, { color: tokens.muted }]}>
              {`+${overflow}`}
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.bars}>
          {events.slice(0, 3).map((event) => {
            const calendar = LAB_CALENDARS.find(
              (each) => each.id === event.calendarId,
            )
            const colours = tokens.tintOf(calendar?.tint ?? 'home')
            return (
              <View
                key={event.id}
                style={[styles.bar, { backgroundColor: colours.fg }]}
              />
            )
          })}
          {events.length > 3 ? (
            <Text style={[styles.overflow, { color: tokens.muted }]}>
              {`+${events.length - 3}`}
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  )
}

/** What is on the day you picked. Month's body, and nothing else's. */
function DayList({
  iso,
  today,
  events,
  onOpen,
  locale,
}: {
  iso: string
  today: string
  events: LabEvent[]
  onOpen: (event: LabEvent) => void
  locale: string
}) {
  const tokens = useTokens()
  const { t } = useI18n()

  return (
    <ScrollView
      testID="calendar-day-list"
      style={{ backgroundColor: tokens.surface }}
      contentContainerStyle={styles.listContent}
    >
      <Text style={[styles.dayHeading, { color: tokens.muted }]}>
        {dayHeading(iso, today, locale, { today: t.labs.calendar.today })}
      </Text>
      {events.length === 0 ? (
        <Text style={[styles.empty, { color: tokens.muted }]}>
          {t.labs.calendar.nothingOn}
        </Text>
      ) : (
        events.map((event) => (
          <EventRow key={event.id} event={event} onOpen={onOpen} />
        ))
      )}
    </ScrollView>
  )
}

/**
 * What is coming. Week's body and Agenda's, which is the argument for keeping
 * both: they are the same list under two different amounts of month.
 */
function Agenda({
  from,
  today,
  events,
  onOpen,
  locale,
}: {
  from: string
  today: string
  events: LabEvent[]
  onOpen: (event: LabEvent) => void
  locale: string
}) {
  const tokens = useTokens()
  const { t } = useI18n()
  const rows = useMemo(() => agendaRows(events, from, 60), [events, from])

  return (
    <ScrollView
      testID="calendar-agenda"
      style={{ backgroundColor: tokens.bg }}
      contentContainerStyle={styles.listContent}
    >
      {rows.length === 0 ? (
        <Text style={[styles.empty, { color: tokens.muted }]}>
          {t.labs.calendar.nothingAhead}
        </Text>
      ) : null}
      {rows.map((row) =>
        row.kind === 'gap' ? (
          /* An empty week is a fact about the month, not a hole in the list.
             Saying so is what stops a gap reading as a bug. */
          <View key={row.key} style={styles.gap}>
            <Text style={[styles.gapText, { color: tokens.muted }]}>
              {t.labs.calendar.quietWeek}
            </Text>
          </View>
        ) : (
          <View key={row.key}>
            <Text style={[styles.dayHeading, { color: tokens.muted }]}>
              {dayHeading(row.iso, today, locale, {
                today: t.labs.calendar.today,
              })}
            </Text>
            {row.events.map((event) => (
              <EventRow key={event.id} event={event} onOpen={onOpen} />
            ))}
          </View>
        ),
      )}
    </ScrollView>
  )
}

function EventRow({
  event,
  onOpen,
}: {
  event: LabEvent
  onOpen: (event: LabEvent) => void
}) {
  const tokens = useTokens()
  const { t } = useI18n()
  const calendar = LAB_CALENDARS.find((each) => each.id === event.calendarId)
  const colours = tokens.tintOf(calendar?.tint ?? 'home')
  const when = timeLabel(event, t.labs.calendar.chips.allDay)

  return (
    <Pressable
      testID={`calendar-event-${event.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${when}`}
      onPress={() => onOpen(event)}
      style={({ pressed }) => [
        styles.eventRow,
        { borderBottomColor: tokens.border },
        pressed && { backgroundColor: tokens.tile },
      ]}
    >
      <View style={[styles.eventBar, { backgroundColor: colours.fg }]} />
      <Text style={[styles.eventTime, { color: tokens.muted }]}>{when}</Text>
      <Text numberOfLines={2} style={[styles.eventTitle, { color: tokens.fg }]}>
        {event.title}
      </Text>
      <View style={styles.eventWho}>
        {event.who.map((memberId) => {
          const member = LAB_MEMBERS.find((each) => each.id === memberId)
          return (
            <View
              key={memberId}
              style={[styles.whoRing, { borderColor: colours.fg }]}
            >
              <Text style={[styles.whoText, { color: colours.fg }]}>
                {member?.initial ?? '?'}
              </Text>
            </View>
          )
        })}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  headerButton: { paddingHorizontal: 6, paddingVertical: 6 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
  },
  month: { flex: 1, fontSize: 26, fontWeight: '800', letterSpacing: -0.7 },
  todayLink: { fontSize: 15.5, fontWeight: '600' },
  segmented: { paddingHorizontal: 16, paddingBottom: 10 },
  header: { paddingBottom: 2, overflow: 'hidden' },
  weekdays: {
    flexDirection: 'row',
    height: WEEKDAY_STRIP,
    paddingHorizontal: 8,
  },
  weekdayName: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  weekRow: { flexDirection: 'row', paddingHorizontal: 8 },
  cell: {
    flex: 1,
    height: ROW_HEIGHT,
    alignItems: 'center',
    paddingTop: 5,
    gap: 4,
    borderRadius: RADIUS.tile,
    borderWidth: 1.6,
    borderColor: 'transparent',
  },
  dayNumber: {
    width: 21,
    height: 21,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberText: { fontSize: 12.5, fontWeight: '600' },
  marks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  initial: {
    width: 19,
    height: 19,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialText: { fontSize: 10, fontWeight: '700' },
  overflow: { fontSize: 10, fontWeight: '700' },
  bars: { alignSelf: 'stretch', paddingHorizontal: 7, gap: 3 },
  bar: { height: 4, borderRadius: 2 },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    height: 26,
  },
  grabber: { width: 38, height: 4, borderRadius: 2 },
  grabRow: { height: 14, alignItems: 'center', justifyContent: 'center' },
  /**
   * Tall enough that the agenda never runs out of background as it slides, and
   * anchored off the bottom for the same reason. A `height: '100%'` here would
   * leave a strip of the grid showing under the list at full extension.
   */
  fluidBody: { position: 'absolute', left: 0, right: 0, bottom: -900, top: 0 },
  listContent: { paddingBottom: 160 },
  dayHeading: {
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 5,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  empty: { paddingHorizontal: 16, paddingVertical: 10, fontSize: 15 },
  gap: { paddingHorizontal: 16, paddingVertical: 18 },
  gapText: { fontSize: 13, fontStyle: 'italic' },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 54,
    marginHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  eventBar: {
    width: 3,
    alignSelf: 'stretch',
    marginVertical: 10,
    borderRadius: 2,
  },
  eventTime: { width: 52, fontSize: 12.5, fontWeight: '600' },
  eventTitle: { flex: 1, fontSize: 15.5, paddingVertical: 8 },
  eventWho: { flexDirection: 'row', gap: 3 },
  whoRing: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whoText: { fontSize: 11, fontWeight: '700' },
})
