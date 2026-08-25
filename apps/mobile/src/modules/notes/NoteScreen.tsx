/**
 * One note, which opens straight into its body.
 *
 * There is no view mode and no edit mode. A note in a household app is opened
 * to change it about as often as it is opened to read it, and a screen that
 * needs an Edit button first has decided otherwise on the reader's behalf.
 * Typing writes; leaving is done.
 *
 * The bar above the keyboard is drawn and not wired, and says so. Whether Notes
 * gets rich text at all is a question about the schema â€” a `body` column holds
 * a string, and Markdown, HTML and a block model are three different products â€”
 * and the taskActions's job is to show what the bar costs in room, not to answer
 * it.
 */
import { MenuView } from '@expo/ui/community/menu'
import { Stack, useRouter } from 'expo-router'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { haptics } from '../../feedback/haptics'
import { fmt, useI18n } from '../../i18n'
import { useRecordRecent } from '../../search/recentRecords'
import { RADIUS, useTokens } from '../../theme/tokens'
import { TASK_ICONS } from '../tasks/icons'
import { taskActions, useTaskState } from '../tasks/store'
import { useDebouncedText } from '../tasks/useDebouncedText'
import { noteWhen } from './NotesScreen'
import { confirmDeleteNote } from './notesActions'

/** Drawn, not wired. The letters are the affordance, not an icon set. */
const FORMATS = ['B', 'I', 'H', 'â€¢', '1.', 'â˜‘'] as const

export function Note({ noteId }: { noteId: string }) {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const { t, locale } = useI18n()
  const router = useRouter()
  const state = useTaskState()

  const note = state.notes.find((each) => each.id === noteId)

  useRecordRecent(
    note
      ? {
          id: note.id,
          type: 'note',
          title: note.title,
          detail:
            note.body
              .split('\n')
              .find((line) => line.trim())
              ?.trim() ?? '',
        }
      : null,
  )

  // A note is the longest thing anybody types in this app, so it is the one
  // that would cost the most in per-keystroke writes â€” see `useDebouncedText`.
  const title = useDebouncedText(note?.title ?? '', (next) => {
    if (note) taskActions.editNote(note.id, { title: next })
  })
  const body = useDebouncedText(note?.body ?? '', (next) => {
    if (note) taskActions.editNote(note.id, { body: next })
  })

  if (!note) return <View style={{ flex: 1, backgroundColor: tokens.bg }} />

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerRight: () => (
            <MenuView
              testID="note-menu"
              actions={[
                {
                  id: 'pin',
                  title: note.pinned ? t.labs.notes.unpin : t.labs.notes.pin,
                  image: 'pin',
                },
                {
                  id: 'delete',
                  title: t.labs.notes.delete,
                  image: 'trash',
                  attributes: { destructive: true },
                },
              ]}
              onPressAction={(event) => {
                const action = event.nativeEvent.event
                if (action === 'pin') {
                  taskActions.togglePin(note.id)
                  haptics.selectionChanged()
                }
                if (action === 'delete') {
                  confirmDeleteNote(note, t, () => router.back())
                }
              }}
            >
              <View style={styles.headerButton}>
                <TASK_ICONS.Ellipsis
                  size={22}
                  color={tokens.fg}
                  strokeWidth={2.2}
                />
              </View>
            </MenuView>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: tokens.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <TextInput
            testID="note-title"
            value={title.draft}
            onChangeText={title.change}
            onBlur={title.flush}
            placeholder={t.labs.notes.titlePlaceholder}
            placeholderTextColor={tokens.muted}
            multiline
            accessibilityLabel={t.labs.notes.titlePlaceholder}
            style={[styles.title, { color: tokens.fg }]}
          />

          <View style={styles.meta}>
            {note.pinned ? (
              <TASK_ICONS.Pin
                size={13}
                color={tokens.muted}
                strokeWidth={2.2}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            ) : null}
            <Text style={[styles.metaText, { color: tokens.muted }]}>
              {fmt(t.labs.notes.editedBy, {
                when: noteWhen(note.updatedAt, locale, t.labs.task.today),
                name: note.updatedBy,
              })}
            </Text>
          </View>

          <TextInput
            testID="note-body"
            value={body.draft}
            onChangeText={body.change}
            onBlur={body.flush}
            placeholder={t.labs.notes.bodyPlaceholder}
            placeholderTextColor={tokens.muted}
            multiline
            accessibilityLabel={t.labs.notes.bodyPlaceholder}
            style={[styles.body, { color: tokens.fg }]}
          />

          <Text style={[styles.footnote, { color: tokens.muted }]}>
            {t.labs.notes.formatting}
          </Text>
        </ScrollView>

        <View
          style={[
            styles.toolbar,
            {
              backgroundColor: tokens.surface,
              borderTopColor: tokens.border,
              paddingBottom: insets.bottom > 0 ? insets.bottom - 8 : 8,
            },
          ]}
        >
          {FORMATS.map((format) => (
            <Pressable
              key={format}
              accessibilityRole="button"
              accessibilityState={{ disabled: true }}
              accessibilityLabel={format}
              disabled
              style={styles.format}
            >
              <Text style={[styles.formatText, { color: tokens.muted }]}>
                {format}
              </Text>
            </Pressable>
          ))}
        </View>
      </KeyboardAvoidingView>
    </>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 10,
  },
  headerButton: { paddingHorizontal: 6, paddingVertical: 6 },
  title: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.6,
    lineHeight: 33,
    padding: 0,
    marginTop: 6,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12.5 },
  body: {
    fontSize: 16,
    lineHeight: 24,
    minHeight: 320,
    padding: 0,
    textAlignVertical: 'top',
  },
  footnote: { fontSize: 12, lineHeight: 17 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  format: {
    minWidth: 44,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.control,
  },
  formatText: { fontSize: 15, fontWeight: '700' },
})
