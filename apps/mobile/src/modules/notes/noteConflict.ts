/**
 * What a note screen's edit is built on, and whether another Member's save
 * since then is a real conflict (APP-347). Pure, so the rules are tested
 * without a phone.
 */
import type { NoteText } from './noteText'

/** The saved version this screen's text started from. */
export interface NoteBase extends NoteText {
  updatedAt: number
}

/** Another Member's version, as `notes.update` answers a conflict with it. */
export interface TheirNote extends NoteText {
  updatedAt: number
  updatedByName: string | null
}

/**
 * Whether `theirs` changed a field this edit writes. When they changed only
 * the other one (a title here, the body there), the edit is sent again from
 * their version and nobody is asked.
 */
export function overlaps(
  patch: Partial<NoteText>,
  base: NoteText,
  theirs: NoteText,
): boolean {
  return (['title', 'body'] as const).some(
    (field) => patch[field] !== undefined && theirs[field] !== base[field],
  )
}

/**
 * The version the screen is built on now: the note as it is, once every field
 * shows it. While a field still holds unsaved text the old base stays, so a
 * save of it is checked against what it was typed over.
 */
export function nextBase(
  base: NoteBase | null,
  note: NoteBase,
  shown: NoteText,
): NoteBase {
  if (base === null) return note
  if (shown.title === note.title && shown.body === note.body)
    return note.updatedAt >= base.updatedAt ? note : base
  return base
}
