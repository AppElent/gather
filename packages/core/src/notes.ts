/**
 * The most a note holds, title and body together (APP-805), counted as
 * JavaScript counts a string, so the phone and the server agree.
 *
 * A note is stored twice, as itself and as `searchText`; at three bytes a
 * character that is 600 kB, inside the 1 MiB a Convex document may be.
 */
export const NOTE_MAX_CHARS = 100_000

export function noteLength(note: { title: string; body: string }): number {
  return note.title.length + note.body.length
}

export function isNoteTooLong(note: { title: string; body: string }): boolean {
  return noteLength(note) > NOTE_MAX_CHARS
}
