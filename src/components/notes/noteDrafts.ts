import { useSyncExternalStore } from 'react'

/**
 * The text typed into notes and not saved yet. It lives outside the editor, so
 * closing a note, opening another or leaving Notes neither stops a save nor
 * loses the text of one that failed: the note opens on it again.
 *
 * Saves are the phone's (`use-debounced-text.ts`): idle for a moment, on blur
 * and on leaving, and only the fields that changed. One save per note is under
 * way at a time, so two never arrive out of order.
 */
export const IDLE = 600

export interface NoteFields {
  title?: string
  body?: string
}

export interface NoteDraft {
  fields: NoteFields
  state: 'waiting' | 'saving' | 'failed'
  error?: unknown
}

type Send = (fields: NoteFields) => Promise<unknown>

interface Entry {
  draft: NoteDraft
  send: Send
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

/** The text of one note as it is now typed; saves once typing pauses. */
export function changeDraft(key: string, fields: NoteFields, send: Send) {
  const known = entries.get(key)
  const entry: Entry = known ?? {
    draft: { fields: {}, state: 'waiting' },
    send,
    sending: false,
    held: false,
  }
  entry.send = send
  entry.draft = {
    fields: { ...entry.draft.fields, ...fields },
    state: entry.sending ? 'saving' : 'waiting',
  }
  entries.set(key, entry)
  schedule(key, entry)
  changed()
}

async function save(key: string, entry: Entry) {
  clearTimeout(entry.timer)
  const sent = entry.draft.fields
  entry.sending = true
  entry.draft = { fields: sent, state: 'saving' }
  changed()
  let failure: { error: unknown } | null = null
  try {
    await entry.send(sent)
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
  } else {
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
  if (!entry || entry.held || entry.sending) return
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
