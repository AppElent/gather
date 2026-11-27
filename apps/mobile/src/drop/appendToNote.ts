/**
 * Appending a Drop to a note without losing a housemate's edit (APP-999).
 *
 * The append sends the `updatedAt` the picker showed as its base. If somebody
 * else saved the note since, `notes.update` writes nothing and answers with the
 * note as it is now, so the Drop goes onto that newest body instead. A Drop
 * only ever adds to the end, so there is nothing for the person to choose
 * between and no reason to ask.
 */
import { appendedBody } from './drop'

/** What `notes.update` answers, as far as an append cares. */
export type NoteUpdateResult =
  | { status: 'saved'; updatedAt: number }
  | { status: 'conflict'; note: { body: string; updatedAt: number } }

export interface NoteVersion {
  body: string
  /** Left out by a caller that read no version; the last write then wins. */
  updatedAt?: number
}

/**
 * How many times a busy note is re-read before giving up. Each conflict means
 * someone else saved in the moment between two round-trips, so a third in a
 * row is a note being typed in right now; the person is told and can retry.
 */
const ATTEMPTS = 3

/** Thrown when every attempt met a newer version. */
export class NoteAppendConflict extends Error {
  constructor() {
    super('The note kept changing while the Drop was added')
    this.name = 'NoteAppendConflict'
  }
}

export async function appendToNote(
  write: (args: {
    body: string
    baseUpdatedAt?: number
  }) => Promise<NoteUpdateResult>,
  note: NoteVersion,
  text: string,
): Promise<void> {
  let base = note
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const result = await write({
      body: appendedBody(base.body, text),
      baseUpdatedAt: base.updatedAt,
    })
    if (result.status === 'saved') return
    base = result.note
  }
  throw new NoteAppendConflict()
}
