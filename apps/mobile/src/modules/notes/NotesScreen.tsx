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
 * The field is the second way in, and it filters rather than navigates. An
 * empty result offers no add button, only a way back to everything — the
 * "nothing found" empty state, which is a different thing from "nothing yet"
 * (`apps/mobile/DESIGN_SYSTEM.md`).
 *
 * Open question the canvas did not close: whether a note belongs to the Group
 * or to the person who wrote it. Drawn as the Group's, because everything else
 * in Gather is.
 */
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { NativeContextMenu } from '../../components/NativeContextMenu'
import { SearchField } from '../../components/SearchField'
import { haptics } from '../../feedback/haptics'
import { fmt, useI18n } from '../../i18n'
import { RADIUS, useTokens } from '../../theme/tokens'
import { Card, SectionLabel } from '../tasks/components'
import { TASK_ICONS } from '../tasks/icons'
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
  const [query, setQuery] = useState('')

  const needle = query.trim().toLowerCase()
  const matching = notes.filter(
    (note) =>
      !needle ||
      note.title.toLowerCase().includes(needle) ||
      note.body.toLowerCase().includes(needle),
  )
  const byRecency = [...matching].sort((a, b) => b.updatedAt - a.updatedAt)
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
            android_ripple={{ color: tokens.tile }}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: tokens.surface,
                borderBottomColor: tokens.border,
                borderBottomWidth:
                  index === shown.length - 1 ? 0 : StyleSheet.hairlineWidth,
              },
              pressed && { backgroundColor: tokens.tile },
            ]}
          >
            <View style={styles.rowText}>
              <Text
                numberOfLines={1}
                style={[styles.noteTitle, { color: tokens.fg }]}
              >
                {note.title || t.notes.untitled}
              </Text>
              <Text
                numberOfLines={1}
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
              <TASK_ICONS.Plus size={22} color={tokens.fg} strokeWidth={2.2} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.bg }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder={t.notes.search}
          clearAccessibilityLabel={t.search.clear}
          testID="notes-search"
        />

        {notes.length === 0 ? (
          <Text style={[styles.empty, { color: tokens.muted }]}>
            {t.notes.empty}
          </Text>
        ) : matching.length === 0 ? (
          <View style={styles.notFound}>
            <Text style={[styles.empty, { color: tokens.muted }]}>
              {fmt(t.notes.noMatches, { query: query.trim() })}
            </Text>
            <Pressable
              testID="notes-clear-search"
              accessibilityRole="button"
              accessibilityLabel={t.actions.showAll}
              onPress={() => setQuery('')}
              style={({ pressed }) => [
                styles.clear,
                { borderColor: tokens.border },
                pressed && { backgroundColor: tokens.tile },
              ]}
            >
              <Text style={[styles.clearText, { color: tokens.fg }]}>
                {t.actions.showAll}
              </Text>
            </Pressable>
          </View>
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
  noteTitle: { fontSize: 16, fontWeight: '600' },
  notePreview: { fontSize: 13.5 },
  when: { fontSize: 12.5 },
  empty: { fontSize: 15, textAlign: 'center' },
  notFound: { gap: 14, paddingVertical: 20, alignItems: 'center' },
  clear: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
  },
  clearText: { fontSize: 15, fontWeight: '600' },
})
