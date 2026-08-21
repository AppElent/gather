/**
 * A task list, small enough to sit inside another Module.
 *
 * Baby log is the first Module on the phone, and it needs task lists before
 * Tasks itself exists here — the two checklist cards are ordinary `taskLists`,
 * reusing the Tasks Module rather than inventing a parallel concept. So this is
 * written to be **adopted** by the Tasks Module when it lands, not replaced:
 * it takes a list id and nothing baby-shaped, and it honours provider
 * capabilities the way ADR-0021 requires.
 *
 * A list Gather cannot write to says so and hides its composer, rather than
 * offering an input that fails on submit. Gather never emulates an external
 * write locally.
 */
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { fmt, useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, useTokens } from '../../theme/tokens'
import { BABY_UI_ICONS } from './icons'

export interface ChecklistProps {
  listId: Id<'taskLists'>
  groupSlug: string
  title: string
  /** Composer placeholder — "Add a to-do" reads differently from "Add a question". */
  addLabel: string
  /** False for a provider Gather may only read (ADR-0021). */
  writable: boolean
  readOnlyReason?: string
}

export function Checklist({
  listId,
  groupSlug,
  title,
  addLabel,
  writable,
  readOnlyReason,
}: ChecklistProps) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const tint = tokens.tintOf('home')

  const tasks = useQuery(api.tasks.listByList, { listId, groupSlug })
  const add_ = useMutation(api.tasks.add)
  const toggleDone = useMutation(api.tasks.toggleDone)
  const [draft, setDraft] = useState('')

  async function add() {
    const title = draft.trim()
    if (!title) return
    // Cleared first: the row appears the moment it is accepted, and a second
    // tap cannot submit the same line twice while the write is in flight.
    setDraft('')
    await add_({ listId, groupSlug, title })
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: tokens.muted }]}>
        {title.toUpperCase()}
      </Text>

      <View
        style={[
          styles.card,
          { backgroundColor: tokens.surface, borderColor: tokens.border },
        ]}
      >
        {(tasks ?? []).map((task) => (
          <Pressable
            key={task._id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: task.done, disabled: !writable }}
            accessibilityLabel={task.title}
            disabled={!writable}
            onPress={() => toggleDone({ taskId: task._id, groupSlug })}
            style={({ pressed }) => [
              styles.row,
              { borderBottomColor: tokens.border },
              pressed && styles.pressed,
            ]}
          >
            <View
              style={[
                styles.box,
                {
                  borderColor: task.done ? tint.fg : tokens.border,
                  backgroundColor: task.done ? tint.fg : 'transparent',
                },
              ]}
            >
              {task.done ? (
                <UI_ICONS.Check
                  size={14}
                  color={tokens.surface}
                  strokeWidth={3}
                />
              ) : null}
            </View>
            <Text
              style={[
                styles.taskText,
                {
                  color: task.done ? tokens.muted : tokens.fg,
                  textDecorationLine: task.done ? 'line-through' : 'none',
                },
              ]}
            >
              {task.title}
            </Text>
          </Pressable>
        ))}

        {writable ? (
          <View style={styles.row}>
            <BABY_UI_ICONS.Plus size={17} color={tint.fg} strokeWidth={2.2} />
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={add}
              placeholder={addLabel}
              placeholderTextColor={tokens.muted}
              returnKeyType="done"
              style={[styles.input, { color: tokens.fg }]}
            />
          </View>
        ) : (
          <View style={styles.row}>
            <Text style={[styles.readOnly, { color: tokens.muted }]}>
              {readOnlyReason ?? ''}
            </Text>
          </View>
        )}
      </View>

      {tasks === undefined ? null : tasks.length === 0 && writable ? (
        <Text style={[styles.empty, { color: tokens.muted }]}>
          {t.baby.log.child.checklistEmpty}
        </Text>
      ) : null}
    </View>
  )
}

/** The count shown beside a list's name on the Child's log. */
export function openCount(
  tasks: readonly { done: boolean }[] | undefined,
  template: { one: string; other: string },
): string {
  const open = (tasks ?? []).filter((task) => !task.done).length
  return fmt(open === 1 ? template.one : template.other, { count: open })
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  title: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 50,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
  },
  box: {
    width: 21,
    height: 21,
    borderRadius: 6,
    borderWidth: 1.6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskText: { flex: 1, fontSize: 15.5 },
  input: { flex: 1, fontSize: 15.5, paddingVertical: 12 },
  readOnly: { flex: 1, fontSize: 13, lineHeight: 19, paddingVertical: 10 },
  empty: { fontSize: 14, paddingHorizontal: 2 },
  pressed: { opacity: 0.6 },
})
