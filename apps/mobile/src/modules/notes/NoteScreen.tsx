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
import { reportError } from '../../observability/report'
import { useRecordRecent } from '../../search/recentRecordsStore'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, TABULAR, TYPE, useTokens } from '../../theme/tokens'
import { draftKey } from '../../ui/composer-drafts'
import { useDebouncedText } from '../../ui/use-debounced-text'
import {
  announceHeld,
  forgetHeldField,
  type HeldNote,
  heldSession,
  holdsText,
  onHeld,
  readHeld,
  writeHeld,
} from './heldText'
import { confirmDeleteNote } from './notesActions'
import { type NoteText, noteWhen, preview, unsavedText } from './noteText'
import { useNote, useNoteActions } from './store'

/** From here on the note says how full it is. */
const COUNT_FROM = NOTE_MAX_CHARS * 0.95

const FIELDS = ['title', 'body'] as const

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

  // Text the note has no room for (APP-805), or whose save failed (APP-829):
  // on screen, not saved. It goes with the next edit that makes it fit, and is
  // kept on this phone until then, past leaving and past a quit (`heldText`).
  const held = useRef<Partial<NoteText>>({})
  /** The saved texts each held field was written over: the note's and the sent. */
  const heldOver = useRef<Partial<Record<keyof NoteText, string[]>>>({})
  /** Kept text put back on opening, with what it may go back over. */
  const restored = useRef<HeldNote>({})
  /** Sent and not yet answered: kept if the screen closes before it lands. */
  const inFlight = useRef<HeldNote>({})
  /** Kept text not put back, because its field changed since. */
  const clash = useRef<HeldNote>({})
  const [clashed, setClashed] = useState<HeldNote>({})
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
  /** The note loaded and its kept text was read: leaving may write it back. */
  const ready = useRef(false)
  const [refused, setRefused] = useState<string | null>(null)

  const { userId } = useAuth()
  const { group } = useGroup()
  const key = draftKey(userId, group._id, `notes:${noteId}`)
  /** After a sign-out, what this screen still writes is dropped. */
  const session = useRef(heldSession())

  function heldNote(): HeldNote {
    const out: HeldNote = { ...clash.current, ...inFlight.current }
    for (const field of FIELDS) {
      const text = held.current[field]
      if (text !== undefined)
        out[field] = { text, over: heldOver.current[field] ?? [] }
    }
    return out
  }
  function keepHeld() {
    writeHeld(key, heldNote(), session.current)
  }
  /** `patch` is unsaved; `saved` and `base` are what it was written over. */
  function holdText(
    patch: Partial<NoteText>,
    saved: NoteText,
    base: NoteText,
    { merge = false } = {},
  ) {
    const next = merge ? { ...patch, ...held.current } : patch
    const over: Partial<Record<keyof NoteText, string[]>> = {}
    for (const field of FIELDS) {
      if (next[field] === undefined) continue
      const text = next[field]
      const was =
        held.current[field] === text ? (heldOver.current[field] ?? []) : []
      // Put back on opening and held again: it still goes over what it did.
      const kept =
        restored.current[field]?.text === text
          ? restored.current[field].over
          : []
      over[field] = [
        ...new Set([...was, ...kept, saved[field], base[field]]),
      ]
    }
    held.current = next
    heldOver.current = over
    keepHeld()
  }

  function save(field: keyof NoteText, next: string) {
    if (!note) return
    const base = { title: note.title, body: note.body }
    const saved = { ...base, ...sent.current }
    const patch = unsavedText(saved, { ...held.current, [field]: next })
    if (Object.keys(patch).length > 0 && isNoteTooLong({ ...saved, ...patch })) {
      holdText(patch, saved, base)
      return false
    }
    const wasHeld = Object.keys(held.current).length > 0
    held.current = {}
    heldOver.current = {}
    // Nothing unsaved: what this phone kept goes.
    if (Object.keys(patch).length === 0) return keepHeld()
    // With a save on its way, it goes when that lands: a close or a quit
    // before then still has it.
    for (const each of FIELDS) {
      const text = patch[each]
      if (text === undefined) continue
      const kept =
        restored.current[each]?.text === text ? restored.current[each].over : []
      inFlight.current = {
        ...inFlight.current,
        [each]: { text, over: [...new Set([...kept, saved[each], base[each]])] },
      }
    }
    if (wasHeld) keepHeld()
    sent.current = { ...sent.current, ...patch }
    // The held text of the other field went along: it is no longer unsaved.
    if (patch.title !== undefined) title.settle(patch.title)
    if (patch.body !== undefined) body.settle(patch.body)
    actions.editNote(note.id, patch).then(
      () => {
        landed(patch)
        if (mounted.current) {
          if (holdsText(key)) keepHeld()
        } else
          for (const each of FIELDS) {
            const text = patch[each]
            if (text !== undefined)
              forgetHeldField(key, each, text, session.current)
          }
      },
      (error: unknown) => {
      landed(patch)
      sent.current = {}
      const sentence = noteRefusalSentence(error, t.notes.refusals)
      // Refused or failed, the text stays: on screen to send again on leaving,
      // and on this phone for the next open (APP-829).
      holdText(patch, saved, base, { merge: true })
      if (!mounted.current)
        announceHeld(key, heldNote(), sentence, session.current)
      else {
        if (patch.title !== undefined) title.hold(patch.title)
        if (patch.body !== undefined) body.hold(patch.body)
        setRefused(sentence ?? t.notes.notSaved)
      }
      if (sentence === null) reportError(error)
      },
    )
  }

  /** `patch` was answered: no longer in flight, unless sent again since. */
  function landed(patch: Partial<NoteText>) {
    const rest = { ...inFlight.current }
    for (const each of FIELDS)
      if (patch[each] !== undefined && rest[each]?.text === patch[each])
        delete rest[each]
    inFlight.current = rest
  }

  const keep = useRef(keepHeld)
  keep.current = keepHeld
  // Declared after the two fields, so their last save has run when it cleans up.
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      // Left before the note loaded: what is kept was never read, so stays.
      if (ready.current) keep.current()
    }
  }, [])
  const loaded = note != null
  const latestNote = useRef(note)
  latestNote.current = note
  const drafts = useRef({ title: title.draft, body: body.draft })
  drafts.current = { title: title.draft, body: body.draft }
  const { change: changeTitle } = title
  const { change: changeBody } = body

  /** Puts kept text back where its field is as it was left; the rest clashes. */
  const restore = useRef(
    (_kept: HeldNote, _sentence: string | null, _opening = false) => {},
  )
  restore.current = (kept, sentence, opening = false) => {
    const now = latestNote.current
    if (!now) return
    const clashes: HeldNote = {}
    for (const field of FIELDS) {
      const each = kept[field]
      if (!each || each.text === now[field]) continue
      // A field someone else has changed since stays theirs, and so does one
      // typed in on this screen; the kept text is offered instead. On opening
      // nothing was typed: the field may not show the note yet.
      const untouched = opening || drafts.current[field] === now[field]
      if (untouched && each.over.includes(now[field])) {
        restored.current = { ...restored.current, [field]: each }
        ;(field === 'title' ? changeTitle : changeBody)(each.text)
      } else clashes[field] = each
    }
    if (Object.keys(clashes).length > 0) {
      clash.current = { ...clash.current, ...clashes }
      setClashed(clash.current)
    }
    if (sentence) setRefused(sentence)
  }
  useEffect(() => {
    if (!loaded) return
    ready.current = true
    const kept = readHeld(key)
    if (kept) restore.current(kept, null, true)
    return onHeld(key, (each, sentence) => restore.current(each, sentence))
  }, [loaded, key])

  function putBack() {
    const kept = clash.current
    clash.current = {}
    setClashed({})
    setRefused(null)
    // Typed back in: it saves, or is held again, as any edit is.
    restored.current = { ...restored.current, ...kept }
    if (kept.title) changeTitle(kept.title.text)
    if (kept.body) changeBody(kept.body.text)
  }
  function discardKept() {
    clash.current = {}
    setClashed({})
    keepHeld()
  }

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
                    when: noteWhen(
                      note.updatedAt,
                      locale,
                      t.notes.today,
                      group.timeZone,
                    ),
                  })
                : fmt(t.notes.editedBy, {
                    when: noteWhen(
                      note.updatedAt,
                      locale,
                      t.notes.today,
                      group.timeZone,
                    ),
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

        {clashed.title || clashed.body ? (
          <View
            style={[
              styles.room,
              { backgroundColor: tokens.surface, borderTopColor: tokens.hair },
            ]}
          >
            <Text
              testID="note-clash"
              accessibilityLiveRegion="polite"
              style={[styles.roomText, { color: tokens.ink }]}
            >
              {t.notes.keptNotPutBack}
            </Text>
            <View style={styles.clashActions}>
              <Pressable
                testID="note-put-back"
                accessibilityRole="button"
                onPress={putBack}
                style={styles.clashAction}
              >
                <Text style={[styles.clashActionText, { color: tokens.accent }]}>
                  {t.notes.putBack}
                </Text>
              </Pressable>
              <Pressable
                testID="note-discard-kept"
                accessibilityRole="button"
                onPress={discardKept}
                style={styles.clashAction}
              >
                <Text style={[styles.clashActionText, { color: tokens.danger }]}>
                  {t.notes.discardKept}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

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
  clashActions: { flexDirection: 'row', gap: 16 },
  clashAction: { minHeight: 44, justifyContent: 'center' },
  clashActionText: { ...TYPE.footnoteStrong },
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
