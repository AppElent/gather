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
