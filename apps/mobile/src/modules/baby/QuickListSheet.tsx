/**
 * Adding a to-do or a question from the log bar, without leaving the log.
 *
 * These are not log entries — nothing happened, and nothing goes in the
 * timeline. They are the two things a parent thinks of *while* logging ("ask
 * about the rash", "buy size 3") and would otherwise have to navigate two
 * screens away to write down, by which time they have forgotten. So they sit at
 * the end of the log bar behind a divider: same reach, visibly not the same
 * kind of thing.
 *
 * One field and a save. A to-do with a due date and a priority is what the
 * Tasks module is for; this is for catching a thought.
 *
 * A Child seeded or created before the lists existed has neither, so the save
 * asks the server to fill them in first. On *save* rather than on open: a sheet
 * somebody opened and closed again should not leave two empty lists behind.
 */
import { useMutation } from 'convex/react'
import { useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { NativeSheet } from '../../components/NativeSheet'
import { useI18n } from '../../i18n'
import { RADIUS, useTokens } from '../../theme/tokens'

export type QuickListKind = 'todo' | 'question'

export interface QuickListSheetProps {
  kind: QuickListKind
  babyId: Id<'babies'>
  /** Absent when the Child has no such list yet; the save makes one. */
  listId: Id<'taskLists'> | undefined
  groupSlug: string
  childName: string
  onClose: () => void
}

export function QuickListSheet({
  kind,
  babyId,
  listId,
  groupSlug,
  childName,
  onClose,
}: QuickListSheetProps) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const add = useMutation(api.tasks.add)
  const ensureLists = useMutation(api.babies.ensureAuxLists)

  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  const text = t.baby.log.quickLog
  const heading = kind === 'todo' ? text.addTodo : text.addQuestion
  const placeholder =
    kind === 'todo' ? text.todoPlaceholder : text.questionPlaceholder
  const ready = title.trim().length > 0

  async function save() {
    if (!ready) return
    setSaving(true)
    setFailed(false)
    try {
      const target =
        listId ??
        (await ensureLists({ id: babyId, groupSlug }))[
          kind === 'todo' ? 'taskListId' : 'questionsListId'
        ]
      await add({ listId: target, groupSlug, title: title.trim() })
      onClose()
    } catch {
      setFailed(true)
      setSaving(false)
    }
  }

  return (
    <NativeSheet
      title={heading}
      subtitle={childName}
      onClose={onClose}
      maxHeight={0.6}
      footer={
        <Pressable
          accessibilityRole="button"
          disabled={!ready || saving}
          onPress={save}
          style={({ pressed }) => [
            styles.save,
            { backgroundColor: ready ? tokens.accent : tokens.tile },
            (pressed || saving) && styles.pressed,
          ]}
        >
          {saving ? (
            <ActivityIndicator color={tokens.surface} />
          ) : (
            <Text
              style={[
                styles.saveText,
                { color: ready ? tokens.surface : tokens.muted },
              ]}
            >
              {t.actions.save}
            </Text>
          )}
        </Pressable>
      }
    >
      <View style={styles.body}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          autoFocus
          placeholder={placeholder}
          placeholderTextColor={tokens.muted}
          returnKeyType="done"
          onSubmitEditing={save}
          accessibilityLabel={heading}
          style={[
            styles.field,
            {
              borderColor: tokens.border,
              backgroundColor: tokens.bg,
              color: tokens.fg,
            },
          ]}
        />
        {failed ? (
          <Text style={[styles.error, { color: tokens.danger }]}>
            {text.addFailed}
          </Text>
        ) : null}
      </View>
    </NativeSheet>
  )
}

const styles = StyleSheet.create({
  body: { gap: 12, paddingBottom: 14 },
  field: {
    minHeight: 52,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  error: { fontSize: 14, lineHeight: 20 },
  save: {
    minHeight: 52,
    borderRadius: RADIUS.control,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveText: { fontSize: 16.5, fontWeight: '700' },
  pressed: { opacity: 0.7 },
})
