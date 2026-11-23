/**
 * The keyboard composer's drafts (APP-587): what was typed and chosen when it
 * closed without saving, kept per place until it saves or the app is killed.
 *
 * In memory only, by design (designs/tasks/quick-add_final.md, Build notes):
 * a draft is for an accidental close, not a document. The key names the
 * account, the Group and the place it was opened from, so a draft never
 * reappears for someone else or in another Group ([editors](../../../../docs/standards/editors.md)).
 */
const drafts = new Map<string, unknown>()

/**
 * A save still on its way for a place's kept draft, answering whether it
 * landed. A composer reopened on that draft waits for it rather than letting
 * the same draft be edited and sent again under the key already in flight.
 */
const pending = new Map<string, Promise<boolean>>()

/**
 * A key no other draft on this phone has, sent as a create's idempotency key
 * so a draft saves one row however often it is sent. The server needs 8 to
 * 100 characters.
 */
export function newSaveKey(): string {
  return `composer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

export function draftKey(
  account: string | null | undefined,
  group: string,
  place: string,
): string {
  return `${account ?? 'signed-out'}:${group}:${place}`
}

/** The draft kept for `key`, if one is. */
export function keptDraft<T>(key: string): T | undefined {
  return drafts.get(key) as T | undefined
}

/** Keeps `draft` for `key`; `undefined` forgets it (saved, or nothing typed). */
export function keepDraft<T>(key: string, draft: T | undefined): void {
  if (draft === undefined) drafts.delete(key)
  else drafts.set(key, draft)
}

/**
 * Forgets `key`'s draft once the draft sent under `saveKey` is done with:
 * saved, or discarded after it failed. A close mid-save kept it, and reopening
 * must bring back neither a task already made nor one thrown away. A newer
 * draft kept since stays.
 */
export function forgetSentDraft<T extends { saveKey: string }>(
  key: string,
  saveKey: string,
): void {
  if (keptDraft<T>(key)?.saveKey === saveKey) drafts.delete(key)
}

/** Marks `key`'s draft as being saved until `saving` settles. */
export function holdDraft(key: string, saving: Promise<boolean>): void {
  pending.set(key, saving)
  const release = () => {
    if (pending.get(key) === saving) pending.delete(key)
  }
  saving.then(release, release)
}

/** The save `key`'s draft is waiting on, if one is. */
export function pendingSave(key: string): Promise<boolean> | undefined {
  return pending.get(key)
}

/** Forgets every draft and every pending save, for tests. */
export function forgetDrafts(): void {
  drafts.clear()
  pending.clear()
}
