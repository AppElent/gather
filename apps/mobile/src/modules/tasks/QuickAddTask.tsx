/**
 * The Add tab's "Add a task": one line, the list it goes on, and a save.
 *
 * The line is read as it is typed (APP-307): "stofzuigen morgen elke week
 * @Daan" is the task "stofzuigen", due tomorrow, every week, for Daan. Each
 * recognised part is highlighted in the field and gets a chip under it, whose
 * × leaves those words in the title instead.
 *
 * It writes to the Current Group, like every other Tasks write, and offers
 * only the lists Gather can write to (`quickAddLists`). The list is the first
 * chip rather than defaulted out of sight, for the reason the Drop's
 * `task-new` gives: a task with nowhere visible to live is a task nobody sees
 * again. It is preselected, though, so the common case is one line and a save.
 *
 * A failed save keeps the line and says so under it; the launcher is told
 * only about a save that happened.
 *
 * A line closed unsaved is kept with its list, like the keyboard composer's
 * draft (`ui/composer-drafts.ts`), and is back when the form opens again in
 * the same account and Group. The sheet can close without being asked: a share
 * from another app closes it to show the Drop chooser (APP-618).
 */
import { useAuth } from '@clerk/expo'
import { MenuView } from '@expo/ui/community/menu'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { haptics } from '../../feedback/haptics'
import { useGroup } from '../../group/GroupProvider'
import { fmt, useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { TYPE, useTokens } from '../../theme/tokens'
import { draftKey, keepDraft, keptDraft } from '../../ui/composer-drafts'
import { ListTile } from './listFace'
import { QuickAddChips, QuickAddInput, useQuickAddLine } from './QuickAddParts'
import { quickAddLists, quickAddTarget } from './quickAdd'
import { listFace, useTaskActions, useTaskLists } from './store'

/** The quick sheet's kept line (`useQuickAddLine`'s `initial`) and list. */
interface QuickLine {
  line: string
  dismissed: readonly string[]
  pickedId: string | null
}

interface QuickAddTaskProps {
  /** The title that was saved, and the name of the list it went on. */
  onSaved: (title: string, listName: string) => void
  /** "More details": the task was saved, and its screen should open. */
  onOpenTask?: (taskId: string) => void
}

/**
 * A new form per Group: the launcher sits outside the tab stacks, so a Group
 * change does not remount it, and a line typed for one Group must not be
 * saved, or kept, in another.
 */
export function QuickAddTask(props: QuickAddTaskProps) {
  const { group } = useGroup()
  return <QuickAddTaskForm key={group._id} {...props} />
}

function QuickAddTaskForm({ onSaved, onOpenTask }: QuickAddTaskProps) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const text = t.tasks.quickAdd
  const lists = useTaskLists()
  const { addTask, addParsedTask } = useTaskActions()
  const { group } = useGroup()
  const { userId } = useAuth()
  // The place is fixed for the form's life (a Group change remounts it).
  const [key] = useState(() => draftKey(userId, group._id, 'quick-sheet:task'))
  const [kept] = useState(() => keptDraft<QuickLine>(key))
  const [pickedId, setPickedId] = useState<string | null>(
    kept?.pickedId ?? null,
  )
  const [saving, setSaving] = useState(false)
  // `saving` reaches the next render only; a second tap in the same turn is
  // stopped by this, so submitting twice saves once.
  const inFlight = useRef(false)
  const [notice, setNotice] = useState<string | null>(null)

  const offered = lists ? quickAddLists(lists) : undefined
  const target = offered ? quickAddTarget(offered, pickedId) : undefined
  // A grocery list reads its own line: "2 pakken melk" is an amount (APP-309).
  const grocery = target?.grocery ?? false
  const { line, parsed, today, dismissed, setLine, dismiss, reset } =
    useQuickAddLine(!grocery, kept)
  // What a close would keep. Emptied by a save before its re-render, since
  // `onSaved` may close the form first.
  const latest = useRef<QuickLine>({ line, dismissed, pickedId })
  latest.current = { line, dismissed, pickedId }
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      const last = latest.current
      // A line closed mid-save is not kept: reopened, it could be sent twice.
      // `save` keeps it if that save fails.
      const keep = !inFlight.current && last.line.trim()
      keepDraft(key, keep ? last : undefined)
    }
  }, [key])
  const title = parsed.title
  const ready = Boolean(title && target && !saving)

  async function save(open = false) {
    if (inFlight.current) return
    if (!title || !target) {
      haptics.actionFailed()
      return
    }
    inFlight.current = true
    const sent: QuickLine = { line, dismissed, pickedId }
    setSaving(true)
    setNotice(null)
    try {
      const saved = grocery
        ? { taskId: await addTask(target._id, title, true), reminderFailed: false }
        : await addParsedTask(target._id, parsed)
      haptics.itemSaved()
      reset()
      latest.current = { line: '', dismissed: [], pickedId }
      // An alert, not the notice: `onSaved` may close this form, and a
      // haptic is never the only word that the reminder did not go in.
      if (saved.reminderFailed) Alert.alert(text.reminderFailed)
      onSaved(title, target.name)
      // Closed while it saved (a share's chooser may be up): no screen on top.
      if (open && mounted.current) onOpenTask?.(saved.taskId)
    } catch {
      haptics.actionFailed()
      setNotice(text.failed)
      // Closed while it saved, so nothing was kept: keep the line now, unless
      // a reopened form has kept a newer one.
      if (!mounted.current && keptDraft<QuickLine>(key) === undefined)
        keepDraft(key, sent)
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  const ArrowUp = UI_ICONS.ArrowUp
  const ChevronDown = UI_ICONS.ChevronDown

  return (
    <View style={styles.capture}>
      <View style={styles.composer}>
        <QuickAddInput
          testID="quick-add-task"
          autoFocus
          line={line}
          parsed={parsed}
          onChangeText={(value) => {
            setLine(value)
            setNotice(null)
          }}
          placeholder={t.tasks.task.titlePlaceholder}
          placeholderTextColor={tokens.muted}
          accessibilityLabel={t.tasks.task.titlePlaceholder}
          returnKeyType="done"
          submitBehavior="submit"
          onSubmitEditing={() => void save()}
          editable={!saving}
          style={[styles.input, { color: tokens.ink }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={text.save}
          accessibilityState={{ disabled: !ready, busy: saving }}
          onPress={() => void save()}
          disabled={!ready}
          hitSlop={4}
          style={({ pressed }) => [
            styles.send,
            { backgroundColor: ready ? tokens.accent : tokens.surface2 },
            pressed && styles.pressed,
          ]}
        >
          {saving ? (
            <ActivityIndicator color={tokens.onAccent} />
          ) : (
            <ArrowUp
              size={18}
              strokeWidth={2.6}
              color={ready ? tokens.onAccent : tokens.muted}
            />
          )}
        </Pressable>
      </View>

      <View style={styles.chips}>
        {offered === undefined ? (
          <ActivityIndicator
            color={tokens.muted}
            accessibilityLabel={t.actions.loading}
          />
        ) : target === undefined ? (
          <Text style={[styles.note, { color: tokens.muted }]}>
            {text.noList}
          </Text>
        ) : (
          <MenuView
            actions={offered.map((list) => ({
              id: list._id,
              title: list.name,
              state:
                list._id === target._id ? ('on' as const) : ('off' as const),
            }))}
            onPressAction={(event) => {
              haptics.selectionChanged()
              setPickedId(event.nativeEvent.event)
            }}
          >
            <View
              accessible
              accessibilityRole="button"
              accessibilityLabel={fmt(text.listChip, { list: target.name })}
              style={[styles.listChip, { backgroundColor: tokens.surface2 }]}
            >
              <ListTile
                list={{ provider: target.provider, ...listFace(target) }}
                size="xs"
              />
              <Text style={[styles.chipText, { color: tokens.ink }]}>
                {target.name}
              </Text>
              <ChevronDown size={14} strokeWidth={2.4} color={tokens.muted} />
            </View>
          </MenuView>
        )}
        <QuickAddChips parsed={parsed} today={today} onDismiss={dismiss} />
      </View>

      <View style={styles.footer}>
        {/* A grocery list reads amounts, not dates: the hint would be wrong. */}
        <Text style={[styles.note, styles.hint, { color: tokens.muted }]}>
          {grocery ? '' : text.hint}
        </Text>
        {onOpenTask ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !ready }}
            disabled={!ready}
            onPress={() => void save(true)}
            style={({ pressed }) => [styles.more, pressed && styles.pressed]}
          >
            <Text
              style={[
                styles.moreText,
                { color: ready ? tokens.ink : tokens.muted },
              ]}
            >
              {text.moreDetails}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {notice ? (
        <Text
          accessibilityRole="alert"
          style={[styles.note, { color: tokens.danger }]}
        >
          {notice}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  capture: { gap: 10, paddingBottom: 8 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  input: {
    ...TYPE.body,
    flex: 1,
    minHeight: 36,
    paddingVertical: 7,
  },
  send: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  listChip: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipText: { ...TYPE.subhead },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  hint: { flex: 1 },
  note: { ...TYPE.footnote },
  more: { minHeight: 44, justifyContent: 'center' },
  moreText: { ...TYPE.subhead, fontWeight: '600' },
  pressed: { opacity: 0.6 },
})
