import type { NoteRefusalCode } from '../../refusals'

export const notes = {
  title: 'Notes',
  newNote: 'New note',
  search: 'Search notes',
  pinned: 'Pinned',
  recent: 'Recent',
  empty: 'No notes yet.',
  titlePlaceholder: 'Title',
  bodyPlaceholder: 'Start writing',
  pin: 'Pin note',
  unpin: 'Unpin note',
  delete: 'Delete note',
  /** How much of the room a nearly full note uses: "98,500 of 100,000 characters". */
  length: '{count} of {max} characters',
  /** A refused write, keyed by the kind on the wire; the number is `NOTE_MAX_CHARS`. */
  refusals: {
    'notes:too-long':
      'A note can hold 100,000 characters, title included. Shorten it to save.',
  } satisfies Record<`notes:${NoteRefusalCode}`, string>,
}
