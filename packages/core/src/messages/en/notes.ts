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
  untitled: 'Untitled note',
  /** A note edited today says so rather than giving the date. */
  today: 'Today',
  showMore: 'Show more notes',
  deleteTitle: 'Delete “{title}”?',
  deleteBody: 'This cannot be undone.',
  /** The web's list and editor (APP-351). */
  web: {
    /** The large title of one note's own page. */
    note: 'Note',
    summary: { one: '{count} note', other: '{count} notes' },
    /** The summary while older notes are not loaded yet. */
    summaryMore: '{count}+ notes',
    summaryPinned: '{count} pinned',
    editedBy: 'Edited by {name} · {when}',
    editedByYou: 'Edited by you · {when}',
    edited: 'Edited · {when}',
    saved: 'Saved',
    notSaved: 'Not saved',
    notSavedBody: 'Your text is still here. {reason}',
    emptyBody: 'Keep what the household looks up again: the wifi code, what to pack.',
    pickTitle: 'Pick a note',
    pickBody: 'It opens here. Typing saves.',
    notFoundBody: 'This note was deleted, or it belongs to another group.',
    backToNotes: 'Back to Notes',
    unsavedText: 'Your text that was not saved',
    discard: 'Discard text',
    searchHint: 'Type at least two letters.',
    searchNone: 'No notes found',
    clearSearch: 'Clear search',
    loadErrorTitle: 'Notes could not be loaded',
    loadErrorBody: 'Check your connection and try again.',
    createFailed: 'The note could not be created. Try again.',
    /** Another Member saved while this person typed (APP-994), as on the phone. */
    conflict: {
      title: 'This note changed',
      changedBy:
        '{name} changed it while you were writing. Nothing was overwritten.',
      changedBySomeone:
        'Someone else changed it while you were writing. Nothing was overwritten.',
      theirs: 'Their version',
      mine: 'Your version',
      keepMine: 'Keep mine',
      keepTheirs: 'Keep theirs',
      copyMine: 'Copy mine to a new note',
      copyFailed: 'Your version could not be copied. It is still here. {reason}',
    },
  },
  /** How much of the room a nearly full note uses: "98,500 of 100,000 characters". */
  length: '{count} of {max} characters',
  /** A refused write, keyed by the kind on the wire; the number is `NOTE_MAX_CHARS`. */
  refusals: {
    'notes:too-long':
      'A note can hold 100,000 characters, title included. Shorten it to save.',
  } satisfies Record<`notes:${NoteRefusalCode}`, string>,
}
