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
import { useEffect, useState } from 'react'
import {
  Keyboard,
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

/** What the `[+]` hides: the long tail, including where recurrence lands. */
type Pane = 'none' | 'date' | 'more'

function CardComposer({
  draft,
  today,
  locale,
  onChange,
  onClose,
  onDelete,
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

  const dropped = pane === 'date'
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
        style={[
          styles.card,
          { backgroundColor: tokens.surface, shadowColor: '#000' },
          cardStyle,
        ]}
      >
        <View style={styles.cardTitleRow}>
          <TextInput
            testID="composer-name"
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
              setPane('none')
            }}
            onDone={() => setPane('none')}
          />
        ) : null}

        {pane === 'more' ? (
          <View style={styles.moreRow}>
            {(['allDay', 'where', 'notes', 'repeats'] as const).map((id) => (
              <Chip
                key={id}
                testID={`composer-chip-${id}`}
                label={t.labs.calendar.chips[id]}
                dashed
                set={id === 'allDay' && local.allDay}
                onPress={() =>
                  id === 'allDay'
                    ? edit({ allDay: !local.allDay })
                    : haptics.selectionChanged()
                }
              />
            ))}
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
              onPress={() => {
                if (pane !== 'date') Keyboard.dismiss()
                setPane(pane === 'date' ? 'none' : 'date')
              }}
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
              onPress={() => edit({ allDay: !local.allDay, start: undefined })}
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
