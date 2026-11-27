import { useSyncExternalStore } from 'react'

/**
 * The text typed into notes and not saved yet. It lives outside the editor, so
 * closing a note, opening another or leaving Notes neither stops a save nor
 * loses the text of one that failed: the note opens on it again.
 *
 * Saves are the phone's (`use-debounced-text.ts`): idle for a moment, on blur
 * and on leaving, and only the fields that changed. One save per note is under
 * way at a time, so two never arrive out of order.
 *
 * Each save names the version its text was typed on (APP-994). When another
 * Member saved over that version, nothing is written: the draft holds a
 * `conflict` until the person keeps theirs, keeps the other or copies theirs.
 */
export const IDLE = 600

export interface NoteFields {
  title?: string
  body?: string
}

export interface NoteText {
  title: string
  body: string
}

/** The saved version a draft's text is typed on. */
export interface NoteBase extends NoteText {
  updatedAt: number
}

/** Another Member's version, as `notes.update` answers a conflict with it. */
export interface TheirNote extends NoteBase {
  updatedByName: string | null
}

/** What `notes.update` answers; a send that answers nothing saved. */
export type SaveResult =
  | { status: 'saved'; updatedAt: number }
  | { status: 'conflict'; note: TheirNote }
  | undefined
  | void

export interface NoteDraft {
  fields: NoteFields
  state: 'waiting' | 'saving' | 'failed' | 'conflict'
  error?: unknown
  /** In `conflict`: the version another Member saved meanwhile. */
  theirs?: TheirNote
}

type Send = (fields: NoteFields, baseUpdatedAt: number) => Promise<SaveResult>

interface Entry {
  draft: NoteDraft
  send: Send
  base: NoteBase
  timer?: ReturnType<typeof setTimeout>
  sending: boolean
  /** The note is being deleted: nothing more is sent. */
  held: boolean
}

const entries = new Map<string, Entry>()
const listeners = new Set<() => void>()

function onBeforeUnload(event: BeforeUnloadEvent) {
  flushAll()
  event.preventDefault()
}

function onHidden() {
  if (document.visibilityState === 'hidden') flushAll()
}

function changed() {
  if (entries.size > 0) {
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('visibilitychange', onHidden)
  } else {
    window.removeEventListener('beforeunload', onBeforeUnload)
    document.removeEventListener('visibilitychange', onHidden)
  }
  for (const listener of listeners) listener()
}

function schedule(key: string, entry: Entry) {
  clearTimeout(entry.timer)
  entry.timer = setTimeout(() => flushDraft(key), IDLE)
}

/**
 * The text of one note as it is now typed; saves once typing pauses. `base` is
 * the note as shown, and counts only for the first change of a draft.
 */
export function changeDraft(
  key: string,
  fields: NoteFields,
  send: Send,
  base: NoteBase,
) {
  const known = entries.get(key)
  const entry: Entry = known ?? {
    draft: { fields: {}, state: 'waiting' },
    send,
    base,
    sending: false,
    held: false,
  }
  entry.send = send
  const theirs = entry.draft.state === 'conflict' ? entry.draft.theirs : undefined
  entry.draft = theirs
    ? { fields: { ...entry.draft.fields, ...fields }, state: 'conflict', theirs }
    : {
        fields: { ...entry.draft.fields, ...fields },
        state: entry.sending ? 'saving' : 'waiting',
      }
  entries.set(key, entry)
  // A conflict waits for the person's choice: nothing is sent meanwhile.
  if (!theirs) schedule(key, entry)
  changed()
}

/** Whether `theirs` changed a field `sent` writes, from the version it was typed on. */
function overlaps(sent: NoteFields, base: NoteText, theirs: NoteText) {
  return (['title', 'body'] as const).some(
    (field) => sent[field] !== undefined && theirs[field] !== base[field],
  )
}

async function save(key: string, entry: Entry) {
  clearTimeout(entry.timer)
  const sent = entry.draft.fields
  const from = entry.base
  entry.sending = true
  entry.draft = { fields: sent, state: 'saving' }
  changed()
  let failure: { error: unknown } | null = null
  let result: SaveResult
  try {
    result = await entry.send(sent, from.updatedAt)
  } catch (error) {
    failure = { error }
  }
  entry.sending = false
  // Deleted or discarded meanwhile.
  if (entries.get(key) !== entry) return
  if (failure) {
    clearTimeout(entry.timer)
    entry.draft = {
      fields: entry.draft.fields,
      state: 'failed',
      error: failure.error,
    }
  } else if (result?.status === 'conflict') {
    const theirs = result.note
    entry.base = {
      title: theirs.title,
      body: theirs.body,
      updatedAt: theirs.updatedAt,
    }
    // They changed only the other field: sent again from their version.
    if (!overlaps(sent, from, theirs)) {
      entry.draft = { fields: entry.draft.fields, state: 'waiting' }
      if (entry.held) changed()
      else void save(key, entry)
      return
    }
    clearTimeout(entry.timer)
    entry.draft = { fields: entry.draft.fields, state: 'conflict', theirs }
  } else {
    entry.base = {
      ...from,
      ...sent,
      updatedAt: result?.updatedAt ?? from.updatedAt,
    }
    const left: NoteFields = { ...entry.draft.fields }
    if (left.title === sent.title) delete left.title
    if (left.body === sent.body) delete left.body
    if (Object.keys(left).length === 0) {
      clearTimeout(entry.timer)
      entries.delete(key)
    } else {
      entry.draft = { fields: left, state: 'waiting' }
      if (!entry.held) schedule(key, entry)
    }
  }
  changed()
}

/** Sends what is waiting, now. A failed save waits for `retryDraft` or typing. */
export function flushDraft(key: string) {
  const entry = entries.get(key)
  if (!entry || entry.held || entry.sending || entry.draft.state !== 'waiting')
    return
  void save(key, entry)
}

export function flushAll() {
  for (const key of [...entries.keys()]) flushDraft(key)
}

export function retryDraft(key: string) {
  const entry = entries.get(key)
  if (
    !entry ||
    entry.held ||
    entry.sending ||
    entry.draft.state === 'conflict'
  )
    return
  void save(key, entry)
}

/**
 * Keep mine: the draft's text is saved over the version that conflicted. The
 * base is already theirs, so this save is not refused for it again.
 */
export function keepMineDraft(key: string) {
  const entry = entries.get(key)
  if (!entry || entry.held || entry.sending || entry.draft.state !== 'conflict')
    return
  entry.draft = { fields: entry.draft.fields, state: 'waiting' }
  void save(key, entry)
}

export function discardDraft(key: string) {
  const entry = entries.get(key)
  if (!entry) return
  clearTimeout(entry.timer)
  entries.delete(key)
  changed()
}

/** Deletes a note with its draft; a refused delete keeps the draft. */
export async function deleteWithDraft(
  key: string,
  remove: () => Promise<unknown>,
) {
  const entry = entries.get(key)
  if (entry) {
    entry.held = true
    clearTimeout(entry.timer)
  }
  try {
    await remove()
  } catch (error) {
    if (entry) {
      entry.held = false
      if (entry.draft.state === 'waiting') schedule(key, entry)
    }
    throw error
  }
  discardDraft(key)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useNoteDraft(key: string): NoteDraft | undefined {
  return useSyncExternalStore(
    subscribe,
    () => entries.get(key)?.draft,
    () => undefined,
  )
}
