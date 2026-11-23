/**
 * Adding an event from Calendar (APP-589): the add button, and the keyboard
 * composer it opens with an event's chips. The shell is
 * `ui/keyboard-composer.tsx`; this file is the event's part of it. Design:
 * `designs/tasks/quick-add_final.md`, "Event (APP-589)".
 *
 * - **Calendar, Date and Time always; the rest behind +.** Who (several, or
 *   everyone), Location and Note get a chip once set, and every one shows when
 *   the composer is expanded. Each chip is a native menu, so the keyboard
 *   stays up; a date or a time of your own is a wheel under the chips.
 * - **Saving keeps it open**, empty, on the calendar just used and the day it
 *   opened on. The draft's key goes with it as the idempotency key, so a second
 *   Return or a retry makes one event.
 * - **A failed save is asked about**, Try again or Discard; the draft comes
 *   back to the card when nothing was typed since. A saved or discarded draft
 *   is forgotten.
 * - **All details** hands the draft to `CalendarEditorSheet` and forgets it
 *   here: from then on it is that editor's draft.
 * - **A draft survives a close**, per account, Group and place, in memory
 *   (`ui/composer-drafts.ts`).
 */
import { useAuth } from '@clerk/expo'
import { DateTimePicker } from '@expo/ui/community/datetime-picker'
import type { MenuAction } from '@expo/ui/community/menu'
import type { CalendarColor, CalendarPerson } from '@gather/core/calendar'
import { addDays, localIsoDate } from '@gather/core/civil-date'
import { useMutation } from 'convex/react'
import { type ComponentRef, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { useAvailability } from '../../availability/AvailabilityProvider'
import { DateTimeWheel } from '../../components/DateTimeField'
import { api, type Id } from '../../convex/api'
import { haptics } from '../../feedback/haptics'
import { useGroup } from '../../group/GroupProvider'
import { fmt, useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, SPACE, TYPE, useTokens } from '../../theme/tokens'
import {
  draftKey,
  forgetSentDraft,
  keepDraft,
  keptDraft,
} from '../../ui/composer-drafts'
import {
  ComposerAddButton,
  type ComposerChip,
  KeyboardComposer,
} from '../../ui/keyboard-composer'
import { ModuleTile } from '../../ui/module-tile'
import {
  type ComposedEvent,
  composedEvent,
  defaultStart,
  type EventDraft,
  type EventPreset,
  emptyEventDraft,
  isEventDirty,
  nextEventDraft,
  presetCalendar,
  timedFrom,
  timeRangeLabel,
  whoLabel,
  withEnd,
  withStart,
} from './eventComposerDraft'

/** The iOS picker takes an underscore identifier; the app's locale is a language. */
const PICKER_LOCALE = { en: 'en_GB', nl: 'nl_NL' } as const

/**
 * The calendar each account last added to in each Group. Keyed like a draft,
 * on the Group's id.
 */
const lastCalendar = new Map<string, string>()

/**
 * Failed-save alerts, shown one after another: iOS draws one alert at a time,
 * so a second asked while the first is up would be lost with its draft.
 */
let alerts: Promise<void> = Promise.resolve()
function askInTurn(show: (done: () => void) => void): void {
  alerts = alerts.then(() => new Promise<void>((done) => show(done)))
}

export interface AddEventProps {
  calendars: { id: string; name: string; color?: CalendarColor }[]
  people: CalendarPerson[]
  /** The day the screen shows: the new event's date. */
  date: string
  /** Hides the add button while another editor is up. */
  hidden: boolean
  /**
   * Whether the composer is open. Owned by the screen, so the header's ⋯ menu
   * opens this same composer (APP-625) rather than a second one.
   */
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * All details: the full editor takes the draft (`taken`), the person stays
   * in the composer (`stay`), or goes back to the editor's own unsaved draft
   * (`resumed`, the composer's draft kept for later).
   */
  onAllDetails: (draft: EventDraft) => Promise<HandOver>
}

export type HandOver = 'taken' | 'stay' | 'resumed'

/** The add button on Calendar, and the composer while it is open. */
export function AddEvent({
  calendars,
  people,
  date,
  hidden,
  open,
  onOpenChange: setOpen,
  onAllDetails,
}: AddEventProps) {
  const { t } = useI18n()
  const { group } = useGroup()
  const { userId } = useAuth()
  const key = draftKey(userId, group._id, 'calendar:index')
  const lastKey = draftKey(userId, group._id, 'calendar')
  const preset: EventPreset = {
    calendarId: presetCalendar(calendars, lastCalendar.get(lastKey)),
    date,
  }

  return (
    <>
      {open || hidden ? null : (
        <ComposerAddButton
          group="home"
          label={t.composer.addEvent}
          onPress={() => setOpen(true)}
          testID="add-event"
        />
      )}
      {open ? (
        <EventComposerCard
          draftId={key}
          preset={preset}
          calendars={calendars}
          people={people}
          onCalendarUsed={(id) => lastCalendar.set(lastKey, id)}
          onClose={() => setOpen(false)}
          onAllDetails={(draft) => {
            // Kept until the editor has it: a draft is never only in flight.
            keepDraft(key, draft)
            Keyboard.dismiss()
            setOpen(false)
            void onAllDetails(draft).then((outcome) => {
              if (outcome === 'taken') forgetSentDraft<EventDraft>(key, draft.saveKey)
              if (outcome === 'stay') setOpen(true)
            })
          }}
        />
      ) : null}
    </>
  )
}

type Panel = 'date' | 'time' | 'location' | null

function EventComposerCard({
  draftId,
  preset,
  calendars,
  people,
  onCalendarUsed,
  onClose,
  onAllDetails,
}: {
  draftId: string
  preset: EventPreset
  calendars: AddEventProps['calendars']
  people: CalendarPerson[]
  onCalendarUsed: (calendarId: string) => void
  onClose: () => void
  onAllDetails: (draft: EventDraft) => void
}) {
  const { t, locale } = useI18n()
  const words = t.composer
  const calendarWords = t.calendar
  const { group } = useGroup()
  const addEvent = useMutation(api.calendar.addCalendarEvent)
  const { serviceActionsEnabled } = useAvailability()

  const [kept] = useState(
    () => keptDraft<EventDraft>(draftId) ?? emptyEventDraft(preset),
  )
  const [draft, setDraft] = useState<EventDraft>(kept)
  const [panel, setPanel] = useState<Panel>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // The draft last sent: a second Return before the cleared draft renders
  // reaches save with the same draft. The server dedupes on the key as well.
  const submitted = useRef<string | null>(null)
  const mounted = useRef(true)
  // Handed to All details: that editor keeps it now, not this place.
  const handedOver = useRef(false)

  const latest = useRef(draft)
  latest.current = draft
  // The place is fixed for the card's life; read at unmount, not tracked.
  const place = useRef({ draftId, preset })
  useEffect(
    () => () => {
      mounted.current = false
      if (handedOver.current) return
      const { draftId: key, preset: base } = place.current
      const last = latest.current
      keepDraft(key, isEventDirty(last, base) ? last : undefined)
    },
    [],
  )

  // The calendar it opened on was deleted, or none had loaded yet.
  const calendar = calendars.find((each) => each.id === draft.calendarId)
  useEffect(() => {
    if (!calendar && preset.calendarId)
      setDraft((current) => ({ ...current, calendarId: preset.calendarId }))
  }, [calendar, preset.calendarId])

  const change = (patch: Partial<EventDraft>) => {
    setNotice(null)
    setDraft((current) => ({ ...current, ...patch }))
  }
  const pick = (patch: Partial<EventDraft>) => {
    haptics.selectionChanged()
    change(patch)
  }

  const load = (next: EventDraft) => {
    latest.current = next
    setDraft(next)
  }
  const clear = () => {
    setNotice(null)
    load(nextEventDraft(latest.current, place.current.preset))
  }

  const event = composedEvent(draft)

  const send = (saving: ComposedEvent, saveKey: string) =>
    addEvent({
      groupSlug: group.slug,
      calendarId: saving.calendarId as Id<'calendars'>,
      title: saving.title,
      date: saving.date,
      allDay: saving.allDay,
      startMinutes: saving.startMinutes ?? undefined,
      endMinutes: saving.endMinutes ?? undefined,
      assigneeIds: saving.assigneeIds as Id<'users'>[],
      location: saving.location || undefined,
      notes: saving.notes || undefined,
      idempotencyKey: saveKey,
    })

  const landed = (saving: ComposedEvent, saveKey: string) => {
    // A close mid-save may have kept this draft for the place.
    forgetSentDraft<EventDraft>(place.current.draftId, saveKey)
    onCalendarUsed(saving.calendarId)
    haptics.itemSaved()
  }

  /**
   * A save that failed once the composer had moved on to the next event, or
   * closed: asked about, Try again or Discard, one alert at a time, and never
   * poured over what is being typed now. The same key goes again, so a create
   * that did land is not made twice.
   */
  const offerRetry = (saving: ComposedEvent, saveKey: string) =>
    askInTurn((done) =>
      Alert.alert(
        fmt(words.eventNotSaved, { title: saving.title }),
        undefined,
        [
          {
            text: words.discard,
            style: 'destructive',
            onPress: () => {
              forgetSentDraft<EventDraft>(place.current.draftId, saveKey)
              done()
            },
          },
          {
            text: words.tryAgain,
            onPress: () => {
              done()
              void send(saving, saveKey).then(
                () => landed(saving, saveKey),
                () => {
                  haptics.actionFailed()
                  offerRetry(saving, saveKey)
                },
              )
            },
          },
        ],
        { cancelable: false },
      ),
    )

  async function save() {
    if (!event) {
      haptics.actionFailed()
      return
    }
    if (submitted.current === draft.saveKey) return
    if (!serviceActionsEnabled) {
      // Not sent: a queued write would clear the card with no word of it.
      haptics.actionFailed()
      setNotice(calendarWords.errors.offline)
      return
    }
    const snapshot = draft
    const saving = event
    const { saveKey } = snapshot
    submitted.current = saveKey
    const request = send(saving, saveKey)
    setPanel(null)
    // Cleared first: the next event can be typed at once.
    clear()
    try {
      await request
      landed(saving, saveKey)
    } catch {
      haptics.actionFailed()
      submitted.current = null
      const base = place.current.preset
      if (mounted.current && !isEventDirty(latest.current, base)) {
        // Nothing typed since: the event comes back to finish or send again.
        setNotice(words.eventFailed)
        load(snapshot)
      } else {
        offerRetry(saving, saveKey)
      }
    }
  }

  const allDetails = () => {
    handedOver.current = true
    onAllDetails(latest.current)
  }

  // ---------------------------------------------------------------- menus

  const today = localIsoDate()
  const removeGroup = (id: string): MenuAction => ({
    id: `${id}:remove-group`,
    title: '',
    displayInline: true,
    subactions: [
      { id: `${id}:remove`, title: words.remove, attributes: { destructive: true } },
    ],
  })

  const calendarMenu: MenuAction[] = calendars.map((each) => ({
    id: `calendar:${each.id}`,
    title: each.name,
    state: each.id === draft.calendarId ? 'on' : 'off',
  }))

  const tomorrow = addDays(today, 1)
  const dateMenu: MenuAction[] = [
    {
      id: 'date:today',
      title: t.calendar.today,
      image: 'sun.max',
      state: draft.date === today ? 'on' : 'off',
    },
    {
      id: 'date:tomorrow',
      title: t.tasks.task.tomorrow,
      image: 'sunrise',
      state: draft.date === tomorrow ? 'on' : 'off',
    },
    { id: 'date:pick', title: words.date.pick, image: 'calendar' },
  ]

  const timed = draft.time && !draft.time.allDay ? draft.time : null
  const timeMenu: MenuAction[] = [
    {
      id: 'time:allDay',
      title: calendarWords.allDay,
      image: 'sun.max',
      state: draft.time?.allDay ? 'on' : 'off',
    },
    {
      id: 'time:pick',
      title: words.time.pick,
      image: 'clock',
      state: timed ? 'on' : 'off',
    },
    ...(draft.time ? [removeGroup('time')] : []),
  ]

  const everyoneChosen =
    people.length > 0 && people.every((p) => draft.assigneeIds.includes(p.id))
  const whoMenu: MenuAction[] = [
    ...(people.length > 1
      ? [
          {
            id: 'who:everyone',
            title: calendarWords.everyone,
            state: everyoneChosen ? ('on' as const) : ('off' as const),
          },
        ]
      : []),
    ...people.map((person) => ({
      id: `who:${person.id}`,
      title: person.name,
      state: draft.assigneeIds.includes(person.id)
        ? ('on' as const)
        : ('off' as const),
    })),
    ...(draft.assigneeIds.length > 0 ? [removeGroup('who')] : []),
  ]

  const locationMenu: MenuAction[] = [
    { id: 'location:edit', title: calendarWords.locationPlaceholder, image: 'mappin' },
    ...(draft.location.trim() ? [removeGroup('location')] : []),
  ]

  const askLocation = () => {
    if (Platform.OS !== 'ios') {
      setPanel('location')
      return
    }
    Alert.prompt(
      calendarWords.location,
      undefined,
      [
        { text: t.common.actions.cancel, style: 'cancel' },
        {
          text: t.common.actions.save,
          onPress: (value?: string) => pick({ location: (value ?? '').trim() }),
        },
      ],
      'plain-text',
      draft.location,
    )
  }

  const onMenu = (id: string) => {
    const at = id.indexOf(':')
    const chip = at === -1 ? id : id.slice(0, at)
    const value = at === -1 ? '' : id.slice(at + 1)
    switch (chip) {
      case 'calendar':
        pick({ calendarId: value })
        return
      case 'date':
        if (value === 'pick') setPanel('date')
        else pick({ date: value === 'tomorrow' ? tomorrow : today })
        return
      case 'time':
        if (value === 'allDay') pick({ time: { allDay: true } })
        else if (value === 'remove') pick({ time: null })
        else if (value === 'pick') {
          if (!timed) change({ time: timedFrom(defaultStart(draft.date, today, new Date())) })
          setPanel('time')
        }
        return
      case 'who':
        if (value === 'remove') pick({ assigneeIds: [] })
        else if (value === 'everyone')
          pick({ assigneeIds: everyoneChosen ? [] : people.map((p) => p.id) })
        else
          pick({
            assigneeIds: draft.assigneeIds.includes(value)
              ? draft.assigneeIds.filter((each) => each !== value)
              : [...draft.assigneeIds, value],
          })
        return
      case 'location':
        if (value === 'remove') pick({ location: '' })
        else askLocation()
        return
      case 'more':
        if (value === 'notes') change({ showNotes: !draft.showNotes })
        else if (value === 'location') askLocation()
        else if (value === 'all') allDetails()
        return
    }
  }

  // ---------------------------------------------------------------- chips

  const named = (name: string, value?: string | null) =>
    value ? `${name}: ${value}` : name
  const dayLabel =
    draft.date === today
      ? t.calendar.today
      : draft.date === tomorrow
        ? t.tasks.task.tomorrow
        : new Date(`${draft.date}T12:00:00`).toLocaleDateString(locale, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })
  const timeText = draft.time
    ? draft.time.allDay
      ? calendarWords.allDay
      : timeRangeLabel(draft.time.start, draft.time.end)
    : null
  const whoText = whoLabel(draft.assigneeIds, people, {
    who: calendarWords.who,
    everyone: calendarWords.everyone,
  })
  const locationText = draft.location.trim() || null
  const notesSet = draft.showNotes || Boolean(draft.notes.trim())

  const calendarChip: ComposerChip | null = calendar
    ? {
        id: 'calendar',
        label: calendar.name,
        accessibilityLabel: named(calendarWords.calendar, calendar.name),
        set: false,
        leading: (
          <ModuleTile
            group={calendar.color ?? 'home'}
            glyph={UI_ICONS.Calendar}
            size="xs"
          />
        ),
        menu: calendarMenu,
        onMenu,
        testID: 'event-composer-calendar',
      }
    : null

  const details: (ComposerChip & { always?: boolean })[] = [
    {
      id: 'date',
      always: true,
      label: dayLabel,
      accessibilityLabel: named(calendarWords.date, dayLabel),
      // Always a day, and the place chose it: set only once moved off it.
      set: draft.date !== preset.date,
      icon: UI_ICONS.Calendar,
      menu: dateMenu,
      onMenu,
      testID: 'event-composer-date',
    },
    {
      id: 'time',
      always: true,
      label: timeText ?? calendarWords.time,
      accessibilityLabel: named(calendarWords.time, timeText),
      set: Boolean(timeText),
      icon: UI_ICONS.Clock,
      menu: timeMenu,
      onMenu,
      testID: 'event-composer-time',
    },
    {
      id: 'who',
      label: whoText ?? calendarWords.who,
      accessibilityLabel: named(calendarWords.who, whoText),
      set: Boolean(whoText),
      icon: UI_ICONS.Users,
      menu: whoMenu,
      onMenu,
      testID: 'event-composer-who',
    },
    {
      id: 'location',
      label: locationText ?? calendarWords.location,
      accessibilityLabel: named(calendarWords.location, locationText),
      set: Boolean(locationText),
      icon: UI_ICONS.MapPin,
      menu: locationMenu,
      onMenu,
      testID: 'event-composer-location',
    },
  ]
  const head = calendarChip ? [calendarChip] : []
  const chips = [...head, ...details.filter((chip) => chip.always || chip.set)]
  const allChips = [...head, ...details]

  const moreActions: MenuAction[] = [
    {
      id: 'more:who',
      title: calendarWords.who,
      image: 'person.2',
      state: whoText ? 'on' : 'off',
      subactions: whoMenu,
    },
    {
      id: 'more:location',
      title: calendarWords.location,
      image: 'mappin',
      state: locationText ? 'on' : 'off',
    },
    {
      id: 'more:notes',
      title: words.eventNote,
      image: 'text.alignleft',
      state: notesSet ? 'on' : 'off',
    },
    {
      id: 'more:end',
      title: '',
      displayInline: true,
      subactions: [
        { id: 'more:all', title: words.allDetails, image: 'arrow.up.forward.square' },
      ],
    },
  ]

  // ---------------------------------------------------------------- panels

  const panelView =
    panel === 'date' ? (
      <PickerPanel onDone={() => setPanel(null)}>
        <DateTimeWheel
          mode="date"
          value={new Date(`${draft.date}T12:00:00`)}
          onChange={(next) => pick({ date: localIsoDate(next) })}
          onClose={() => setPanel(null)}
        />
      </PickerPanel>
    ) : panel === 'time' && timed ? (
      <TimePanel
        date={draft.date}
        start={timed.start}
        end={timed.end}
        onStart={(start) => change({ time: withStart(draft.time, start) })}
        onEnd={(end) => change({ time: withEnd(draft.time, end) })}
        onDone={() => setPanel(null)}
      />
    ) : panel === 'location' ? (
      <LocationPanel
        value={draft.location}
        onDone={(value) => {
          pick({ location: value.trim() })
          setPanel(null)
        }}
      />
    ) : null

  return (
    <KeyboardComposer
      testID="event-keyboard-composer"
      group="home"
      onClose={onClose}
      renderTitle={(field) => (
        <TextInput
          testID="event-composer-title"
          ref={field.inputRef}
          editable={field.editable}
          autoFocus
          value={draft.title}
          onChangeText={(title) => change({ title })}
          placeholder={words.eventTitle}
          placeholderTextColor={field.placeholderTextColor}
          accessibilityLabel={calendarWords.title}
          returnKeyType="done"
          submitBehavior="submit"
          onSubmitEditing={field.onSubmitEditing}
          style={field.style}
        />
      )}
      body={{
        value: draft.notes,
        onChange: (notes) => change({ notes }),
        visible: notesSet,
        placeholder: words.eventBody,
        accessibilityLabel: words.eventNote,
      }}
      chips={chips}
      allChips={allChips}
      more={{ actions: moreActions, onPress: onMenu }}
      canSave={event !== null}
      onSave={() => void save()}
      notice={notice}
      panel={panelView}
    />
  )
}

/** A wheel in the keyboard's place, with Done to bring the keyboard back. */
function PickerPanel({
  children,
  onDone,
}: {
  children: React.ReactNode
  onDone: () => void
}) {
  const { t } = useI18n()
  const tokens = useTokens('home')
  // Android's picker is a dialog that reports its own close.
  if (Platform.OS !== 'ios') return <>{children}</>
  return (
    <View style={styles.panel}>
      {children}
      <Pressable
        testID="event-composer-done"
        accessibilityRole="button"
        accessibilityLabel={t.actions.done}
        onPress={onDone}
        hitSlop={12}
        style={({ pressed }) => [styles.done, pressed && styles.pressed]}
      >
        <Text style={[styles.doneText, { color: tokens.accentText }]}>
          {t.actions.done}
        </Text>
      </Pressable>
    </View>
  )
}

function clockDate(date: string, minutes: number): Date {
  const at = new Date(`${date}T00:00:00`)
  at.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return at
}

const minutesOf = (date: Date) => date.getHours() * 60 + date.getMinutes()

/**
 * Kies tijd…: a start and an end. On iOS two wheels side by side, set as they
 * turn; on Android the system dialog, the start and then the end.
 */
function TimePanel({
  date,
  start,
  end,
  onStart,
  onEnd,
  onDone,
}: {
  date: string
  start: number
  end: number
  onStart: (minutes: number) => void
  onEnd: (minutes: number) => void
  onDone: () => void
}) {
  const { t, locale } = useI18n()
  const tokens = useTokens('home')
  const [androidStep, setAndroidStep] = useState<'start' | 'end'>('start')
  // Android reports a close before the value it closed on, and a close alone
  // for Cancel or Back: the start dialog moves on to End or closes the panel.
  const startPicked = useRef(false)

  if (Platform.OS !== 'ios') {
    return androidStep === 'start' ? (
      <DateTimeWheel
        mode="time"
        value={clockDate(date, start)}
        onChange={(next) => {
          startPicked.current = true
          onStart(minutesOf(next))
          setAndroidStep('end')
        }}
        onClose={() =>
          setTimeout(() => {
            if (!startPicked.current) onDone()
          }, 0)
        }
      />
    ) : (
      <DateTimeWheel
        mode="time"
        value={clockDate(date, end)}
        onChange={(next) => onEnd(minutesOf(next))}
        onClose={onDone}
      />
    )
  }

  const wheel = (
    label: string,
    minutes: number,
    onChange: (minutes: number) => void,
    testID: string,
  ) => (
    <View style={styles.wheel}>
      <Text style={[styles.wheelLabel, { color: tokens.muted }]}>{label}</Text>
      <DateTimePicker
        testID={testID}
        value={clockDate(date, minutes)}
        mode="time"
        display="spinner"
        locale={PICKER_LOCALE[locale]}
        accentColor={tokens.ink}
        onValueChange={(_, next) => onChange(minutesOf(next))}
      />
    </View>
  )

  return (
    <PickerPanel onDone={onDone}>
      <View style={styles.wheels}>
        {wheel(t.calendar.startTime, start, onStart, 'event-composer-start')}
        {wheel(t.calendar.endTime, end, onEnd, 'event-composer-end')}
      </View>
    </PickerPanel>
  )
}

/**
 * Location on Android, where there is no text alert: a line under the chips
 * that takes the keyboard back, set on Done.
 */
function LocationPanel({
  value,
  onDone,
}: {
  value: string
  onDone: (value: string) => void
}) {
  const { t } = useI18n()
  const tokens = useTokens('home')
  const [text, setText] = useState(value)
  const ref = useRef<ComponentRef<typeof TextInput>>(null)
  useEffect(() => {
    // After the shell has lowered the keyboard for the panel.
    const timer = setTimeout(() => ref.current?.focus(), 250)
    return () => clearTimeout(timer)
  }, [])
  return (
    <TextInput
      ref={ref}
      testID="event-composer-location-input"
      value={text}
      onChangeText={setText}
      placeholder={t.calendar.locationPlaceholder}
      placeholderTextColor={tokens.muted}
      accessibilityLabel={t.calendar.location}
      returnKeyType="done"
      onSubmitEditing={() => onDone(text)}
      onBlur={() => onDone(text)}
      style={[
        styles.location,
        { color: tokens.ink, backgroundColor: tokens.surface2 },
      ]}
    />
  )
}

const styles = StyleSheet.create({
  panel: { alignSelf: 'stretch' },
  wheels: { flexDirection: 'row', gap: SPACE[2] },
  wheel: { flex: 1, alignItems: 'stretch' },
  wheelLabel: { ...TYPE.footnote, textAlign: 'center' },
  done: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' },
  doneText: { ...TYPE.bodyStrong },
  location: {
    ...TYPE.body,
    minHeight: 44,
    paddingHorizontal: SPACE[3],
    borderRadius: RADIUS.pill,
  },
  pressed: { opacity: 0.6 },
})
