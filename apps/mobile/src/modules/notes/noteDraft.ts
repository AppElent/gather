/**
 * What the note composer (APP-588) holds, and what it saves. Pure, so the
 * rules are tested without a phone: a note needs a title or a line of body,
 * and a draft is kept on close only when something was typed or pinned.
 */
import { newSaveKey } from '../../ui/composer-drafts'

export interface NoteDraft {
  title: string
  body: string
  pinned: boolean
  /**
   * Sent as `notes.create`'s idempotency key: this draft makes one note
   * however often it is sent. A new draft has a new one.
   */
  saveKey: string
}

/** The fields one new note is saved with. */
export interface ComposedNote {
  title: string
  body: string
  pinned: boolean
}

export function emptyNoteDraft(saveKey = newSaveKey()): NoteDraft {
  return { title: '', body: '', pinned: false, saveKey }
}

/**
 * The note a draft saves, or `null` when there is nothing to save. The title
 * is trimmed; the body keeps its lines and loses only blank ones at its ends.
 * An empty title stays empty: the list and the note screen show it as
 * "Untitled note", as they do for one made there.
 */
export function composedNote(draft: NoteDraft): ComposedNote | null {
  const title = draft.title.trim()
  const body = draft.body.replace(/^\s*\n/, '').trimEnd()
  if (!title && !body.trim()) return null
  return { title, body, pinned: draft.pinned }
}

/** Whether closing should keep it: a word typed, or the Pin set. */
export function isNoteDirty(draft: NoteDraft): boolean {
  return Boolean(draft.title.trim() || draft.body.trim() || draft.pinned)
}
