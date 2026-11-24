/**
 * Notes: a list of titled documents.
 *
 * The canvas settled what a note *is* before it settled what it looks like: not
 * a checklist item with a long body, and not a wall of stickies — a document
 * with a title, which is the thing a household actually keeps (the wifi code,
 * the boiler man's instructions, what to pack). That decides this screen. Rows
 * of title + first line + when, in two groups: the ones somebody pinned, and
 * the rest by recency, a page at a time as the list nears its end (APP-730: a
 * virtualized list, so a long history draws only the rows on screen). There is
 * no pull-to-refresh: Convex keeps the list live, and a spinner over live data
 * is theatre (`TaskListScreen` keeps one only for provider-backed lists).
 *
 * New notes start in the keyboard composer behind the add button (APP-588);
 * the note screen is where one is read and edited.
 *
 * Search is the header's magnifying glass: the one search screen with Notes
 * preset (APP-613), not a field of its own.
 *
 * Open question the canvas did not close: whether a note belongs to the Group
 * or to the person who wrote it. Drawn as the Group's, because everything else
 * in Gather is.
 */
import { Stack, useRouter } from 'expo-router'
import { useMemo } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { NativeContextMenu } from '../../components/NativeContextMenu'
import { haptics } from '../../feedback/haptics'
import { useI18n } from '../../i18n'
import { RADIUS, TABULAR, TYPE, useTokens } from '../../theme/tokens'
import { Button } from '../../ui/button'
import { ADD_BUTTON_CLEARANCE } from '../../ui/keyboard-composer'
import { ModuleHeaderButtons } from '../../ui/module-header-buttons'
import { SectionLabel } from '../../ui/section-label'
import { AddNote } from './AddNoteComposer'
import { confirmDeleteNote } from './notesActions'
import { noteWhen, preview } from './noteText'
import { type Note, useNoteActions, useNotesList } from './store'

export function Notes() {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const { t, locale } = useI18n()
  const router = useRouter()
  const { loading, pinned, rest, hasMore, loadingMore, loadMore } =
    useNotesList()
  const actions = useNoteActions()

  const open = (id: string) =>
    router.push({
      pathname: '/all/notes/[noteId]',
      params: { noteId: id },
    })

  // One flat list of section labels and note rows, so the list can virtualize
  // across both groups. A note row knows its place in its group, which is how
  // it draws its slice of the card.
  const rows = useMemo<Row[]>(() => {
    const group = (key: string, label: string, notes: Note[]): Row[] =>
      notes.length === 0
        ? []
        : [
            { kind: 'label', key, label },
            ...notes.map((note, index): Row => ({
              kind: 'note',
              key: note.id,
              note,
              first: index === 0,
              last: index === notes.length - 1,
            })),
          ]
    return [
      ...group('label-pinned', t.notes.pinned, pinned),
      ...group('label-recent', t.notes.recent, rest),
    ]
  }, [pinned, rest, t.notes.pinned, t.notes.recent])

  const renderNote = ({ note, first, last }: NoteRow) => (
    <View
      style={[
        styles.slice,
        { backgroundColor: tokens.surface, borderColor: tokens.hair },
        first && styles.sliceFirst,
        last && styles.sliceLast,
      ]}
    >
      <NativeContextMenu
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
              borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
            },
            pressed && { backgroundColor: tokens.surface2 },
          ]}
        >
          <View style={styles.rowText}>
            <Text style={[styles.noteTitle, { color: tokens.ink }]}>
              {note.title || t.notes.untitled}
            </Text>
            <Text style={[styles.notePreview, { color: tokens.muted }]}>
              {preview(note.body)}
            </Text>
          </View>
          <Text style={[styles.when, { color: tokens.muted }]}>
            {noteWhen(note.updatedAt, locale, t.notes.today)}
          </Text>
        </Pressable>
      </NativeContextMenu>
    </View>
  )

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t.notes.title,
          headerRight: () => (
            <ModuleHeaderButtons
              testID="notes"
              moduleLabel={t.notes.title}
              search="notes"
            />
          ),
        }}
      />
      <FlatList
        testID="notes-list"
        data={loading ? [] : rows}
        keyExtractor={(row) => row.key}
        renderItem={({ item, index }) =>
          item.kind === 'label' ? (
            <View style={[styles.label, index === 0 && styles.labelFirst]}>
              <SectionLabel>{item.label}</SectionLabel>
            </View>
          ) : (
            renderNote(item)
          )
        }
        onEndReached={() => {
          if (hasMore && !loadingMore) loadMore()
        }}
        onEndReachedThreshold={0.5}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.ground }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 + ADD_BUTTON_CLEARANCE },
        ]}
        ListEmptyComponent={
          <View style={styles.gutter}>
            {loading ? (
              <LoadingSkeleton rows={5} label={t.actions.loading} />
            ) : (
              <Text style={[styles.empty, { color: tokens.muted }]}>
                {t.notes.empty}
              </Text>
            )}
          </View>
        }
        ListFooterComponent={
          hasMore && !loading ? (
            <View style={[styles.gutter, styles.more]}>
              <Button
                testID="notes-show-more"
                label={t.notes.showMore}
                variant="secondary"
                busy={loadingMore}
                onPress={loadMore}
              />
            </View>
          ) : undefined
        }
      />
      <AddNote />
    </>
  )
}

type NoteRow = {
  kind: 'note'
  key: string
  note: Note
  first: boolean
  last: boolean
}
type Row = { kind: 'label'; key: string; label: string } | NoteRow

const styles = StyleSheet.create({
  content: { paddingTop: 12 },
  gutter: { paddingHorizontal: 16 },
  more: { paddingTop: 16 },
  label: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  labelFirst: { paddingTop: 0 },
  // A slice of the `Card` look: the hairline on the sides, and on the top and
  // bottom only where the group starts and ends.
  slice: {
    marginHorizontal: 16,
    paddingHorizontal: 14,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sliceFirst: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: RADIUS.card,
    borderTopRightRadius: RADIUS.card,
  },
  sliceLast: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: RADIUS.card,
    borderBottomRightRadius: RADIUS.card,
  },
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
