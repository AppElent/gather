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
 * Grocery lists have a composer of their own (`GroceryComposer.tsx`, APP-664)
 * and are not offered here. A linked list that can be written to (APP-448) is
 * offered on its own screen only, with the details its provider can hold.
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
import { deviceTimeZone } from '@gather/core/time-zones'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Platform } from 'react-native'

import { DateTimeWheel } from '../../components/DateTimeField'
import { usePushPermission } from '../../features/notifications/use-push-permission'
import { haptics } from '../../feedback/haptics'
import { useGroup } from '../../group/GroupProvider'
import { fmt, useI18n } from '../../i18n'
import { showAlert } from '../../observability/native-presentation'
import { UI_ICONS } from '../../theme/icons'
import { useTokens } from '../../theme/tokens'
import {
  draftKey,
  forgetSentDraft,
  holdDraft,
  keepDraft,
  keptDraft,
  pendingSave,
} from '../../ui/composer-drafts'
import type { ComposerMoreIcon } from '../../ui/composer-menu'
import { ComposerDatePanel, ComposerPanel } from '../../ui/composer-panel'
import {
  ComposerAddButton,
  type ComposerChip,
  type ComposerMoreItem,
  KeyboardComposer,
} from '../../ui/keyboard-composer'
import { useTaskPeople } from './assignee'
import {
  afterLineChange,
  type ComposedTask,
  composedTask,
  dateShortcuts,
  draftAfterHold,
  emptyDraft,
  isDirty,
  LINKED_KINDS,
  lineAfterChoice,
  linkedTask,
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
  initialPick,
  reminderLabel,
  reminderPassed,
} from './reminder'
import {
  type ComposedDetails,
  listFace,
  useLocalTaskState,
  useTaskActions,
  useTaskLists,
} from './store'
import { dueLabel, weekendFrom } from './taskDates'
import { type Priority, SUGGESTED_LABELS } from './types'
import { linkedFailureWords } from './writeFailed'

/**
 * The list each account last added to in each Group, for the places that are
 * not a list. Keyed like a draft, on the Group's id: a slug can be reused.
 */
const lastList = new Map<string, string>()

/** The iOS picker takes an underscore identifier; the app's locale is a language. */
const PICKER_LOCALE = { en: 'en_GB', nl: 'nl_NL' } as const

/** The chips for what a linked list's provider holds (APP-448). */
const LINKED_DETAILS = ['date', 'priority', 'label']

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
  const key = draftKey(userId, group._id, `tasks:${place}`)
  const lastKey = draftKey(userId, group._id, 'tasks')
  const [open, setOpen] = useState(false)
  // The Repeat sheet is a sheet of its own: the composer steps aside for it
  // and comes back with the rule in its draft. It opens on the rule the
  // composer showed, typed or tapped, handed over rather than read back.
  const [repeatFor, setRepeatFor] = useState<{
    dueDate?: string
    repeat?: TaskRepeat
  } | null>(null)
  const withLast: TaskPreset = {
    ...preset,
    listId: preset.listId ?? lastList.get(lastKey),
  }

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
          placeListId={preset.listId}
          sectionId={sectionId}
          onListUsed={(listId) => {
            lastList.set(lastKey, listId)
          }}
          onClose={() => setOpen(false)}
          onCustomRepeat={(dueDate, repeat) => {
            setOpen(false)
            setRepeatFor({ dueDate, repeat })
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
          place={place}
          task={{ repeat: repeatFor.repeat, dueDate: repeatFor.dueDate }}
          onSave={(rule) => {
            const draft = keptDraft<TaskDraft>(key) ?? emptyDraft(withLast)
            keepDraft(key, {
              ...draft,
              choices: { ...draft.choices, repeat: rule },
            })
          }}
          onClose={(byShare) => {
            setRepeatFor(null)
            // A share's chooser is coming: the draft waits in its place.
            setOpen(!byShare)
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
  placeListId,
  sectionId,
  onListUsed,
  onClose,
  onCustomRepeat,
  onOpenTask,
}: {
  draftId: string
  preset: TaskPreset
  /** The list this place is, when it is one. */
  placeListId?: string
  sectionId?: string
  onListUsed: (listId: string) => void
  onClose: () => void
  onCustomRepeat: (dueDate: string | undefined, repeat: TaskRepeat | undefined) => void
  onOpenTask: (taskId: string) => void
}) {
  const { t, locale } = useI18n()
  const words = t.composer
  const taskWords = t.tasks.task
  const lists = useTaskLists()
  const actions = useTaskActions()
  const { people, byId } = useTaskPeople()
  const { ask } = usePushPermission()
  // The labels the Group's own lists already use, for the Label menu. Local
  // lists only: opening the composer asks no provider for anything (ADR-0021).
  const state = useLocalTaskState()

  const [kept] = useState(() => keptDraft<TaskDraft>(draftId) ?? emptyDraft(preset))
  const [listId, setListId] = useState(kept.listId)
  const offered = useMemo(() => {
    if (!lists) return undefined
    // Its own screen's linked list stays offered while the composer is open,
    // also when it goes stale: a task typed for it lands in no other list.
    const own = lists.find(
      (list) =>
        list._id === placeListId &&
        list.provider !== 'local' &&
        list.capabilities?.write,
    )
    const local = quickAddLists(lists).filter((list) => !list.grocery)
    return own ? [own, ...local] : local
  }, [lists, placeListId])
  const target = offered ? quickAddTarget(offered, listId) : undefined
  const linked = target !== undefined && target.provider !== 'local'
  const quick = useQuickAddLine(true, kept, linked ? LINKED_KINDS : undefined)
  const { line, parsed, today } = quick
  const [body, setBody] = useState(kept.body)
  const [showBody, setShowBody] = useState(kept.showBody)
  const [choices, setChoices] = useState<TaskChoices>(kept.choices)
  const [saveKey, setSaveKey] = useState(kept.saveKey)
  const [panel, setPanel] = useState<Panel>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Reopened while this place's draft was still being saved (All details,
  // then a close): locked until that save settles, so the draft cannot be
  // edited and sent again under the key already in flight.
  const [waiting, setWaiting] = useState(() => pendingSave(draftId))
  const inFlight = useRef(false)
  // The draft last sent: a second Return before the cleared draft renders
  // reaches save with the same draft. The server dedupes on the key as well.
  const submitted = useRef<string | null>(null)
  const mounted = useRef(true)

  const draft: TaskDraft = {
    line,
    dismissed: quick.dismissed,
    body,
    showBody,
    listId,
    choices,
    saveKey,
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

  // The line of a draft just loaded whole: its parts were not typed.
  const loadedLine = useRef<string | null>(null)
  const load = (next: TaskDraft) => {
    latest.current = next
    loadedLine.current = next.line
    quick.load(next)
    setBody(next.body)
    setShowBody(next.showBody)
    setListId(next.listId)
    setChoices(next.choices)
    setSaveKey(next.saveKey)
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: settles once per hold
  useEffect(() => {
    if (!waiting) return
    let live = true
    void waiting.then((saved) => {
      if (!live) return
      setWaiting(undefined)
      // Only a closed card holds a draft another can reopen on, and it settles
      // when the retry it asked about is answered: saved or discarded.
      load(draftAfterHold(saved, latest.current, preset))
    })
    return () => {
      live = false
    }
  }, [waiting])

  // A part the line newly recognised replaces a value tapped for it; a draft
  // loaded whole keeps the choices it came with.
  const partKeys = parsed.parts.map((part) => part.key).join('\n')
  const seen = useRef(new Set(parsed.parts.map((part) => part.key)))
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the parts' keys
  useEffect(() => {
    const before = seen.current
    const loaded = loadedLine.current
    loadedLine.current = null
    setChoices((current) => afterLineChange(current, before, parsed.parts, line, loaded))
    seen.current = new Set(parsed.parts.map((part) => part.key))
  }, [partKeys])

  const composed = composedTask(draft, parsed)
  const task = linked ? linkedTask(composed) : composed
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

  /**
   * A saved task: the place's kept draft is forgotten if it was this one (a
   * close mid-save kept it), then the haptic, the wash, and the note and
   * reminder that went in or did not.
   */
  const landed = (saved: { taskId: string } & ComposedDetails, saveKey: string) => {
    forgetSentDraft<TaskDraft>(place.current.draftId, saveKey)
    haptics.itemSaved()
    markFresh(saved.taskId)
    afterDetails(saved)
  }

  /**
   * A reminder that went in asks to notify, whatever the note did, and on a
   * retry too; what failed is offered again.
   */
  const afterDetails = (details: ComposedDetails) => {
    if (details.reminderSet) void ask('reminder')
    const retry = details.retry
    if (!retry) return
    showAlert(
      details.notesFailed ? words.detailsFailed : t.tasks.quickAdd.reminderFailed,
      undefined,
      [
        { text: words.ok, style: 'cancel' },
        { text: words.tryAgain, onPress: () => void retry().then(afterDetails) },
      ],
    )
  }

  /**
   * A save that failed once the composer had moved on to the next task, or
   * closed: asked about, never poured over what is being typed now. The same
   * key goes again, so a create that did land is not made twice. Answers
   * whether it was saved in the end (false: discarded, and forgotten).
   */
  const offerRetry = (
    saving: ComposedTask,
    saveKey: string,
    send: () => Promise<{ taskId: string } & ComposedDetails>,
    error: unknown,
  ): Promise<boolean> =>
    new Promise((resolve) => {
      showAlert(
        fmt(words.notAdded, { title: saving.title }),
        linkedFailureWords(error, lists, t)?.body,
        [
          {
            text: words.discard,
            style: 'destructive',
            onPress: () => {
              // Discarded is gone: a close mid-save kept it for the place.
              forgetSentDraft<TaskDraft>(place.current.draftId, saveKey)
              resolve(false)
            },
          },
          {
            text: words.tryAgain,
            onPress: () =>
              void send().then(
                (saved) => {
                  landed(saved, saveKey)
                  resolve(true)
                },
                (error: unknown) => {
                  haptics.actionFailed()
                  void offerRetry(saving, saveKey, send, error).then(resolve)
                },
              ),
          },
        ],
        { cancelable: false },
      )
    })

  async function save(open = false) {
    if (!task.title || !target) {
      haptics.actionFailed()
      return
    }
    if (inFlight.current || waiting || submitted.current === draft.saveKey) return
    const snapshot = draft
    const { saveKey } = snapshot
    submitted.current = saveKey
    const saving = task
    const to = target._id
    const section = to === preset.listId ? sectionId : undefined
    const send = () => actions.addComposedTask(to, saving, saveKey, section)
    const request = send()
    // All details keeps the draft while it saves: a close now keeps it for
    // the place, held until the save, or the retry asked about it, settles.
    let settle: (saved: boolean) => void = () => {}
    if (open)
      holdDraft(
        place.current.draftId,
        new Promise<boolean>((resolve) => {
          settle = resolve
        }),
      )
    setNotice(null)
    // Only a local list is offered anywhere else.
    if (!linked) onListUsed(to)
    if (open) {
      inFlight.current = true
      setBusy(true)
    } else {
      // Cleared first: the next task can be typed at once.
      load(nextDraft(snapshot, preset))
    }
    try {
      const saved = await request
      landed(saved, saveKey)
      settle(true)
      if (open && mounted.current) {
        load(nextDraft(snapshot, preset))
        onOpenTask(saved.taskId)
      }
    } catch (error) {
      haptics.actionFailed()
      submitted.current = null
      const failure = linkedFailureWords(error, lists, t)
      if (mounted.current && open) {
        // All details: the draft never left the composer.
        setNotice(failure?.body ?? t.tasks.quickAdd.failed)
        settle(false)
      } else if (mounted.current && !isDirty(latest.current, preset)) {
        // Nothing typed since: the task comes back to finish or send again.
        setNotice(failure?.body ?? t.tasks.quickAdd.failed)
        load(snapshot)
        settle(false)
      } else if (
        failure &&
        !mounted.current &&
        !keptDraft<TaskDraft>(place.current.draftId)
      ) {
        // The list went read-only and took the composer with it: a retry could
        // not work yet, so the task waits as this place's draft.
        keepDraft(place.current.draftId, snapshot)
        settle(false)
        showAlert(failure.title, failure.body)
      } else {
        void offerRetry(saving, saveKey, send, error).then(settle)
      }
    } finally {
      if (open) {
        inFlight.current = false
        if (mounted.current) setBusy(false)
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
    // A label's id carries its "#", so a label named "new" or "remove" is
    // never read as the menu's own command.
    ...groupLabels.map((label) => ({
      id: `label:#${label}`,
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
        if (value.startsWith('#')) toggleLabel(value.slice(1))
        return
      case 'repeat':
        if (value === 'custom') onCustomRepeat(task.dueDate, repeatRule)
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
    ? reminderLabel(task.reminder, localIsoDate(), locale, {
        ...dayWords,
        reminderAt: taskWords.reminderAt,
      })
    : undefined
  const repeatText = repeatRule
    ? describeRepeat(repeatRule, t.tasks.repeat.summary, locale)
    : undefined

  const everyDetail: (ComposerChip & { always?: boolean })[] = [
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
  const details = linked
    ? everyDetail.filter((chip) => LINKED_DETAILS.includes(chip.id))
    : everyDetail
  const head = listChip ? [listChip] : []
  const chips = [...head, ...details.filter((chip) => chip.always || chip.set)]
  const allChips = [...head, ...details]

  // Each item wears its chip's icon, in SF Symbols (`TASK_ICONS`).
  const submenu = (
    id: string,
    title: string,
    image: ComposerMoreIcon,
    subactions: MenuAction[],
  ): ComposerMoreItem => {
    const chip = details.find((each) => each.id === id)
    return {
      id: `more:${id}`,
      title,
      image,
      state: chip?.set ? 'on' : 'off',
      subactions,
    }
  }
  const everyItem: ComposerMoreItem[] = [
    {
      id: 'more:description',
      title: words.description,
      image: 'text.alignleft',
      state: showBody || body.trim() ? 'on' : 'off',
    },
    submenu('priority', taskWords.priority, 'flag', priorityMenu),
    submenu('who', t.tasks.assignee.who, 'person', whoMenu),
    submenu('reminder', taskWords.reminder, 'bell', reminderMenu),
    submenu('label', words.label, 'tag', labelMenu),
    submenu('repeat', t.tasks.repeat.title, 'repeat', repeatMenu),
  ]
  const moreItems = linked
    ? everyItem.filter((item) =>
        LINKED_DETAILS.includes(item.id.replace('more:', '')),
      )
    : everyItem
  const allDetailsItem: ComposerMoreItem = {
    id: 'more:all',
    title: words.allDetails,
    image: 'arrow.up.forward.square',
  }

  // ---------------------------------------------------------------- panels

  const panelView =
    panel === 'date' ? (
      <ComposerDatePanel
        value={task.dueDate ? dateOfClock({ date: task.dueDate, time: '12:00' }) : now}
        onPick={(day) => choose('dueDate', localIsoDate(day), 'date')}
        onClose={() => setPanel(null)}
      />
    ) : panel === 'reminder' ? (
      <ReminderPanel
        value={task.reminder}
        dueDate={task.dueDate}
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
          editable={field.editable}
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
          onSubmitEditing={field.onSubmitEditing}
          style={field.style}
        />
      )}
      body={{
        value: body,
        onChange: setBody,
        visible: !linked && (showBody || Boolean(body.trim())),
        placeholder: words.taskBody,
        accessibilityLabel: words.description,
      }}
      chips={chips}
      allChips={allChips}
      more={{ items: moreItems, allDetails: allDetailsItem, onPress: onMenu }}
      canSave={canSave}
      busy={busy || waiting !== undefined}
      onSave={() => void save()}
      notice={
        notice ??
        (offered !== undefined && target === undefined ? t.tasks.quickAdd.noList : null)
      }
      panel={panelView}
    />
  )
}

/**
 * A reminder of your own: iOS's date-and-time wheel, set on Done; on Android
 * a time on the task's day (or today), from the system dialog.
 */
function ReminderPanel({
  value,
  dueDate,
  passed,
  onPick,
  onClose,
}: {
  value: ReminderPick | undefined
  dueDate: string | undefined
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
    <ComposerPanel
      onDone={() => {
        const clock = clockOfDate(picked)
        if (reminderPassed(clock, new Date(Date.now() - 60_000))) {
          showAlert(passed)
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
    </ComposerPanel>
  )
}

/** "date:nextWeek" → ["date", "nextWeek"]; a list's id may hold no colon. */
function splitOnce(id: string): [string, string?] {
  const at = id.indexOf(':')
  return at === -1 ? [id] : [id.slice(0, at), id.slice(at + 1)]
}


export type { TaskRepeat }
