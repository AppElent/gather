/**
 * The Add tab's "Add a task": a title, the list it goes on, and a save.
 *
 * It writes to the Current Group, like every other Tasks write, and offers
 * only the lists Gather can write to (`quickAddLists`). The list is asked for
 * rather than defaulted out of sight, for the reason the Drop's `task-new`
 * gives: a task with nowhere visible to live is a task nobody sees again. It
 * is preselected, though, so the common case is still one field and a save.
 *
 * A failed save keeps the title and says so under the button; the launcher is
 * told only about a save that happened.
 */
import { useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { haptics } from '../../feedback/haptics'
import { useI18n } from '../../i18n'
import { RADIUS, useTokens } from '../../theme/tokens'
import { Chip } from './components'
import { quickAddLists, quickAddTarget } from './quickAdd'
import { useTaskActions, useTaskLists } from './store'

export function QuickAddTask({
  onSaved,
}: {
  /** The title that was saved, and the name of the list it went on. */
  onSaved: (title: string, listName: string) => void
}) {
  const tokens = useTokens()
  const { t } = useI18n()
  const text = t.tasks.quickAdd
  const lists = useTaskLists()
  const { addTask } = useTaskActions()
  const [title, setTitle] = useState('')
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  const offered = lists ? quickAddLists(lists) : undefined
  const target = offered ? quickAddTarget(offered, pickedId) : undefined
  const trimmed = title.trim()
  const ready = Boolean(trimmed && target && !saving)

  async function save() {
    if (saving) return
    if (!trimmed || !target) {
      haptics.actionFailed()
      return
    }
    setSaving(true)
    setFailed(false)
    try {
      await addTask(target._id, trimmed)
      haptics.itemSaved()
      setTitle('')
      onSaved(trimmed, target.name)
    } catch {
      haptics.actionFailed()
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.capture}>
      <TextInput
        autoFocus
        value={title}
        onChangeText={(value) => {
          setTitle(value)
          setFailed(false)
        }}
        placeholder={t.tasks.task.titlePlaceholder}
        placeholderTextColor={tokens.muted}
        returnKeyType="done"
        onSubmitEditing={() => void save()}
        editable={!saving}
        style={[
          styles.input,
          {
            color: tokens.fg,
            backgroundColor: tokens.bg,
            borderColor: tokens.border,
          },
        ]}
      />

      {offered === undefined ? (
        <ActivityIndicator
          color={tokens.muted}
          accessibilityLabel={t.actions.loading}
        />
      ) : offered.length === 0 ? (
        <Text style={[styles.note, { color: tokens.muted }]}>
          {text.noList}
        </Text>
      ) : (
        <View style={styles.lists}>
          <Text style={[styles.note, { color: tokens.muted }]}>
            {text.list}
          </Text>
          <View style={styles.chips}>
            {offered.map((list) => (
              <Chip
                key={list._id}
                label={list.name}
                on={list._id === target?._id}
                onPress={() => {
                  haptics.selectionChanged()
                  setPickedId(list._id)
                }}
              />
            ))}
          </View>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={text.save}
        accessibilityState={{ disabled: !ready, busy: saving }}
        onPress={() => void save()}
        disabled={!ready}
        style={({ pressed }) => [
          styles.saveButton,
          { backgroundColor: ready ? tokens.fg : tokens.tile },
          pressed && styles.pressed,
        ]}
      >
        {saving ? (
          <ActivityIndicator color={tokens.bg} />
        ) : (
          <Text
            style={[
              styles.saveLabel,
              { color: ready ? tokens.bg : tokens.muted },
            ]}
          >
            {text.save}
          </Text>
        )}
      </Pressable>

      {failed ? (
        <Text
          accessibilityRole="alert"
          style={[styles.note, { color: tokens.danger }]}
        >
          {text.failed}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  capture: { gap: 8, paddingBottom: 8 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
  },
  lists: { gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  note: { fontSize: 13, lineHeight: 19 },
  saveButton: {
    borderRadius: RADIUS.control,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveLabel: { fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.6 },
})
