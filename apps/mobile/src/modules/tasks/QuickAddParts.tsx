/**
 * Quick add's recognition on the phone (APP-307): the typed line with its
 * recognised parts highlighted, and a chip under the field for each one.
 *
 * The parsing is `@gather/core/task-quick-add`, on the phone, as the line is
 * typed: no network and no AI, so it works offline. A chip's × dismisses that
 * recognition; its words stay in the title as plain text.
 */
import { localIsoDate } from '@gather/core/civil-date'
import {
  parseQuickAdd,
  type QuickAdd,
  type QuickAddKind,
} from '@gather/core/task-quick-add'
import { type ComponentRef, type Ref, useMemo, useState } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native'

import { fmt, useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { type ModuleGroup, TYPE, useTokens } from '../../theme/tokens'
import { useTaskPeople } from './assignee'
import { TASK_ICONS } from './icons'
import { quickAddChipLabel } from './quickAdd'

const pad = (value: number) => String(value).padStart(2, '0')

/**
 * The line being typed, what it reads as, and the chips dismissed on it.
 * Without `recognise` (a grocery list, a subtask) the line is only a title.
 * `initial` puts back a line kept from before (the keyboard composer's draft).
 */
export function useQuickAddLine(
  recognise = true,
  initial?: { line: string; dismissed: readonly string[] },
) {
  const { people } = useTaskPeople()
  const [line, setLine] = useState(initial?.line ?? '')
  const [dismissed, setDismissed] = useState<readonly string[]>(
    initial?.dismissed ?? [],
  )
  const at = new Date()
  const today = localIsoDate(at)
  const now = `${pad(at.getHours())}:${pad(at.getMinutes())}`
  const parsed = useMemo(
    (): QuickAdd =>
      recognise
        ? parseQuickAdd(line, { today, now, members: people, dismissed })
        : { title: line.trim(), parts: [], labels: [] },
    [recognise, line, today, now, people, dismissed],
  )
  return {
    line,
    parsed,
    today,
    dismissed,
    setLine: (value: string) => {
      setLine(value)
      // A cleared line starts over: a dismissal was about the words it had.
      if (!value.trim()) setDismissed([])
    },
    /** Puts a line back that could not be added, unless one was typed since. */
    restore: (value: string) => setLine((now) => now || value),
    dismiss: (key: string) => setDismissed((keys) => [...keys, key]),
    reset: () => {
      setLine('')
      setDismissed([])
    },
    /** A whole kept line back, with what was dismissed on it. */
    load: (kept: { line: string; dismissed: readonly string[] }) => {
      setLine(kept.line)
      setDismissed(kept.dismissed)
    },
  }
}

/**
 * The field, with each recognised part on the group's wash. The words are
 * nested `Text` in the input, which iOS draws as one attributed string, so
 * the caret and selection behave as in a plain field.
 */
export function QuickAddInput({
  line,
  parsed,
  group = 'home',
  inputRef,
  style,
  ...props
}: Omit<TextInputProps, 'value' | 'children'> & {
  line: string
  parsed: { parts: readonly { start: number; end: number }[] }
  group?: ModuleGroup
  inputRef?: Ref<ComponentRef<typeof TextInput>>
}) {
  const wash = useTokens(group).tintOf(group).wash
  const segments: { at: number; text: string; part: boolean }[] = []
  let from = 0
  for (const part of parsed.parts) {
    if (part.start > from) {
      segments.push({ at: from, text: line.slice(from, part.start), part: false })
    }
    segments.push({ at: part.start, text: line.slice(part.start, part.end), part: true })
    from = part.end
  }
  if (from < line.length) segments.push({ at: from, text: line.slice(from), part: false })
  return (
    <TextInput ref={inputRef} style={style} {...props}>
      <Text>
        {segments.map((segment) =>
          segment.part ? (
            <Text
              key={segment.at}
              style={[styles.highlight, { backgroundColor: wash }]}
            >
              {segment.text}
            </Text>
          ) : (
            // A background on every run: RN iOS only re-applies the field's
            // text when an attribute it carries differs, and a run with no
            // background (RN drops a clear one) keeps a wash it was typed
            // with. Alpha 0.01 is invisible but still an attribute.
            <Text key={segment.at} style={styles.plain}>
              {segment.text}
            </Text>
          ),
        )}
      </Text>
    </TextInput>
  )
}

const KIND_ICONS: Record<QuickAddKind, (typeof TASK_ICONS)['Tag']> = {
  date: TASK_ICONS.Calendar,
  time: TASK_ICONS.Bell,
  repeat: TASK_ICONS.Repeat,
  member: UI_ICONS.User,
  label: TASK_ICONS.Tag,
}

/** A chip per recognised part, each with a × that dismisses it. */
export function QuickAddChips({
  parsed,
  today,
  onDismiss,
}: {
  parsed: QuickAdd
  today: string
  onDismiss: (key: string) => void
}) {
  const tokens = useTokens('home')
  const { t, locale } = useI18n()
  const words = {
    today: t.tasks.task.today,
    tomorrow: t.tasks.task.tomorrow,
    repeat: t.tasks.repeat.summary,
  }
  const wash = tokens.tintOf('home').wash
  const X = UI_ICONS.X
  return (
    <>
      {parsed.parts.map((part) => {
        const label = quickAddChipLabel(part, parsed, today, locale, words)
        const Icon = KIND_ICONS[part.kind]
        return (
          <View
            key={`${part.key}@${part.start}`}
            style={[styles.chip, { backgroundColor: wash }]}
          >
            <Icon
              size={14}
              color={tokens.ink}
              strokeWidth={2.2}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <Text style={[styles.chipText, { color: tokens.ink }]}>{label}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={fmt(t.tasks.quickAdd.remove, { part: label })}
              hitSlop={8}
              onPress={() => onDismiss(part.key)}
              style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
            >
              <X size={12} color={tokens.muted} strokeWidth={2.6} />
            </Pressable>
          </View>
        )
      })}
    </>
  )
}

const styles = StyleSheet.create({
  highlight: { fontWeight: '600' },
  plain: { fontWeight: '400', backgroundColor: 'rgba(0, 0, 0, 0.01)' },
  chip: {
    minHeight: 32,
    paddingLeft: 10,
    paddingRight: 2,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipText: { ...TYPE.subhead },
  remove: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
})
