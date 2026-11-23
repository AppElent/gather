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
import { NativeSheet } from '../../components/NativeSheet'
import { api, type Id } from '../../convex/api'
import { useI18n } from '../../i18n'
import { RADIUS, TYPE, useTokens } from '../../theme/tokens'
import { useSheetDraft } from '../../ui/sheet-drafts'

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

  // A share keeps the line (APP-622), per Child and list kind.
  const draft = useSheetDraft<{ title: string }>(
    `baby-log:list:${babyId}:${kind}`,
  )
  const [title, setTitle] = useState(draft.kept?.title ?? '')
  const [saving, setSaving] = useState(false)
  draft.track({ title }, { holding: saving })
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
      if (!draft.gone()) onClose()
    } catch {
      draft.failed()
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
            { backgroundColor: ready ? tokens.accent : tokens.surface2 },
            (pressed || saving) && styles.pressed,
          ]}
        >
          {saving ? (
            <ActivityIndicator color={tokens.onAccent} />
          ) : (
            <Text
              style={[
                styles.saveText,
                { color: ready ? tokens.onAccent : tokens.muted },
              ]}
            >
              {t.common.actions.save}
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
              borderColor: tokens.hair,
              backgroundColor: tokens.ground,
              color: tokens.ink,
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
    ...TYPE.body,
    minHeight: 52,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    paddingHorizontal: 14,
  },
  error: { ...TYPE.subhead },
  save: {
    minHeight: 52,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveText: { ...TYPE.bodyStrong },
  pressed: { opacity: 0.7 },
})
