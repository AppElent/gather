/**
 * Adding an event, three ways.
 *
 * The canvas chose the card and argued it well: **the name field first and
 * largest**, everything else a 44pt chip, a round button that commits a create
 * and only dismisses an edit, and the whole thing floating immediately above
 * where the keyboard lands so it can only ever grow *upward*. What a drawing
 * could not settle is whether the card actually clears the keyboard on a real
 * device, which is the first thing to look at here.
 *
 * The two rivals are not strawmen. `sheet` is the house style — every other
 * property in this app is edited in a `NativeSheet`, and the card being the one
 * exception needs an argument. `inline` is the Tasks list's own composer: one
 * line, return commits, everything else set afterwards by opening what you just
 * made.
 *
 * Two rules that hold across all three:
 *
 * - **A dismissed draft keeps what you typed.** The scrim is tappable and the
 *   card goes away; a draft that vanishes with it is the failure mode.
 * - **Nothing is written anywhere.** `onChange` mutates a `useState` array on
 *   the screen above and that is the entire persistence story.
 */
import { useEffect, useRef, useState } from 'react'
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
} from 'react-native-reanimated'

import { MonthGridView, WeekdayStrip } from '../../components/MonthGridView'
import { NativeContextMenu } from '../../components/NativeContextMenu'
import { NativeSheet } from '../../components/NativeSheet'
import { haptics } from '../../feedback/haptics'
import { fmt, useI18n } from '../../i18n'
import {
  addDays,
  monthGrid,
  monthOf,
  parseDay,
  shiftMonth,
  weekendFrom,
} from '../../modules/tasks/taskDates'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, useTokens } from '../../theme/tokens'
import type { ComposerVariant } from './axes'
import { LAB_CALENDARS, LAB_MEMBERS } from './fixtures'

/**
 * What is being composed. `mode` is the whole difference between the two jobs
 * the one card does: a create needs a commit, an edit does not.
 */
export type RepeatRule = 'never' | 'daily' | 'weekly' | 'monthly'

export interface Draft {
  mode: 'create' | 'edit'
  id?: string
  date: string
  title: string
  calendarId: string
  who: string[]
  allDay: boolean
  start?: string
  end?: string
  where?: string
  notes?: string
  repeats?: RepeatRule
}

export interface CalendarComposerProps {
  variant: ComposerVariant
  draft: Draft | null
  /** The day a new event lands on when nothing else says otherwise. */
  selected: string
  today: string
  locale: string
  onChange: (draft: Draft) => void
  onClose: () => void
  onDelete: (id: string) => void
  onDuplicate: (draft: Draft) => void
  /** The inline variant has no trigger of its own; it *is* the trigger. */
  onOpen: () => void
  bottomInset: number
}

export function CalendarComposer(props: CalendarComposerProps) {
  if (props.variant === 'inline') return <InlineComposer {...props} />
  if (props.draft === null) return null
  if (props.variant === 'sheet') return <SheetComposer {...props} />
  return <CardComposer {...props} />
}

/* ══ the card ═══════════════════════════════════════════════════════════ */

/**
 * What the `[+]` hides: the long tail, including where recurrence lands.
 *
 * Every one of these is a real pane. A chip that answers a tap with a haptic
 * and nothing else is worse than no chip — it teaches the reader that the row
 * is decoration, and then they stop trying the ones that work.
 */
type Pane = 'none' | 'date' | 'more' | 'time' | 'where' | 'notes'

function CardComposer({
  draft,
  today,
  locale,
  onChange,
  onClose,
  onDelete,
  onDuplicate,
  bottomInset,
}: CalendarComposerProps) {
  const tokens = useTokens('home')
  const tint = tokens.tintOf('home')
  const { t } = useI18n()
  const [local, setLocal] = useState<Draft>(draft as Draft)
  const [pane, setPane] = useState<Pane>('none')
  const [month, setMonth] = useState(() => monthOf((draft as Draft).date))

  /**
   * The real keyboard's height, on the UI thread. This is the whole reason the
   * card is worth putting on a device: a drawing can only assume 336 points,
   * and a phone knows. Reanimated also takes the window out of `adjustResize`
   * for as long as this hook is mounted, so nothing under the card reflows —
   * the card is the only thing that moves.
   */
  const keyboard = useAnimatedKeyboard()

  /**
   * The card gives the keyboard up to show the date grid and takes it straight
   * back afterwards. Without this the card is left sitting on the home bar with
   * the caret gone — you picked a date and the composer read as finished, which
   * is the opposite of what a create is.
   */
  const nameRef = useRef<TextInput>(null)
  /**
   * `blur()`, not `Keyboard.dismiss()`: dismiss hides the keyboard and leaves
   * the field focused, and a `focus()` on an already-focused field is a no-op —
   * so the keyboard never came back and the card stayed on the home bar.
   */
  const openPane = (next: Pane) => {
    nameRef.current?.blur()
    setPane(next)
  }
  const openDatePane = () => openPane('date')
  const resume = () => {
    setPane('none')
    // One frame, so the field is focused after the pane has gone rather than
    // while the card is still the taller of the two.
    requestAnimationFrame(() => nameRef.current?.focus())
  }

  /** A pane that needed the keyboard's room is a card that sits on the bar. */
  const dropped = pane === 'date' || pane === 'time'
  const cardStyle = useAnimatedStyle(() => ({
    // `translateY`, not `bottom`: the card is anchored at the bottom edge and
    // lifted, so the keyboard does not cost a layout pass a frame.
    //
    // A picker dismisses the keyboard, so the space the card was avoiding is no
    // longer there and it drops to sit above the home bar instead.
    transform: [
      { translateY: dropped ? -bottomInset : -keyboard.height.value },
    ],
  }))

  const ready = local.title.trim().length > 0

  /** An edit applies live; a create is held until the button. */
  const edit = (patch: Partial<Draft>) => {
    const next = { ...local, ...patch }
    setLocal(next)
    if (next.mode === 'edit') onChange(next)
  }

  const commit = () => {
    if (local.mode === 'edit') {
      onClose()
      return
    }
    if (!ready) {
      haptics.actionFailed()
      return
    }
    onChange(local)
    onClose()
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable
        testID="composer-scrim"
        accessibilityRole="button"
        accessibilityLabel={t.actions.close}
        onPress={onClose}
        style={[StyleSheet.absoluteFill, styles.scrim]}
      />
      <Animated.View
        testID="composer-card"
        style={[styles.card, { backgroundColor: tokens.surface }, cardStyle]}
      >
        <View style={styles.cardTitleRow}>
          <TextInput
            testID="composer-name"
            ref={nameRef}
            autoFocus
            value={local.title}
            onChangeText={(title) => edit({ title })}
            placeholder={t.labs.calendar.namePlaceholder}
            placeholderTextColor={tokens.muted}
            selectionColor={tint.fg}
            returnKeyType="done"
            onSubmitEditing={commit}
            style={[styles.nameField, { color: tokens.fg }]}
          />
          {local.mode === 'edit' && local.id ? (
            <NativeContextMenu
              trigger="press"
              actions={[
                { id: 'duplicate', title: t.labs.calendar.duplicate },
                {
                  id: 'delete',
                  title: t.labs.calendar.deleteEvent,
                  attributes: { destructive: true },
                },
              ]}
              onAction={(action) => {
                if (action === 'duplicate') {
                  onDuplicate(local)
                  onClose()
                  return
                }
                if (action !== 'delete' || !local.id) return
                onDelete(local.id)
                onClose()
              }}
            >
              <View
                accessibilityRole="button"
                accessibilityLabel={t.labs.calendar.chips.more}
                style={styles.cardMore}
              >
                <UI_ICONS.CircleEllipsis
                  size={23}
                  color={tokens.muted}
                  strokeWidth={1.9}
                />
              </View>
            </NativeContextMenu>
          ) : null}
        </View>

        {pane === 'date' ? (
          <DatePane
            value={local.date}
            today={today}
            locale={locale}
            month={month}
            onMonth={setMonth}
            onPick={(date) => {
              edit({ date })
              resume()
            }}
            onDone={resume}
          />
        ) : null}

        {pane === 'time' ? (
          <TimePane
            start={local.start}
            end={local.end}
            onPick={(start, end) => edit({ start, end, allDay: false })}
          />
        ) : null}

        {pane === 'where' || pane === 'notes' ? (
          <TextPane
            key={pane}
            value={(pane === 'where' ? local.where : local.notes) ?? ''}
            placeholder={
              pane === 'where'
                ? t.labs.calendar.wherePlaceholder
                : t.labs.calendar.notesPlaceholder
            }
            multiline={pane === 'notes'}
            testID={`composer-field-${pane}`}
            onChange={(value) =>
              edit(pane === 'where' ? { where: value } : { notes: value })
            }
          />
        ) : null}

        {pane === 'more' ? (
          <View style={styles.moreRow}>
            <Chip
              testID="composer-chip-allDay"
              label={t.labs.calendar.chips.allDay}
              dashed={!local.allDay}
              set={local.allDay}
              onPress={() =>
                edit({
                  allDay: !local.allDay,
                  start: undefined,
                  end: undefined,
                })
              }
            />
            <Chip
              testID="composer-chip-where"
              label={local.where?.trim() || t.labs.calendar.chips.where}
              icon="MapPin"
              dashed={!local.where}
              set={Boolean(local.where)}
              active={false}
              onPress={() => setPane('where')}
            />
            <Chip
              testID="composer-chip-notes"
              label={local.notes?.trim() || t.labs.calendar.chips.notes}
              dashed={!local.notes}
              set={Boolean(local.notes)}
              onPress={() => setPane('notes')}
            />
            <RepeatChip
              value={local.repeats ?? 'never'}
              onPick={(repeats) => edit({ repeats })}
            />
          </View>
        ) : null}

        <View style={styles.chipRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            contentContainerStyle={styles.chips}
          >
            <Pressable
              testID="composer-more"
              accessibilityRole="button"
              accessibilityLabel={t.labs.calendar.chips.more}
              onPress={() => setPane(pane === 'more' ? 'none' : 'more')}
              style={[styles.roundChip, { backgroundColor: tokens.tile }]}
            >
              <UI_ICONS.Plus size={20} color={tokens.muted} strokeWidth={2.2} />
            </Pressable>

            <CalendarChip
              calendarId={local.calendarId}
              onPick={(calendarId) => edit({ calendarId })}
            />

            <Chip
              testID="composer-date"
              label={parseDay(local.date).toLocaleDateString(locale, {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
              set
              active={pane === 'date'}
              onPress={() => (pane === 'date' ? resume() : openDatePane())}
            />

            <Chip
              testID="composer-time"
              label={
                local.allDay
                  ? t.labs.calendar.chips.allDay
                  : local.start
                    ? `${local.start}${local.end ? `–${local.end}` : ''}`
                    : t.labs.calendar.chips.time
              }
              icon="Clock"
              dashed={!local.start && !local.allDay}
              set={Boolean(local.start) || local.allDay}
              active={pane === 'time'}
              onPress={() => (pane === 'time' ? resume() : openPane('time'))}
            />

            <WhoChip who={local.who} onChange={(who) => edit({ who })} />
          </ScrollView>

          <Pressable
            testID="composer-commit"
            accessibilityRole="button"
            accessibilityState={{ disabled: local.mode === 'create' && !ready }}
            accessibilityLabel={
              local.mode === 'edit'
                ? t.labs.calendar.dismiss
                : t.labs.calendar.commit
            }
            onPress={commit}
            style={[
              styles.commit,
              {
                // Grey until the name has a character in it, so a half-typed
                // event never reaches the household calendar.
                backgroundColor:
                  local.mode === 'edit' || ready ? tint.fg : tokens.tile,
              },
            ]}
          >
            {local.mode === 'edit' ? (
              <UI_ICONS.Check
                size={21}
                color={tokens.surface}
                strokeWidth={2.8}
              />
            ) : (
              <UI_ICONS.ArrowUp
                size={21}
                color={ready ? tokens.surface : tokens.muted}
                strokeWidth={2.6}
              />
            )}
          </Pressable>
        </View>

        <Text style={[styles.footnote, { color: tokens.muted }]}>
          {t.labs.calendar.notSaved}
        </Text>
      </Animated.View>
    </View>
  )
}

/**
 * The picker, inside the card: `DueDateSheet`'s shortcuts over `MonthGridView`.
 *
 * Adopted rather than redrawn — a second month grid in this repo would be a bug
 * and not a variation, which is why the drawing moved to
 * `components/MonthGridView.tsx` and both callers point at it.
 */
function DatePane({
  value,
  today,
  locale,
  month,
  onMonth,
  onPick,
  onDone,
}: {
  value: string
  today: string
  locale: string
  month: { year: number; month: number }
  onMonth: (next: { year: number; month: number }) => void
  onPick: (iso: string) => void
  onDone: () => void
}) {
  const tokens = useTokens('home')
  const tint = tokens.tintOf('home')
  const { t } = useI18n()
  const grid = monthGrid(month.year, month.month)

  const shortcuts = [
    { id: 'today', label: t.labs.calendar.todayShort, iso: today },
    { id: 'tomorrow', label: t.labs.calendar.tomorrow, iso: addDays(today, 1) },
    { id: 'weekend', label: t.labs.calendar.weekend, iso: weekendFrom(today) },
  ]

  return (
    <View>
      <View style={styles.shortcuts}>
        {shortcuts.map((shortcut) => (
          <Pressable
            key={shortcut.id}
            testID={`composer-date-${shortcut.id}`}
            accessibilityRole="button"
            accessibilityLabel={shortcut.label}
            onPress={() => onPick(shortcut.iso)}
            style={({ pressed }) => [
              styles.shortcut,
              { borderColor: tokens.border },
              pressed && { backgroundColor: tokens.tile },
            ]}
          >
            <Text style={[styles.shortcutText, { color: tokens.fg }]}>
              {shortcut.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.monthBar}>
        <Pressable
          testID="composer-previous-month"
          accessibilityRole="button"
          accessibilityLabel={t.labs.calendar.previousMonth}
          hitSlop={12}
          onPress={() => onMonth(shiftMonth(month, -1))}
        >
          <UI_ICONS.ChevronLeft size={20} color={tokens.fg} strokeWidth={2.2} />
        </Pressable>
        <Text style={[styles.monthName, { color: tokens.fg }]}>
          {grid.first.toLocaleDateString(locale, {
            month: 'long',
            year: 'numeric',
          })}
        </Text>
        <Pressable
          testID="composer-next-month"
          accessibilityRole="button"
          accessibilityLabel={t.labs.calendar.nextMonth}
          hitSlop={12}
          onPress={() => onMonth(shiftMonth(month, 1))}
        >
          <UI_ICONS.ChevronRight
            size={20}
            color={tokens.fg}
            strokeWidth={2.2}
          />
        </Pressable>
      </View>

      <WeekdayStrip locale={locale} />
      <MonthGridView
        grid={grid}
        locale={locale}
        selected={value}
        today={today}
        tint={tint.fg}
        onPick={onPick}
        testIDPrefix="composer-day"
      />

      <Pressable
        testID="composer-date-done"
        accessibilityRole="button"
        accessibilityLabel={t.actions.done}
        onPress={onDone}
        style={styles.paneDone}
      >
        <Text style={[styles.paneDoneText, { color: tint.fg }]}>
          {t.actions.done}
        </Text>
      </Pressable>
    </View>
  )
}

/* ══ the two rivals ═════════════════════════════════════════════════════ */

/**
 * The house style: a `NativeSheet` of rows, which is how every other property
 * in this app is edited. Presentation, drag, detents, keyboard and dismissal
 * all belong to the platform, which is exactly what the card gives up.
 */
function SheetComposer({
  draft,
  locale,
  onChange,
  onClose,
  onDelete,
}: CalendarComposerProps) {
  const tokens = useTokens('home')
  const tint = tokens.tintOf('home')
  const { t } = useI18n()
  const [local, setLocal] = useState<Draft>(draft as Draft)
  const ready = local.title.trim().length > 0

  const edit = (patch: Partial<Draft>) => {
    const next = { ...local, ...patch }
    setLocal(next)
    if (next.mode === 'edit') onChange(next)
  }

  const calendar = LAB_CALENDARS.find((each) => each.id === local.calendarId)

  return (
    <NativeSheet
      title={
        local.mode === 'edit' ? t.labs.calendar.title : t.labs.calendar.newEvent
      }
      subtitle={t.labs.calendar.notSaved}
      onClose={onClose}
      footer={
        local.mode === 'create' ? (
          <Pressable
            testID="composer-commit"
            accessibilityRole="button"
            accessibilityState={{ disabled: !ready }}
            accessibilityLabel={t.labs.calendar.commit}
            onPress={() => {
              if (!ready) {
                haptics.actionFailed()
                return
              }
              onChange(local)
              onClose()
            }}
            style={[
              styles.sheetSave,
              { backgroundColor: ready ? tint.fg : tokens.tile },
            ]}
          >
            <Text
              style={[
                styles.sheetSaveText,
                { color: ready ? tokens.surface : tokens.muted },
              ]}
            >
              {t.labs.calendar.commit}
            </Text>
          </Pressable>
        ) : null
      }
    >
      <TextInput
        testID="composer-name"
        autoFocus
        value={local.title}
        onChangeText={(title) => edit({ title })}
        placeholder={t.labs.calendar.namePlaceholder}
        placeholderTextColor={tokens.muted}
        selectionColor={tint.fg}
        style={[
          styles.sheetField,
          { color: tokens.fg, borderColor: tokens.border },
        ]}
      />

      <SheetRow
        label={t.labs.calendar.chips.calendar}
        value={calendar?.name ?? ''}
        onPress={() => {
          const index = LAB_CALENDARS.findIndex(
            (each) => each.id === local.calendarId,
          )
          const next = LAB_CALENDARS[(index + 1) % LAB_CALENDARS.length]
          haptics.selectionChanged()
          edit({ calendarId: next.id })
        }}
      />
      <SheetRow
        label={t.labs.calendar.chips.date}
        value={parseDay(local.date).toLocaleDateString(locale, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        })}
        onPress={() => {
          haptics.selectionChanged()
          edit({ date: addDays(local.date, 1) })
        }}
      />
      <SheetRow
        label={t.labs.calendar.chips.allDay}
        value={local.allDay ? t.actions.done : ''}
        onPress={() => {
          haptics.selectionChanged()
          edit({ allDay: !local.allDay })
        }}
      />
      <SheetRow
        label={t.labs.calendar.chips.who}
        value={
          local.who
            .map((id) => LAB_MEMBERS.find((each) => each.id === id)?.name ?? id)
            .join(', ') || t.labs.calendar.marksNobody
        }
        onPress={() => {
          haptics.selectionChanged()
          edit({
            who:
              local.who.length === LAB_MEMBERS.length
                ? []
                : LAB_MEMBERS.slice(0, local.who.length + 1).map(
                    (member) => member.id,
                  ),
          })
        }}
      />
      {local.mode === 'edit' && local.id ? (
        <SheetRow
          label={t.labs.calendar.deleteEvent}
          value=""
          destructive
          onPress={() => {
            if (!local.id) return
            onDelete(local.id)
            onClose()
          }}
        />
      ) : null}
    </NativeSheet>
  )
}

function SheetRow({
  label,
  value,
  onPress,
  destructive = false,
}: {
  label: string
  value: string
  onPress: () => void
  destructive?: boolean
}) {
  const tokens = useTokens()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[label, value].filter(Boolean).join(', ')}
      onPress={onPress}
      style={({ pressed }) => [
        styles.sheetRow,
        { borderTopColor: tokens.border },
        pressed && { backgroundColor: tokens.tile },
      ]}
    >
      <Text
        style={[
          styles.sheetRowLabel,
          { color: destructive ? tokens.danger : tokens.fg },
        ]}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={[styles.sheetRowValue, { color: tokens.muted }]}
      >
        {value}
      </Text>
    </Pressable>
  )
}

/**
 * One line, pinned to the bottom, the way the Tasks list already does it.
 *
 * Return commits and the field stays open for the next one; everything else is
 * set afterwards by opening what you just made. It is the cheapest of the three
 * and it is the only one that cannot express a time without a second step.
 */
function InlineComposer({
  draft,
  selected,
  locale,
  onChange,
  onClose,
  onOpen,
}: CalendarComposerProps) {
  const tokens = useTokens('home')
  const tint = tokens.tintOf('home')
  const { t } = useI18n()
  const [title, setTitle] = useState('')
  const keyboard = useAnimatedKeyboard()

  // Opening an event puts its name in the line rather than opening a second
  // surface — the point of this variant is that there is only ever one.
  useEffect(() => {
    if (draft?.mode === 'edit') setTitle(draft.title)
  }, [draft])

  // `translateY` rather than a growing `paddingBottom`, for the reason in the
  // card above: a padding that changes is a layout pass a frame.
  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -keyboard.height.value }],
  }))

  const commit = () => {
    if (title.trim().length === 0) {
      haptics.actionFailed()
      return
    }
    if (draft?.mode === 'edit') {
      onChange({ ...draft, title })
      onClose()
    } else {
      onChange({
        mode: 'create',
        date: selected,
        title,
        calendarId: LAB_CALENDARS[0].id,
        who: [],
        allDay: false,
      })
    }
    setTitle('')
  }

  const dayName = parseDay(selected).toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

  return (
    <Animated.View
      testID="composer-inline"
      style={[
        styles.inline,
        { backgroundColor: tokens.surface, borderTopColor: tokens.border },
        barStyle,
      ]}
    >
      <TextInput
        testID="composer-name"
        value={title}
        onChangeText={setTitle}
        onFocus={() => {
          if (draft === null) onOpen()
        }}
        placeholder={fmt(t.labs.calendar.addOn, { day: dayName })}
        placeholderTextColor={tokens.muted}
        selectionColor={tint.fg}
        returnKeyType="done"
        onSubmitEditing={commit}
        style={[styles.inlineField, { color: tokens.fg }]}
      />
      <Pressable
        testID="composer-commit"
        accessibilityRole="button"
        accessibilityLabel={t.labs.calendar.commit}
        onPress={commit}
        style={[
          styles.commit,
          {
            backgroundColor: title.trim().length > 0 ? tint.fg : tokens.tile,
          },
        ]}
      >
        <UI_ICONS.ArrowUp
          size={20}
          color={title.trim().length > 0 ? tokens.surface : tokens.muted}
          strokeWidth={2.6}
        />
      </Pressable>
    </Animated.View>
  )
}

/* ══ the chips ══════════════════════════════════════════════════════════ */

function Chip({
  label,
  testID,
  icon,
  set = false,
  dashed = false,
  active = false,
  onPress,
}: {
  label: string
  testID?: string
  icon?: 'Clock' | 'Users' | 'MapPin'
  set?: boolean
  dashed?: boolean
  active?: boolean
  onPress: () => void
}) {
  const tokens = useTokens('home')
  const tint = tokens.tintOf('home')
  const Icon = icon ? UI_ICONS[icon] : null
  const background = active ? tint.fg : set ? tint.bg : tokens.surface
  const foreground = active ? tokens.surface : set ? tint.fg : tokens.muted

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: set || active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: background,
          borderColor: set || active ? 'transparent' : tokens.border,
          borderStyle: dashed ? 'dashed' : 'solid',
        },
        pressed && styles.pressed,
      ]}
    >
      {Icon ? <Icon size={16} color={foreground} strokeWidth={2} /> : null}
      <Text style={[styles.chipLabel, { color: foreground }]}>{label}</Text>
    </Pressable>
  )
}

/**
 * A time, picked from the ones a household actually uses.
 *
 * Not a wheel: `DateTimePicker` on Android is a modal dialog, which would take
 * the card off screen to answer a question the card is asking. Sixteen half
 * hours in a scroller is a worse instrument and a better control here — and it
 * is a prototype's job to find that out before a wheel is wired in.
 */
function TimePane({
  start,
  end,
  onPick,
}: {
  start?: string
  end?: string
  onPick: (start: string, end: string) => void
}) {
  const tokens = useTokens('home')
  const tint = tokens.tintOf('home')
  const { t } = useI18n()

  const times = Array.from({ length: 32 }, (_, index) => {
    const minutes = 7 * 60 + index * 30
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${
      minutes % 60 === 0 ? '00' : '30'
    }`
  })

  const durations = [
    { id: 'm30' as const, minutes: 30 },
    { id: 'h1' as const, minutes: 60 },
    { id: 'h2' as const, minutes: 120 },
  ]

  const plus = (from: string, minutes: number) => {
    const [hour, minute] = from.split(':').map(Number)
    const total = (hour * 60 + minute + minutes) % (24 * 60)
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(
      total % 60,
    ).padStart(2, '0')}`
  }

  const current = start ?? '09:00'
  const span =
    start && end
      ? Number(end.slice(0, 2)) * 60 +
        Number(end.slice(3)) -
        (Number(start.slice(0, 2)) * 60 + Number(start.slice(3)))
      : 60

  return (
    <View testID="composer-time-pane" style={styles.pane}>
      <Text style={[styles.paneLabel, { color: tokens.muted }]}>
        {t.labs.calendar.startsAt}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={styles.chips}
      >
        {times.map((time) => (
          <Chip
            key={time}
            testID={`composer-time-${time}`}
            label={time}
            set={time === start}
            onPress={() => onPick(time, plus(time, span))}
          />
        ))}
      </ScrollView>

      <Text style={[styles.paneLabel, { color: tokens.muted }]}>
        {t.labs.calendar.lasts}
      </Text>
      <View style={styles.moreRow}>
        {durations.map((duration) => (
          <Chip
            key={duration.id}
            testID={`composer-duration-${duration.id}`}
            label={t.labs.calendar.durations[duration.id]}
            set={span === duration.minutes && Boolean(start)}
            onPress={() => onPick(current, plus(current, duration.minutes))}
          />
        ))}
      </View>
      <View style={[styles.paneRule, { backgroundColor: tint.bg }]} />
    </View>
  )
}

/** Where, and Notes: one field each, inside the card rather than after it. */
function TextPane({
  value,
  placeholder,
  multiline,
  testID,
  onChange,
}: {
  value: string
  placeholder: string
  multiline: boolean
  testID: string
  onChange: (value: string) => void
}) {
  const tokens = useTokens('home')
  const tint = tokens.tintOf('home')

  return (
    <View style={styles.pane}>
      <TextInput
        testID={testID}
        autoFocus
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={tokens.muted}
        selectionColor={tint.fg}
        multiline={multiline}
        style={[
          styles.paneField,
          {
            color: tokens.fg,
            backgroundColor: tokens.tile,
            minHeight: multiline ? 66 : 42,
          },
        ]}
      />
    </View>
  )
}

/** Recurrence, as far as a prototype takes it: it is stored and it is shown. */
function RepeatChip({
  value,
  onPick,
}: {
  value: RepeatRule
  onPick: (next: RepeatRule) => void
}) {
  const tokens = useTokens('home')
  const tint = tokens.tintOf('home')
  const { t } = useI18n()
  const rules: RepeatRule[] = ['never', 'daily', 'weekly', 'monthly']
  const set = value !== 'never'

  return (
    <NativeContextMenu
      trigger="press"
      actions={rules.map((rule) => ({
        id: rule,
        title: t.labs.calendar.repeatRules[rule],
        state: rule === value ? ('on' as const) : ('off' as const),
      }))}
      onAction={(id) => {
        haptics.selectionChanged()
        onPick(id as RepeatRule)
      }}
    >
      <View
        testID="composer-chip-repeats"
        accessibilityRole="button"
        accessibilityLabel={t.labs.calendar.chips.repeats}
        style={[
          styles.chip,
          {
            backgroundColor: set ? tint.bg : tokens.surface,
            borderColor: set ? 'transparent' : tokens.border,
            borderStyle: set ? 'solid' : 'dashed',
          },
        ]}
      >
        <Text
          style={[styles.chipLabel, { color: set ? tint.fg : tokens.muted }]}
        >
          {set
            ? t.labs.calendar.repeatRules[value]
            : t.labs.calendar.chips.repeats}
        </Text>
      </View>
    </NativeContextMenu>
  )
}

/** Colour is the calendar. The swatch is the whole control. */
function CalendarChip({
  calendarId,
  onPick,
}: {
  calendarId: string
  onPick: (id: string) => void
}) {
  const tokens = useTokens()
  const calendar =
    LAB_CALENDARS.find((each) => each.id === calendarId) ?? LAB_CALENDARS[0]
  const colours = tokens.tintOf(calendar.tint)

  return (
    <NativeContextMenu
      trigger="press"
      actions={LAB_CALENDARS.map((each) => ({
        id: each.id,
        title: each.name,
        state: each.id === calendarId ? ('on' as const) : ('off' as const),
      }))}
      onAction={(id) => {
        haptics.selectionChanged()
        onPick(id)
      }}
    >
      <View
        testID="composer-calendar"
        accessibilityRole="button"
        accessibilityLabel={calendar.name}
        style={[
          styles.chip,
          { backgroundColor: colours.bg, borderColor: 'transparent' },
        ]}
      >
        <View style={[styles.swatch, { backgroundColor: colours.fg }]} />
        <Text style={[styles.chipLabel, { color: colours.fg }]}>
          {calendar.name}
        </Text>
      </View>
    </NativeContextMenu>
  )
}

/** A person is an initial, never an avatar — `groups.members` has no image. */
function WhoChip({
  who,
  onChange,
}: {
  who: string[]
  onChange: (next: string[]) => void
}) {
  const tokens = useTokens('home')
  const tint = tokens.tintOf('home')
  const { t } = useI18n()

  return (
    <NativeContextMenu
      trigger="press"
      actions={LAB_MEMBERS.map((member) => ({
        id: member.id,
        title: member.name,
        state: who.includes(member.id) ? ('on' as const) : ('off' as const),
      }))}
      onAction={(id) => {
        haptics.selectionChanged()
        onChange(
          who.includes(id) ? who.filter((each) => each !== id) : [...who, id],
        )
      }}
    >
      <View
        testID="composer-who"
        accessibilityRole="button"
        accessibilityLabel={t.labs.calendar.chips.who}
        style={[
          styles.chip,
          who.length > 0
            ? { backgroundColor: tint.bg, borderColor: 'transparent' }
            : {
                backgroundColor: tokens.surface,
                borderColor: tokens.border,
                borderStyle: 'dashed',
              },
        ]}
      >
        {who.length === 0 ? (
          <>
            <UI_ICONS.Users size={16} color={tokens.muted} strokeWidth={2} />
            <Text style={[styles.chipLabel, { color: tokens.muted }]}>
              {t.labs.calendar.chips.who}
            </Text>
          </>
        ) : (
          who.map((id) => {
            const member = LAB_MEMBERS.find((each) => each.id === id)
            return (
              <View
                key={id}
                style={[styles.whoInitial, { backgroundColor: tint.fg }]}
              >
                <Text
                  style={[styles.whoInitialText, { color: tokens.surface }]}
                >
                  {member?.initial ?? '?'}
                </Text>
              </View>
            )
          })
        )}
      </View>
    </NativeContextMenu>
  )
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(31, 36, 33, 0.28)' },
  card: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    borderRadius: 26,
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 14,
    // `boxShadow` rather than the legacy shadow* family, which needs a
    // different set of props on each platform and gets one of them wrong.
    boxShadow: '0 8px 30px rgba(31, 36, 33, 0.20)',
    elevation: 12,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameField: {
    flex: 1,
    fontSize: 21,
    fontWeight: '600',
    letterSpacing: -0.3,
    paddingVertical: Platform.OS === 'android' ? 2 : 4,
  },
  cardMore: { padding: 2 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 4,
  },
  moreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 15,
    borderRadius: 999,
    borderWidth: 1,
  },
  pane: { paddingHorizontal: 4, paddingBottom: 6, gap: 6 },
  paneLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingHorizontal: 8,
    textTransform: 'uppercase',
  },
  paneField: {
    fontSize: 16,
    borderRadius: RADIUS.tile,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  paneRule: { height: 1, marginTop: 4, borderRadius: 1 },
  chipLabel: { fontSize: 15, fontWeight: '600' },
  swatch: { width: 11, height: 11, borderRadius: 3 },
  roundChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whoInitial: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whoInitialText: { fontSize: 11, fontWeight: '700' },
  commit: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footnote: { fontSize: 11.5 },
  shortcuts: { flexDirection: 'row', gap: 8, paddingBottom: 10 },
  shortcut: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.control,
    borderWidth: 1,
  },
  shortcutText: { fontSize: 14, fontWeight: '600' },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
  },
  monthName: { fontSize: 16, fontWeight: '600' },
  paneDone: { alignItems: 'center', paddingTop: 8 },
  paneDoneText: { fontSize: 15.5, fontWeight: '600' },
  sheetField: {
    fontSize: 19,
    fontWeight: '600',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
    paddingHorizontal: 13,
    paddingVertical: 12,
    marginBottom: 6,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 50,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sheetRowLabel: { flex: 1, fontSize: 16 },
  sheetRowValue: { fontSize: 15, maxWidth: 170 },
  sheetSave: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.control,
  },
  sheetSaveText: { fontSize: 16, fontWeight: '700' },
  inline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inlineField: { flex: 1, fontSize: 16, paddingVertical: 12 },
  pressed: { opacity: 0.75 },
})
