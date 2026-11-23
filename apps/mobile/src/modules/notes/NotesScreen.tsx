/**
 * Notes: a list of titled documents.
 *
 * The canvas settled what a note *is* before it settled what it looks like: not
 * a checklist item with a long body, and not a wall of stickies — a document
 * with a title, which is the thing a household actually keeps (the wifi code,
 * the boiler man's instructions, what to pack). That decides this screen. Rows
 * of title + first line + when, in two groups: the ones somebody pinned, and
 * the rest by recency.
 *
 * Search is the header's magnifying glass: the one search screen with Notes
 * preset (APP-613), not a field of its own.
 *
 * Open question the canvas did not close: whether a note belongs to the Group
 * or to the person who wrote it. Drawn as the Group's, because everything else
 * in Gather is.
 */
import { Stack, useRouter } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { NativeContextMenu } from '../../components/NativeContextMenu'
import { haptics } from '../../feedback/haptics'
import { useI18n } from '../../i18n'
import { ModuleHeaderActions } from '../../search/ModuleSearchButton'
import { UI_ICONS } from '../../theme/icons'
import { TABULAR, TYPE, useTokens } from '../../theme/tokens'
import { Card } from '../../ui/card'
import { SectionLabel } from '../../ui/section-label'
import { confirmDeleteNote } from './notesActions'
import { noteWhen, preview } from './noteText'
import { type Note, useNoteActions, useNotes } from './store'

export function Notes() {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const { t, locale } = useI18n()
  const router = useRouter()
  const notes = useNotes()
  const actions = useNoteActions()
  const byRecency = [...notes].sort((a, b) => b.updatedAt - a.updatedAt)
  const pinned = byRecency.filter((note) => note.pinned)
  const rest = byRecency.filter((note) => !note.pinned)

  const open = (id: string) =>
    router.push({
      pathname: '/all/notes/[noteId]',
      params: { noteId: id },
    })

  const rows = (shown: Note[]) => (
    <Card>
      {shown.map((note, index) => (
        <NativeContextMenu
          key={note.id}
          actions={[
            {
              id: 'pin',
              title: note.pinned ? t.notes.unpin : t.notes.pin,
              image: 'pin',
            },
            {
              id: 'delete',
              title: t.notes.delete,
              image: 'trash',
              attributes: { destructive: true },
            },
          ]}
          onAction={(action) => {
            if (action === 'pin') {
              actions.togglePin(note)
              haptics.selectionChanged()
            }
            if (action === 'delete') {
              confirmDeleteNote(note, t, () => actions.deleteNote(note.id))
            }
          }}
        >
          <Pressable
            testID={`note-${note.id}`}
            accessibilityRole="button"
            accessibilityLabel={note.title || t.notes.untitled}
            onPress={() => open(note.id)}
            android_ripple={{ color: tokens.surface2 }}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: tokens.surface,
                borderBottomColor: tokens.hair,
                borderBottomWidth:
                  index === shown.length - 1 ? 0 : StyleSheet.hairlineWidth,
              },
              pressed && { backgroundColor: tokens.surface2 },
            ]}
          >
            <View style={styles.rowText}>
              <Text
                style={[styles.noteTitle, { color: tokens.ink }]}
              >
                {note.title || t.notes.untitled}
              </Text>
              <Text
                style={[styles.notePreview, { color: tokens.muted }]}
              >
                {preview(note.body)}
              </Text>
            </View>
            <Text style={[styles.when, { color: tokens.muted }]}>
              {noteWhen(note.updatedAt, locale, t.notes.today)}
            </Text>
          </Pressable>
        </NativeContextMenu>
      ))}
    </Card>
  )

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t.notes.title,
          headerRight: () => (
            <ModuleHeaderActions module="notes">
              <Pressable
                testID="note-new"
                accessibilityRole="button"
                accessibilityLabel={t.notes.newNote}
                hitSlop={12}
                onPress={async () => {
                  const id = await actions.addNote()
                  haptics.itemSaved()
                  open(id)
                }}
                style={styles.headerButton}
              >
                <UI_ICONS.Plus size={22} color={tokens.ink} strokeWidth={2.2} />
              </Pressable>
            </ModuleHeaderActions>
          ),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.ground }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        {notes.length === 0 ? (
          <Text style={[styles.empty, { color: tokens.muted }]}>
            {t.notes.empty}
          </Text>
        ) : (
          <>
            {pinned.length > 0 ? (
              <View style={styles.group}>
                <SectionLabel>{t.notes.pinned}</SectionLabel>
                {rows(pinned)}
              </View>
            ) : null}
            {rest.length > 0 ? (
              <View style={styles.group}>
                <SectionLabel>{t.notes.recent}</SectionLabel>
                {rows(rest)}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 16 },
  headerButton: { paddingHorizontal: 6, paddingVertical: 6 },
  group: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 62,
    marginHorizontal: -14,
    paddingHorizontal: 14,
  },
  rowText: { flex: 1, gap: 3, paddingVertical: 10 },
  noteTitle: { ...TYPE.bodyStrong },
  notePreview: { ...TYPE.footnote },
  when: { ...TYPE.footnote, ...TABULAR },
  empty: { ...TYPE.subhead, textAlign: 'center' },
})
