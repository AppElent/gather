/**
 * Which uploads a draft has already started (APP-672, APP-734).
 *
 * A form reopened on a kept draft takes up the upload its closed row started,
 * landed or not, instead of storing the photo twice and leaving the first copy
 * with no row. That reuse belongs to the draft: the uploads are kept under the
 * draft's key and forgotten with it (`keepDraft(key, undefined)`), so a new or
 * discarded draft never takes up an upload from an earlier one.
 *
 * No native imports: the draft store calls `forgetUploads`.
 */
const scopes = new Map<string, Map<string, Promise<string>>>()

/**
 * The upload of `uri` within `scope`: the one already started, or `start()`.
 * A failed upload is forgotten, so asking again sends it again.
 */
export function uploadOnce(
  scope: string,
  uri: string,
  start: () => Promise<string>,
): Promise<string> {
  let own = scopes.get(scope)
  const started = own?.get(uri)
  if (started) return started
  if (!own) {
    own = new Map()
    scopes.set(scope, own)
  }
  const mine = own
  const upload = start()
  mine.set(uri, upload)
  upload.catch(() => {
    if (mine.get(uri) === upload) mine.delete(uri)
  })
  return upload
}

/** The draft is gone (saved, discarded): its uploads are nobody's to take up. */
export function forgetUploads(scope: string): void {
  scopes.delete(scope)
}

/** Forgets every scope, for tests. */
export function forgetAllUploads(): void {
  scopes.clear()
}
