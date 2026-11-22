/**
 * Adding a task from a Tasks screen (APP-587): the add button, and the
 * keyboard composer it opens with a task's chips. The shell is
 * `ui/keyboard-composer.tsx`; this file is the task's part of it.
 *
 * - **List and Date always; the rest behind +.** Priority, Who, Reminder,
 *   Label and Repeat get a chip once set, and every one of them shows when
 *   the composer is expanded. Each chip is a native menu, so the keyboard
 *   stays up; a date or a time of your own is a wheel under the chips.
 * - **The line still reads itself** (APP-307): "stofzuigen morgen elke week
 *   @Daan #keuken" fills Date, Repeat, Who and Label exactly as tapping would.
 *   `composerDraft.ts` decides which of a tap and the line wins.
 * - **Saving keeps it open**, empty, on the same list, with the place's own
 *   date or person back, and the new row flashes where it landed.
 * - **A draft survives a close**: per account, Group and place, in memory
 *   (`ui/composer-drafts.ts`).
 *
 * Grocery lists keep their inline composer (APP-311, APP-524) and are not
 * offered here; linked lists are never offered (ADR-0021).
 */
import { useAuth } from '@clerk/expo'
import { DateTimePicker } from '@expo/ui/community/datetime-picker'
import type { MenuAction } from '@expo/ui/community/menu'
import { localIsoDate } from '@gather/core/civil-date'
import { presetClock, type ReminderPreset } from '@gather/core/task-reminders'
import {
  describeRepeat,
  normalizeRepeat,
  sameRepeat,
  type TaskRepeat,
} from '@gather/core/task-repeat'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import { DateTimeWheel } from '../../components/DateTimeField'
import { usePushPermission } from '../../features/notifications/use-push-permission'
import { haptics } from '../../feedback/haptics'
import { useGroup } from '../../group/GroupProvider'
import { fmt, useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { TYPE, useTokens } from '../../theme/tokens'
import { draftKey, keepDraft, keptDraft } from '../../ui/composer-drafts'
import {
  ComposerAddButton,
  type ComposerChip,
  KeyboardComposer,
} from '../../ui/keyboard-composer'
import { useTaskPeople } from './assignee'
import {
  afterTyping,
  composedTask,
  dateShortcuts,
  emptyDraft,
  isDirty,
  lineAfterChoice,
  nextDraft,
  QUICK_REPEATS,
  type ReminderPick,
  type TaskChoices,
  type TaskDraft,
  type TaskPreset,
} from './composerDraft'
import { markFresh } from './freshTasks'
import { TASK_ICONS } from './icons'
import { ListTile } from './listFace'
import { QuickAddInput, useQuickAddLine } from './QuickAddParts'
import { quickAddLists, quickAddTarget } from './quickAdd'
import { RepeatSheet } from './RepeatSheet'
import {
  availablePresets,
  clockOfDate,
  dateOfClock,
  deviceTimeZone,
  initialPick,
  reminderLabel,
  reminderPassed,
} from './reminder'
import { listFace, useTaskActions, useTaskLists, useTaskState } from './store'
import { dueLabel, weekendFrom } from './taskDates'
import { type Priority, SUGGESTED_LABELS } from './types'

/** The list each Group last added to, for the places that are not a list. */
const lastList = new Map<string, string>()

/** The iOS picker takes an underscore identifier; the app's locale is a language. */
const PICKER_LOCALE = { en: 'en_GB', nl: 'nl_NL' } as const

const PRIORITIES: Priority[] = [1, 2, 3, 4]

export interface AddTaskProps {
  /** Where it was opened: keys the draft ("index", "smart:today", "list:…"). */
  place: string
  /** The list, date and person this place chooses up front. */
  preset: TaskPreset
  /** The section a task added to the preset list joins (APP-357). */
  sectionId?: string
}

/** The add button, and the composer while it is open. */
export function AddTask({ place, preset, sectionId }: AddTaskProps) {
  const { t } = useI18n()
  const { group } = useGroup()
  const { userId } = useAuth()
  const router = useRouter()
  const key = draftKey(userId, group.slug, `tasks:${place}`)
  const [open, setOpen] = useState(false)
  // The Repeat sheet is a sheet of its own: the composer steps aside for it
  // and comes back with the rule in its draft.
  const [repeatFor, setRepeatFor] = useState<{ dueDate?: string } | null>(null)
  const withLast: TaskPreset = {
    ...preset,
    listId: preset.listId ?? lastList.get(group.slug),
  }

  const repeatDraft = repeatFor ? keptDraft<TaskDraft>(key) : undefined

  return (
    <>
      {open || repeatFor ? null : (
        <ComposerAddButton
          group="home"
          label={t.composer.addTask}
          onPress={() => setOpen(true)}
          testID="add-task"
        />
      )}
      {open ? (
        <TaskComposerCard
          draftId={key}
          preset={withLast}
          sectionId={sectionId}
          onClose={() => setOpen(false)}
          onCustomRepeat={(dueDate) => {
            setOpen(false)
            setRepeatFor({ dueDate })
          }}
          onOpenTask={(taskId) => {
            setOpen(false)
            router.push({
              pathname: '/all/tasks/task/[taskId]',
              params: { taskId },
            })
          }}
        />
      ) : null}
      {repeatFor ? (
        <RepeatSheet
          task={{
            repeat: repeatDraft?.choices.repeat ?? undefined,
            dueDate: repeatFor.dueDate,
          }}
          onSave={(rule) => {
            const draft = keptDraft<TaskDraft>(key) ?? emptyDraft(withLast)
            keepDraft(key, {
              ...draft,
              choices: { ...draft.choices, repeat: rule },
            })
          }}
          onClose={() => {
            setRepeatFor(null)
            setOpen(true)
          }}
        />
      ) : null}
    </>
  )
}

type Panel = 'date' | 'reminder' | null

function TaskComposerCard({
  draftId,
  preset,
  sectionId,
  onClose,
  onCustomRepeat,
  onOpenTask,
}: {
  draftId: string
  preset: TaskPreset
  sectionId?: string
  onClose: () => void
  onCustomRepeat: (dueDate: string | undefined) => void
  onOpenTask: (taskId: string) => void
}) {
  const { t, locale } = useI18n()
  const words = t.composer
  const taskWords = t.tasks.task
  const { group } = useGroup()
  const lists = useTaskLists()
  const actions = useTaskActions()
  const { people, byId } = useTaskPeople()
  const { ask } = usePushPermission()
  // Every label the Group has typed, for the Label menu. Mounted only while
  // the composer is open, as the Labels sheet is.
  const state = useTaskState()

  const [kept] = useState(() => keptDraft<TaskDraft>(draftId) ?? emptyDraft(preset))
  const quick = useQuickAddLine(true, kept)
  const { line, parsed, today } = quick
  const [body, setBody] = useState(kept.body)
  const [showBody, setShowBody] = useState(kept.showBody)
  const [listId, setListId] = useState(kept.listId)
  const [choices, setChoices] = useState<TaskChoices>(kept.choices)
  const [panel, setPanel] = useState<Panel>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  // The draft last sent: a second Return before the cleared draft renders
  // reaches save with the same draft, and must not add the task twice.
  const submitted = useRef<TaskDraft | null>(null)
  const mounted = useRef(true)

  const draft: TaskDraft = {
    line,
    dismissed: quick.dismissed,
    body,
    showBody,
    listId,
    choices,
  }
  // The latest draft, for the moment the card goes: a close keeps it, unless
  // nothing was typed or chosen.
  const latest = useRef(draft)
  latest.current = draft
  // The place is fixed for the card's life; read at unmount, not tracked.
  const place = useRef({ draftId, preset })
  useEffect(
    () => () => {
      mounted.current = false
      const last = latest.current
      const { draftId: key, preset: base } = place.current
      keepDraft(key, isDirty(last, base) ? last : undefined)
    },
    [],
  )

  const load = (next: TaskDraft) => {
    latest.current = next
    quick.load(next)
    setBody(next.body)
    setShowBody(next.showBody)
    setListId(next.listId)
    setChoices(next.choices)
  }

  // A part the line newly recognised replaces a value tapped for it.
  const partKeys = parsed.parts.map((part) => part.key).join('\n')
  const seen = useRef(new Set(parsed.parts.map((part) => part.key)))
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the parts' keys
  useEffect(() => {
    setChoices((current) => afterTyping(current, seen.current, parsed.parts))
    seen.current = new Set(parsed.parts.map((part) => part.key))
  }, [partKeys])

  const offered = useMemo(
    () => (lists ? quickAddLists(lists).filter((list) => !list.grocery) : undefined),
    [lists],
  )
  const target = offered ? quickAddTarget(offered, listId) : undefined
  const task = composedTask(draft, parsed)
  const canSave = Boolean(task.title && target)
  const anchor = task.dueDate ?? today
  const repeatRule = task.repeat
    ? (normalizeRepeat(task.repeat, anchor) ?? task.repeat)
    : undefined

  /** A tap sets a detail, and the words the line read for it come out. */
  const choose = <K extends keyof Omit<TaskChoices, 'labels'>>(
    key: K,
    value: TaskChoices[K],
    kind: 'date' | 'time' | 'repeat' | 'member',
  ) => {
    haptics.selectionChanged()
    const rest = lineAfterChoice(line, parsed, kind)
    if (rest !== line) quick.setLine(rest)
    setChoices((current) => ({ ...current, [key]: value }))
  }

  /** Remove: the tap is undone and the line's words stay, as plain text. */
  const remove = (
    key: keyof Omit<TaskChoices, 'labels'>,
    kind: 'date' | 'time' | 'repeat' | 'member',
  ) => {
    haptics.selectionChanged()
    for (const part of parsed.parts) {
      if (part.kind === kind) quick.dismiss(part.key)
    }
    setChoices((current) => ({ ...current, [key]: null }))
  }

  const toggleLabel = (label: string) => {
    haptics.selectionChanged()
    const typed = parsed.parts.find(
      (part) => part.kind === 'label' && part.label === label,
    )
    if (typed) {
      quick.dismiss(typed.key)
      setChoices((current) => ({
        ...current,
        labels: current.labels.filter((each) => each !== label),
      }))
      return
    }
    setChoices((current) => ({
      ...current,
      labels: current.labels.includes(label)
        ? current.labels.filter((each) => each !== label)
        : [...current.labels, label],
    }))
  }

  async function save(open = false) {
    if (!task.title || !target) {
      haptics.actionFailed()
      return
    }
    if (inFlight.current || submitted.current === draft) return
    const snapshot = draft
    submitted.current = snapshot
    const saving = task
    const to = target._id
    setNotice(null)
    lastList.set(group.slug, to)
    if (open) {
      inFlight.current = true
      setBusy(true)
    } else {
      // Cleared first: the next task can be typed at once, and a second
      // Return cannot save this one twice.
      load(nextDraft(snapshot, preset))
    }
    try {
      const saved = await actions.addComposedTask(
        to,
        saving,
        to === preset.listId ? sectionId : undefined,
      )
      haptics.itemSaved()
      markFresh(saved.taskId)
      if (saved.notesFailed) Alert.alert(words.detailsFailed)
      else if (saved.reminderFailed) Alert.alert(t.tasks.quickAdd.reminderFailed)
      else if (saving.reminder) void ask('reminder')
      if (open && mounted.current) {
        load(nextDraft(snapshot, preset))
        onOpenTask(saved.taskId)
      }
    } catch {
      haptics.actionFailed()
      submitted.current = null
      if (!mounted.current) {
        // Closed while saving: keep the task as the place's draft, unless
        // another one was kept since, and say it was not added.
        const key = place.current.draftId
        if (!keptDraft(key)) keepDraft(key, snapshot)
        Alert.alert(t.tasks.quickAdd.failed)
        return
      }
      setNotice(t.tasks.quickAdd.failed)
      // The task comes back, unless the next one is already being typed.
      if (open || !latest.current.line.trim()) load(snapshot)
    } finally {
      if (open) {
        inFlight.current = false
        setBusy(false)
      }
    }
  }

  // ---------------------------------------------------------------- chips

  const removeAction = (id: string): MenuAction => ({
    id,
    title: words.remove,
    attributes: { destructive: true },
  })
  const inline = (id: string, subactions: MenuAction[]): MenuAction => ({
    id,
    title: '',
    displayInline: true,
    subactions,
  })

  const dayWords = { today: taskWords.today, tomorrow: taskWords.tomorrow }
  const shortcuts = dateShortcuts(today, weekendFrom(today))
  // On a weekend day, Today and This weekend are one date: tick only the first.
  const ticked = Object.entries(shortcuts).find(([, day]) => day === task.dueDate)?.[0]
  const dateMenu: MenuAction[] = (
    [
    { id: 'date:today', title: taskWords.today, image: 'sun.max' },
    { id: 'date:tomorrow', title: taskWords.tomorrow, image: 'sunrise' },
    { id: 'date:weekend', title: words.date.weekend, image: 'sofa' },
    { id: 'date:nextWeek', title: words.date.nextWeek, image: 'arrow.right.circle' },
    { id: 'date:pick', title: words.date.pick, image: 'calendar' },
    ] satisfies MenuAction[]
  ).map((action) => ({
    ...action,
    state: ticked && action.id === `date:${ticked}` ? ('on' as const) : ('off' as const),
  }))
  if (task.dueDate) dateMenu.push(inline('date:remove-group', [removeAction('date:remove')]))

  const priorityMenu: MenuAction[] = [
    ...PRIORITIES.map((value) => ({
      id: `priority:${value}`,
      title: taskWords.priorities[value],
      state: task.priority === value ? ('on' as const) : ('off' as const),
    })),
    ...(task.priority ? [inline('priority:remove-group', [removeAction('priority:remove')])] : []),
  ]

  const whoMenu: MenuAction[] = [
    ...people.map((person) => ({
      id: `who:${person.id}`,
      title: person.name,
      state: task.assigneeId === person.id ? ('on' as const) : ('off' as const),
    })),
    ...(task.assigneeId
      ? [
          inline('who:remove-group', [
            { id: 'who:remove', title: t.tasks.assignee.nobody },
          ]),
        ]
      : []),
  ]

  const now = new Date()
  const presets = availablePresets(task.dueDate, now)
  const presetWords: Record<ReminderPreset, string> = {
    dueDay: taskWords.reminderSheet.dueDay,
    eveningBefore: taskWords.reminderSheet.eveningBefore,
  }
  const reminderMenu: MenuAction[] = [
    ...presets.map((preset) => ({
      id: `reminder:${preset}`,
      title: presetWords[preset],
    })),
    { id: 'reminder:pick', title: words.time.pick, image: 'clock' },
    ...(task.reminder ? [inline('reminder:remove-group', [removeAction('reminder:remove')])] : []),
  ]

  const groupLabels = Array.from(
    new Set([
      ...state.tasks.flatMap((each) => each.labels),
      ...SUGGESTED_LABELS,
      ...task.labels,
    ]),
  ).sort()
  const labelMenu: MenuAction[] = [
    ...groupLabels.map((label) => ({
      id: `label:${label}`,
      title: `#${label}`,
      state: task.labels.includes(label) ? ('on' as const) : ('off' as const),
    })),
    { id: 'label:new', title: words.newLabel, image: 'plus' },
    ...(task.labels.length > 0 ? [inline('label:remove-group', [removeAction('label:remove')])] : []),
  ]

  const repeatMenu: MenuAction[] = [
    ...(['day', 'week', 'month'] as const).map((unit) => {
      const rule = normalizeRepeat(QUICK_REPEATS[unit], anchor)
      return {
        id: `repeat:${unit}`,
        title: t.tasks.repeat.summary.every[unit].one,
        state:
          rule && repeatRule && sameRepeat(rule, repeatRule)
            ? ('on' as const)
            : ('off' as const),
      }
    }),
    { id: 'repeat:custom', title: words.customRepeat },
    ...(task.repeat ? [inline('repeat:remove-group', [removeAction('repeat:remove')])] : []),
  ]

  const onMenu = (id: string) => {
    const [chip, value = ''] = splitOnce(id)
    switch (chip) {
      case 'list':
        haptics.selectionChanged()
        setListId(value)
        return
      case 'date':
        if (value === 'pick') {
          setPanel('date')
          return
        }
        if (value === 'remove') {
          remove('dueDate', 'date')
          return
        }
        choose('dueDate', shortcuts[value as keyof typeof shortcuts], 'date')
        return
      case 'priority':
        if (value === 'remove') {
          haptics.selectionChanged()
          setChoices((current) => ({ ...current, priority: null }))
          return
        }
        haptics.selectionChanged()
        setChoices((current) => ({ ...current, priority: Number(value) as Priority }))
        return
      case 'who':
        if (value === 'remove') remove('assigneeId', 'member')
        else choose('assigneeId', value, 'member')
        return
      case 'reminder':
        if (value === 'pick') setPanel('reminder')
        else if (value === 'remove') remove('reminder', 'time')
        else if (task.dueDate) {
          const clock = presetClock(value as ReminderPreset, task.dueDate, deviceTimeZone())
          choose('reminder', { date: clock.date, time: clock.time }, 'time')
        }
        return
      case 'label':
        if (value === 'new') {
          // A label is typed where labels are read: "#" in the field.
          quick.setLine(`${line.trimEnd()}${line.trim() ? ' ' : ''}#`)
          return
        }
        if (value === 'remove') {
          haptics.selectionChanged()
          for (const part of parsed.parts) {
            if (part.kind === 'label') quick.dismiss(part.key)
          }
          setChoices((current) => ({ ...current, labels: [] }))
          return
        }
        toggleLabel(value)
        return
      case 'repeat':
        if (value === 'custom') onCustomRepeat(task.dueDate)
        else if (value === 'remove') remove('repeat', 'repeat')
        else choose('repeat', QUICK_REPEATS[value as keyof typeof QUICK_REPEATS], 'repeat')
        return
      case 'more':
        if (value === 'description') setShowBody((shown) => !shown)
        else if (value === 'all') void save(true)
        return
    }
  }

  const person = task.assigneeId ? byId.get(task.assigneeId) : undefined
  const labelText =
    task.labels.length === 0
      ? words.label
      : task.labels.length === 1
        ? `#${task.labels[0]}`
        : `#${task.labels[0]} +${task.labels.length - 1}`
  const named = (name: string, value?: string) =>
    value ? `${name}: ${value}` : name

  const listChip: ComposerChip | null = target
    ? {
        id: 'list',
        label: target.name,
        accessibilityLabel: fmt(t.tasks.quickAdd.listChip, { list: target.name }),
        set: false,
        leading: (
          <ListTile list={{ provider: target.provider, ...listFace(target) }} size="xs" />
        ),
        menu: (offered ?? []).map((list) => ({
          id: `list:${list._id}`,
          title: list.name,
          state: list._id === target._id ? ('on' as const) : ('off' as const),
        })),
        onMenu,
        testID: 'composer-chip-list',
      }
    : null

  const dueText = task.dueDate ? dueLabel(task.dueDate, today, locale, dayWords) : undefined
  const reminderText = task.reminder
    ? reminderLabel(task.reminder, today, locale, {
        ...dayWords,
        reminderAt: taskWords.reminderAt,
      })
    : undefined
  const repeatText = repeatRule
    ? describeRepeat(repeatRule, t.tasks.repeat.summary, locale)
    : undefined

  const details: (ComposerChip & { always?: boolean })[] = [
    {
      id: 'date',
      always: true,
      label: dueText ?? words.date.label,
      accessibilityLabel: named(taskWords.due, dueText),
      set: Boolean(dueText),
      icon: TASK_ICONS.Calendar,
      menu: dateMenu,
      onMenu,
      testID: 'composer-chip-date',
    },
    {
      id: 'priority',
      label: task.priority ? taskWords.priorities[task.priority] : taskWords.priority,
      accessibilityLabel: named(
        taskWords.priority,
        task.priority ? taskWords.priorities[task.priority] : undefined,
      ),
      set: Boolean(task.priority),
      icon: TASK_ICONS.Flag,
      menu: priorityMenu,
      onMenu,
      testID: 'composer-chip-priority',
    },
    {
      id: 'who',
      label: person?.name ?? t.tasks.assignee.who,
      accessibilityLabel: named(t.tasks.assignee.who, person?.name),
      set: Boolean(task.assigneeId),
      icon: UI_ICONS.User,
      menu: whoMenu,
      onMenu,
      testID: 'composer-chip-who',
    },
    {
      id: 'reminder',
      label: reminderText ?? taskWords.reminder,
      accessibilityLabel: named(taskWords.reminder, reminderText),
      set: Boolean(reminderText),
      icon: TASK_ICONS.Bell,
      menu: reminderMenu,
      onMenu,
      testID: 'composer-chip-reminder',
    },
    {
      id: 'label',
      label: labelText,
      accessibilityLabel: named(
        words.label,
        task.labels.length > 0 ? task.labels.map((l) => `#${l}`).join(', ') : undefined,
      ),
      set: task.labels.length > 0,
      icon: TASK_ICONS.Tag,
      menu: labelMenu,
      onMenu,
      testID: 'composer-chip-label',
    },
    {
      id: 'repeat',
      label: repeatText ?? t.tasks.repeat.title,
      accessibilityLabel: named(t.tasks.repeat.title, repeatText),
      set: Boolean(repeatText),
      icon: TASK_ICONS.Repeat,
      menu: repeatMenu,
      onMenu,
      testID: 'composer-chip-repeat',
    },
  ]
  const head = listChip ? [listChip] : []
  const chips = [...head, ...details.filter((chip) => chip.always || chip.set)]
  const allChips = [...head, ...details]

  const submenu = (id: string, title: string, subactions: MenuAction[]): MenuAction => {
    const chip = details.find((each) => each.id === id)
    return {
      id: `more:${id}`,
      title,
      state: chip?.set ? 'on' : 'off',
      subactions,
    }
  }
  const moreActions: MenuAction[] = [
    {
      id: 'more:description',
      title: words.description,
      image: 'text.alignleft',
      state: showBody || body.trim() ? 'on' : 'off',
    },
    submenu('priority', taskWords.priority, priorityMenu),
    submenu('who', t.tasks.assignee.who, whoMenu),
    submenu('reminder', taskWords.reminder, reminderMenu),
    submenu('label', words.label, labelMenu),
    submenu('repeat', t.tasks.repeat.title, repeatMenu),
    inline('more:end', [{ id: 'more:all', title: words.allDetails, image: 'arrow.up.forward.square' }]),
  ]

  // ---------------------------------------------------------------- panels

  const panelView =
    panel === 'date' ? (
      <PickerPanel
        onDone={() => setPanel(null)}
        doneLabel={t.actions.done}
        ios={Platform.OS === 'ios'}
      >
        <DateTimeWheel
          mode="date"
          value={task.dueDate ? dateOfClock({ date: task.dueDate, time: '12:00' }) : now}
          onChange={(next) => choose('dueDate', localIsoDate(next), 'date')}
          onClose={() => setPanel(null)}
        />
      </PickerPanel>
    ) : panel === 'reminder' ? (
      <ReminderPanel
        value={task.reminder}
        dueDate={task.dueDate}
        doneLabel={t.actions.done}
        passed={taskWords.reminderSheet.passed}
        onPick={(pick) => choose('reminder', pick, 'time')}
        onClose={() => setPanel(null)}
      />
    ) : null

  return (
    <KeyboardComposer
      testID="task-keyboard-composer"
      group="home"
      onClose={onClose}
      renderTitle={(field) => (
        <QuickAddInput
          testID="composer-title"
          inputRef={field.inputRef}
          autoFocus
          multiline
          scrollEnabled={false}
          line={line}
          parsed={parsed}
          onChangeText={(value) => {
            quick.setLine(value)
            setNotice(null)
          }}
          placeholder={words.taskTitle}
          placeholderTextColor={field.placeholderTextColor}
          accessibilityLabel={words.taskTitle}
          returnKeyType="done"
          submitBehavior="submit"
          onSubmitEditing={() => void save()}
          style={field.style}
        />
      )}
      body={{
        value: body,
        onChange: setBody,
        visible: showBody || Boolean(body.trim()),
        placeholder: words.taskBody,
        accessibilityLabel: words.description,
      }}
      chips={chips}
      allChips={allChips}
      more={{ actions: moreActions, onPress: onMenu }}
      canSave={canSave}
      busy={busy}
      onSave={() => void save()}
      notice={
        notice ??
        (offered !== undefined && target === undefined ? t.tasks.quickAdd.noList : null)
      }
      panel={panelView}
    />
  )
}

/** A wheel in the keyboard's place, with Done to bring the keyboard back. */
function PickerPanel({
  children,
  onDone,
  doneLabel,
  ios,
}: {
  children: React.ReactNode
  onDone: () => void
  doneLabel: string
  ios: boolean
}) {
  const tokens = useTokens('home')
  // Android's picker is a dialog that reports its own close.
  if (!ios) return <>{children}</>
  return (
    <View style={styles.panel}>
      {children}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={doneLabel}
        onPress={onDone}
        hitSlop={12}
        style={({ pressed }) => [styles.done, pressed && styles.pressed]}
      >
        <Text style={[styles.doneText, { color: tokens.accentText }]}>{doneLabel}</Text>
      </Pressable>
    </View>
  )
}

/**
 * A reminder of your own: iOS's date-and-time wheel, set on Done; on Android
 * a time on the task's day (or today), from the system dialog.
 */
function ReminderPanel({
  value,
  dueDate,
  doneLabel,
  passed,
  onPick,
  onClose,
}: {
  value: ReminderPick | undefined
  dueDate: string | undefined
  doneLabel: string
  passed: string
  onPick: (pick: ReminderPick) => void
  onClose: () => void
}) {
  const tokens = useTokens('home')
  const { locale } = useI18n()
  const [now] = useState(() => new Date())
  const [picked, setPicked] = useState(() => initialPick(value, dueDate, now))

  if (Platform.OS !== 'ios') {
    return (
      <DateTimeWheel
        mode="time"
        value={picked}
        onChange={(next) => {
          const clock = clockOfDate(next)
          onPick({ date: dueDate ?? clock.date, time: clock.time })
        }}
        onClose={onClose}
      />
    )
  }

  return (
    <PickerPanel
      ios
      doneLabel={doneLabel}
      onDone={() => {
        const clock = clockOfDate(picked)
        if (reminderPassed(clock, new Date(Date.now() - 60_000))) {
          Alert.alert(passed)
          return
        }
        onPick({ date: clock.date, time: clock.time })
        onClose()
      }}
    >
      <DateTimePicker
        testID="composer-reminder-picker"
        value={picked}
        mode="datetime"
        display="spinner"
        minimumDate={now}
        locale={PICKER_LOCALE[locale]}
        accentColor={tokens.ink}
        onValueChange={(_, next) => setPicked(next)}
      />
    </PickerPanel>
  )
}

/** "date:nextWeek" → ["date", "nextWeek"]; a list's id may hold no colon. */
function splitOnce(id: string): [string, string?] {
  const at = id.indexOf(':')
  return at === -1 ? [id] : [id.slice(0, at), id.slice(at + 1)]
}

const styles = StyleSheet.create({
  panel: { alignSelf: 'stretch' },
  done: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' },
  doneText: { ...TYPE.bodyStrong },
  pressed: { opacity: 0.6 },
})

export type { TaskRepeat }
