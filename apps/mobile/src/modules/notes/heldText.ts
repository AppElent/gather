/**
 * A note's unsaved text, kept on this phone until it is saved (APP-829).
 *
 * Text the note had no room for, or whose save failed, stays on screen; this
 * keeps it past leaving the note and past quitting the app, so it is put back
 * when the note is opened again. Per field, with the texts it was written over:
 * a field someone else has changed since is not overwritten, and the screen
 * says so instead (`NoteScreen.tsx`).
 *
 * In memory first, and in the one key-value store (`expo-sqlite/kv-store`,
 * as `prefs/localPreference.ts` and `convex/lastKnown.ts` use) so a quit does
 * not lose it. Best-effort: a store that will not open or a value that will
 * not parse is memory only. The key names the account, the Group and the note
 * (`draftKey`), and sign-out forgets every one (`forgetHeldNotes`).
 */
import type { NoteText } from './noteText'

/** One field's unsaved text, and the saved texts it may go back over. */
export interface HeldField {
  text: string
  /** The field's text when it was held: the note's, and the one sent. */
  over: string[]
  /**
   * Why the server refused `text`, when it did (APP-970): shown again when the
   * text comes back after a quit, and the text is not sent again until changed.
   * Text held by the phone's own length check is never sent, so has none.
   */
  refused?: string
}

export type HeldNote = Partial<Record<keyof NoteText, HeldField>>

type KvStore = typeof import('expo-sqlite/kv-store').default

const PREFIX = 'gather:notes:held:'
/**
 * Above this many characters of JSON, held text stays in memory only: a write
 * is synchronous, and one refused paste can be megabytes.
 */
export const MAX_STORED_LENGTH = 1_000_000
/**
 * Bumped by sign-out. A screen still open then, or a save answering after it,
 * writes under the session it started in, and that write is dropped.
 */
let session = 0

/** The session a note screen holds text under: read once, when it opens. */
export function heldSession(): number {
  return session
}
const memory = new Map<string, HeldNote>()
const listeners = new Map<string, Set<HeldListener>>()

/** Held text that arrived for an open note, with the sentence to show. */
export type HeldListener = (held: HeldNote, sentence: string | null) => void

let testStore: KvStore | null | undefined
/** Tests only: an in-memory store, `null` for none, `undefined` restores. */
export function setHeldStoreForTests(fake: KvStore | null | undefined) {
  testStore = fake
}

/** Tests only: forgets what is in memory, as a quit does, and keeps the store. */
export function forgetHeldMemoryForTests() {
  memory.clear()
}

/** Loaded on first use, so a Node test run or a missing module is memory only. */
function store(): KvStore | null {
  if (testStore !== undefined) return testStore
  try {
    return require('expo-sqlite/kv-store').default
  } catch {
    return null
  }
}

function isHeld(value: unknown): value is HeldNote {
  if (!value || typeof value !== 'object') return false
  return Object.entries(value).every(
    ([field, held]) =>
      (field === 'title' || field === 'body') &&
      typeof held?.text === 'string' &&
      Array.isArray(held.over) &&
      held.over.every((each: unknown) => typeof each === 'string') &&
      // Kept before APP-970 without one: still put back.
      (held.refused === undefined || typeof held.refused === 'string'),
  )
}

/** Whether text is held for `key` in memory: no disk read, for every save. */
export function holdsText(key: string): boolean {
  return memory.has(key)
}

/** The text held for `key`, if any. */
export function readHeld(key: string): HeldNote | undefined {
  const kept = memory.get(key)
  if (kept) return kept
  try {
    const raw = store()?.getItemSync(PREFIX + key)
    if (!raw) return undefined
    const parsed: unknown = JSON.parse(raw)
    if (!isHeld(parsed) || Object.keys(parsed).length === 0) return undefined
    memory.set(key, parsed)
    return parsed
  } catch {
    return undefined
  }
}

/**
 * Holds `held` for `key`; nothing, or `undefined`, forgets it. `from` is the
 * writer's session: after a sign-out, an older one writes nothing.
 */
export function writeHeld(
  key: string,
  held: HeldNote | undefined,
  from = session,
): void {
  if (from !== session) return
  const empty = !held || Object.keys(held).length === 0
  if (empty) memory.delete(key)
  else memory.set(key, held)
  try {
    const kv = store()
    const json = empty ? '' : JSON.stringify(held)
    if (empty || json.length > MAX_STORED_LENGTH) kv?.removeItemSync(PREFIX + key)
    else kv?.setItemSync(PREFIX + key, json)
  } catch {
    // Memory only: kept until the app quits, as before APP-829.
  }
}

/** `text` of `field` landed: it is no longer held, unless replaced since. */
export function forgetHeldField(
  key: string,
  field: keyof NoteText,
  text: string,
  from = session,
): void {
  const kept = readHeld(key)
  if (kept?.[field]?.text !== text) return
  const { [field]: _landed, ...rest } = kept
  writeHeld(key, rest, from)
}

/**
 * Holds `held` and hands it to the note open for `key`, if one is: a save
 * that failed after its screen closed reaches the screen opened since. A field
 * that screen keeps stays its own; the late text is offered there instead.
 * Returns whether one was open.
 */
export function announceHeld(
  key: string,
  held: HeldNote,
  sentence: string | null,
  from = session,
): boolean {
  if (from !== session) return false
  const open = listeners.get(key)
  const opened = open !== undefined && open.size > 0
  // Into what is kept, not over it: the screen opened since may hold more.
  // A field it holds stays its own (APP-967); the late text is offered there.
  const kept = readHeld(key)
  writeHeld(key, opened ? { ...held, ...kept } : { ...kept, ...held }, from)
  if (!opened) return false
  for (const listener of open) listener(held, sentence)
  return true
}

/** Calls `listener` for held text announced for `key`; returns the unsubscribe. */
export function onHeld(key: string, listener: HeldListener): () => void {
  const open = listeners.get(key) ?? new Set()
  open.add(listener)
  listeners.set(key, open)
  return () => {
    open.delete(listener)
    if (open.size === 0) listeners.delete(key)
  }
}

/** Forgets every note's held text on this phone: sign-out, and tests. */
export function forgetHeldNotes(): void {
  session += 1
  memory.clear()
  try {
    const kv = store()
    for (const key of kv?.getAllKeysSync() ?? [])
      if (key.startsWith(PREFIX)) kv?.removeItemSync(key)
  } catch {
    // Nothing more to forget.
  }
}
