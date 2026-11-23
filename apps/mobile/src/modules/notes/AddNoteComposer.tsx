/**
 * Starting a note from the Notes screen (APP-588): the add button, and the
 * keyboard composer it opens with a note's one chip. The shell is
 * `ui/keyboard-composer.tsx`; this file is the note's part of it. Design:
 * `designs/tasks/quick-add_final.md`, "Note (APP-588)".
 *
 * - **Title, then body.** Return in the title moves to the body; the body
 *   takes lines of its own, and expanding gives it the whole card.
 * - **One chip, Pin**, a plain toggle. No + button until formatting and images
 *   (APP-345, APP-349) bring more details.
 * - **Saving keeps it open**, empty, with the title focused for the next.
 *   A title or a line of body is enough; an untitled note is shown as one,
 *   as the note screen does.
 * - **A draft survives a close**, per account, Group and place, in memory
 *   (`ui/composer-drafts.ts`), and carries the key `notes.create` dedupes on,
 *   so a second Return or a retry makes one note.
 *
 * Editing a note that exists stays on the note screen.
 */
import { useAuth } from '@clerk/expo'
import { useEffect, useRef, useState } from 'react'
import { TextInput } from 'react-native'

import { haptics } from '../../feedback/haptics'
import { useGroup } from '../../group/GroupProvider'
import { fmt, useI18n } from '../../i18n'
import { showAlert } from '../../observability/native-presentation'
import { UI_ICONS } from '../../theme/icons'
import {
  draftKey,
  forgetSentDraft,
  keepDraft,
  keptDraft,
} from '../../ui/composer-drafts'
import {
  ComposerAddButton,
  type ComposerChip,
  KeyboardComposer,
} from '../../ui/keyboard-composer'
import {
  type ComposedNote,
  composedNote,
  emptyNoteDraft,
  isNoteDirty,
  type NoteDraft,
} from './noteDraft'
import { useNoteActions } from './store'

/**
 * Failed-save alerts, shown one after another: iOS draws one alert at a time,
 * so a second asked while the first is up would be lost with its draft.
 */
let alerts: Promise<void> = Promise.resolve()
function askInTurn(show: (done: () => void) => void): void {
  alerts = alerts.then(() => new Promise<void>((done) => show(done)))
}

/** The add button on Notes, and the composer while it is open. */
export function AddNote() {
  const { t } = useI18n()
  const { group } = useGroup()
  const { userId } = useAuth()
  const [open, setOpen] = useState(false)
  const key = draftKey(userId, group._id, 'notes:index')

  return (
    <>
      {open ? null : (
        <ComposerAddButton
          group="home"
          label={t.composer.addNote}
          onPress={() => setOpen(true)}
          testID="note-new"
        />
      )}
      {open ? (
        <NoteComposerCard
          draftId={key}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}

function NoteComposerCard({
  draftId,
  onClose,
}: {
  draftId: string
  onClose: () => void
}) {
  const { t } = useI18n()
  const words = t.composer
  const actions = useNoteActions()

  const [kept] = useState(() => keptDraft<NoteDraft>(draftId) ?? emptyNoteDraft())
  const [title, setTitle] = useState(kept.title)
  const [body, setBody] = useState(kept.body)
  const [pinned, setPinned] = useState(kept.pinned)
  const [saveKey, setSaveKey] = useState(kept.saveKey)
  const [notice, setNotice] = useState<string | null>(null)
  // The draft last sent: a second Return before the cleared draft renders
  // reaches save with the same draft. The server dedupes on the key as well.
  const submitted = useRef<string | null>(null)
  const mounted = useRef(true)

  const draft: NoteDraft = { title, body, pinned, saveKey }
  const latest = useRef(draft)
  latest.current = draft
  useEffect(
    () => () => {
      mounted.current = false
      const last = latest.current
      keepDraft(draftId, isNoteDirty(last) ? last : undefined)
    },
    [draftId],
  )

  const load = (next: NoteDraft) => {
    latest.current = next
    setTitle(next.title)
    setBody(next.body)
    setPinned(next.pinned)
    setSaveKey(next.saveKey)
  }

  const note = composedNote(draft)

  const landed = (saveKey: string) => {
    // A close mid-save may have kept this draft for the place.
    forgetSentDraft<NoteDraft>(draftId, saveKey)
    haptics.itemSaved()
  }

  /** Whether the open card still shows the draft sent under `saveKey`. */
  const showing = (saveKey: string) =>
    mounted.current && latest.current.saveKey === saveKey

  /**
   * Every failed save is asked about, Try again or Discard, one alert at a
   * time (`askInTurn`): two saves failing together must not lose one. The
   * same key goes again, so a create that did land is not made twice. A note
   * the card still shows is cleared once it is saved or discarded.
   */
  const offerRetry = (saving: ComposedNote, saveKey: string) =>
    askInTurn(
      (done) =>
        showAlert(
          fmt(words.noteNotSaved, { title: saving.title || t.notes.untitled }),
          undefined,
          [
            {
              text: words.discard,
              style: 'destructive',
              onPress: () => {
                forgetSentDraft<NoteDraft>(draftId, saveKey)
                if (showing(saveKey)) clear()
                done()
              },
            },
            {
              text: words.tryAgain,
              onPress: () => {
                done()
                void actions.addComposedNote(saving, saveKey).then(
                  () => {
                    landed(saveKey)
                    if (showing(saveKey)) clear()
                  },
                  () => {
                    haptics.actionFailed()
                    offerRetry(saving, saveKey)
                  },
                )
              },
            },
          ],
          { cancelable: false },
        ),
    )

  const clear = () => {
    setNotice(null)
    load(emptyNoteDraft())
  }

  async function save() {
    if (!note) {
      haptics.actionFailed()
      return
    }
    if (submitted.current === draft.saveKey) return
    const snapshot = draft
    const saving = note
    const { saveKey } = snapshot
    submitted.current = saveKey
    const request = actions.addComposedNote(saving, saveKey)
    setNotice(null)
    // Cleared first: the next note can be typed at once.
    load(emptyNoteDraft())
    try {
      await request
      landed(saveKey)
    } catch {
      haptics.actionFailed()
      submitted.current = null
      if (mounted.current && !isNoteDirty(latest.current)) {
        // Nothing typed since: the note comes back to finish or send again.
        setNotice(words.noteFailed)
        load(snapshot)
      }
      offerRetry(saving, saveKey)
    }
  }

  const pinChip: ComposerChip = {
    id: 'pin',
    label: pinned ? t.notes.pinned : t.notes.pin,
    accessibilityLabel: t.notes.pin,
    set: pinned,
    icon: pinned ? UI_ICONS.PinFill : UI_ICONS.Pin,
    onPress: () => {
      haptics.selectionChanged()
      setPinned((current) => !current)
    },
    testID: 'note-composer-pin',
  }

  return (
    <KeyboardComposer
      testID="note-keyboard-composer"
      group="home"
      onClose={onClose}
      renderTitle={(field) => (
        <TextInput
          testID="note-composer-title"
          ref={field.inputRef}
          editable={field.editable}
          autoFocus
          value={title}
          onChangeText={(value) => {
            setTitle(value)
            setNotice(null)
          }}
          placeholder={t.notes.titlePlaceholder}
          placeholderTextColor={field.placeholderTextColor}
          accessibilityLabel={t.notes.titlePlaceholder}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={field.focusBody}
          style={field.style}
        />
      )}
      body={{
        value: body,
        onChange: (value) => {
          setBody(value)
          setNotice(null)
        },
        visible: true,
        multiline: true,
        placeholder: words.noteBody,
        accessibilityLabel: words.noteBody,
      }}
      chips={[pinChip]}
      allChips={[pinChip]}
      canSave={note !== null}
      onSave={() => void save()}
      notice={notice}
    />
  )
}
