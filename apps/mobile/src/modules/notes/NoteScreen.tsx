/**
 * One note, which opens straight into its body.
 *
 * There is no view mode and no edit mode. A note in a household app is opened
 * to change it about as often as it is opened to read it, and a screen that
 * needs an Edit button first has decided otherwise on the reader's behalf.
 * Typing writes; leaving is done.
 *
 * The bar above the keyboard is drawn and not wired, and says so. Whether Notes
 * gets rich text at all is a question about the schema — a `body` column holds
 * a string, and Markdown, HTML and a block model are three different products.
 */
import { useAuth } from '@clerk/expo'
import { MenuView } from '@expo/ui/community/menu'
import {
  isNoteTooLong,
  NOTE_MAX_CHARS,
  noteLength,
} from '@gather/core/notes'
import { noteRefusalSentence } from '@gather/core/refusals'
import { Stack, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
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
import { useGroup } from '../../group/GroupProvider'
import { fmt, useI18n } from '../../i18n'
import { useRecordRecent } from '../../search/recentRecordsStore'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, TABULAR, TYPE, useTokens } from '../../theme/tokens'
import { draftKey, keepDraft, keptDraft } from '../../ui/composer-drafts'
import { useDebouncedText } from '../../ui/use-debounced-text'
import { confirmDeleteNote } from './notesActions'
import { type NoteText, noteWhen, preview, unsavedText } from './noteText'
import { useNote, useNoteActions } from './store'

/** From here on the note says how full it is. */
const COUNT_FROM = NOTE_MAX_CHARS * 0.95

/** Refused text kept for a reopen, and the note it was written over. */
interface HeldDraft {
  text: Partial<NoteText>
  over: NoteText
}

/** Drawn, not wired. The letters are the affordance, not an icon set. */
const FORMATS = ['B', 'I', 'H', '•', '1.', '☑'] as const

export function Note({ noteId }: { noteId: string }) {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const { t, locale } = useI18n()
  const router = useRouter()
  const actions = useNoteActions()
  const note = useNote(noteId)

  useRecordRecent(
    note
      ? {
          id: note.id,
          type: 'note',
          title: note.title,
          detail: preview(note.body),
        }
      : null,
  )

  // A note is the longest thing anybody types in this app, so it is the one
  // that would cost the most in per-keystroke writes — see `useDebouncedText`.
  const title = useDebouncedText(note?.title ?? '', (next) =>
    save('title', next),
  )
  const body = useDebouncedText(note?.body ?? '', (next) => save('body', next))

  // Text the note has no room for (APP-805): on screen, not saved. It goes with
  // the next edit that makes it fit, and is kept for when the note is reopened.
  const held = useRef<Partial<NoteText>>({})
  /** What the held text was written over. */
  const heldOver = useRef<NoteText | null>(null)
  /** Sent, and not yet in `note`: the next save is compared with it too. */
  const sent = useRef<Partial<NoteText>>({})
  const seen = useRef(note)
  if (seen.current !== note) {
    if (
      seen.current?.title !== note?.title ||
      seen.current?.body !== note?.body
    )
      sent.current = {}
    seen.current = note
  }
  const mounted = useRef(false)
  const [refused, setRefused] = useState<string | null>(null)

  const { userId } = useAuth()
  const { group } = useGroup()
  const key = draftKey(userId, group._id, `notes:${noteId}`)

  function holdText(patch: Partial<NoteText>, over: NoteText) {
    if (Object.keys(held.current).length === 0) heldOver.current = over
    held.current = patch
  }
  function keepHeld() {
    keepDraft<HeldDraft>(
      key,
      Object.keys(held.current).length > 0 && heldOver.current
        ? { text: held.current, over: heldOver.current }
        : undefined,
    )
  }

  function save(field: keyof NoteText, next: string) {
    if (!note) return
    const saved = { title: note.title, body: note.body, ...sent.current }
    const patch = unsavedText(saved, { ...held.current, [field]: next })
    if (Object.keys(patch).length > 0 && isNoteTooLong({ ...saved, ...patch })) {
      holdText(patch, saved)
      return false
    }
    held.current = {}
    if (Object.keys(patch).length === 0) return
    sent.current = { ...sent.current, ...patch }
    // The held text of the other field went along: it is no longer unsaved.
    if (patch.title !== undefined) title.settle(patch.title)
    if (patch.body !== undefined) body.settle(patch.body)
    actions.editNote(note.id, patch).catch((error: unknown) => {
      sent.current = {}
      const sentence = noteRefusalSentence(error, t.notes.refusals)
      if (sentence === null) throw error
      holdText(patch, saved)
      if (!mounted.current) return keepHeld()
      if (patch.title !== undefined) title.hold(patch.title)
      if (patch.body !== undefined) body.hold(patch.body)
      setRefused(sentence)
    })
  }

  const keep = useRef(keepHeld)
  keep.current = keepHeld
  // Declared after the two fields, so their last save has run when it cleans up.
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      keep.current()
    }
  }, [])
  const loaded = note != null
  const latestNote = useRef(note)
  latestNote.current = note
  const { change: changeTitle } = title
  const { change: changeBody } = body
  useEffect(() => {
    const now = latestNote.current
    if (!loaded || !now) return
    const kept = keptDraft<HeldDraft>(key)
    if (!kept) return
    // A field someone else has changed since stays theirs.
    const { text, over } = kept
    if (text.title !== undefined && now.title === over.title)
      changeTitle(text.title)
    if (text.body !== undefined && now.body === over.body) changeBody(text.body)
  }, [loaded, key, changeTitle, changeBody])

  if (!note) return <View style={{ flex: 1, backgroundColor: tokens.ground }} />

  const text = { title: title.draft, body: body.draft }
  const length = noteLength(text)
  const problem =
    isNoteTooLong(text) && Object.keys(unsavedText(note, text)).length > 0
      ? t.notes.refusals['notes:too-long']
      : refused

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
              onPressAction={(event) => {
                const action = event.nativeEvent.event
                if (action === 'pin') {
                  actions.togglePin(note)
                  haptics.selectionChanged()
                }
                if (action === 'delete') {
                  confirmDeleteNote(note, t, () => {
                    actions.deleteNote(note.id)
                    router.back()
                  })
                }
              }}
            >
              <View style={styles.headerButton}>
                <UI_ICONS.Ellipsis
                  size={22}
                  color={tokens.ink}
                  strokeWidth={2.2}
                />
              </View>
            </MenuView>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: tokens.ground }}
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
            onChangeText={(next) => {
              setRefused(null)
              title.change(next)
            }}
            onBlur={title.flush}
            placeholder={t.notes.titlePlaceholder}
            placeholderTextColor={tokens.muted}
            multiline
            accessibilityLabel={t.notes.titlePlaceholder}
            style={[styles.title, { color: tokens.ink }]}
          />

          <View style={styles.meta}>
            {note.pinned ? (
              <UI_ICONS.Pin
                size={13}
                color={tokens.muted}
                strokeWidth={2.2}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            ) : null}
            <Text style={[styles.metaText, { color: tokens.muted }]}>
              {note.updatedByMe || note.updatedByName === null
                ? fmt(note.updatedByMe ? t.notes.editedByYou : t.notes.edited, {
                    when: noteWhen(note.updatedAt, locale, t.notes.today),
                  })
                : fmt(t.notes.editedBy, {
                    when: noteWhen(note.updatedAt, locale, t.notes.today),
                    name: note.updatedByName,
                  })}
            </Text>
          </View>

          <TextInput
            testID="note-body"
            value={body.draft}
            onChangeText={(next) => {
              setRefused(null)
              body.change(next)
            }}
            onBlur={body.flush}
            placeholder={t.notes.bodyPlaceholder}
            placeholderTextColor={tokens.muted}
            multiline
            accessibilityLabel={t.notes.bodyPlaceholder}
            style={[styles.body, { color: tokens.ink }]}
          />

          <Text style={[styles.footnote, { color: tokens.muted }]}>
            {t.notes.formatting}
          </Text>
        </ScrollView>

        {problem || length >= COUNT_FROM ? (
          <View
            style={[
              styles.room,
              { backgroundColor: tokens.surface, borderTopColor: tokens.hair },
            ]}
          >
            {problem ? (
              <Text
                testID="note-problem"
                accessibilityLiveRegion="polite"
                style={[styles.roomText, { color: tokens.danger }]}
              >
                {problem}
              </Text>
            ) : null}
            <Text
              testID="note-length"
              style={[
                styles.roomText,
                TABULAR,
                { color: problem ? tokens.danger : tokens.muted },
              ]}
            >
              {fmt(t.notes.length, {
                count: length.toLocaleString(locale),
                max: NOTE_MAX_CHARS.toLocaleString(locale),
              })}
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.toolbar,
            {
              backgroundColor: tokens.surface,
              borderTopColor: tokens.hair,
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
    ...TYPE.title2,
    letterSpacing: -0.6,
    padding: 0,
    marginTop: 6,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { ...TYPE.footnote },
  body: {
    ...TYPE.body,
    minHeight: 320,
    padding: 0,
    textAlignVertical: 'top',
  },
  footnote: { ...TYPE.footnote },
  room: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  roomText: { ...TYPE.footnote },
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
    borderRadius: RADIUS.pill,
  },
  formatText: { ...TYPE.bodyStrong },
})
