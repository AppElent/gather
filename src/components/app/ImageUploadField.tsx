import { useEffect, useRef, useState } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
import { useMessages } from '../../lib/i18n'
import type { PhotoPresetName } from '../../lib/photoPresets'
import type { PreparedPhoto } from '../../lib/preparePhoto'
import { PREPARED_PHOTO_TYPE } from '../../lib/preparePhoto'
import { PhotoPrepareDialog } from './PhotoPrepareDialog'

/**
 * The one place in Gather a person's photo becomes a stored blob.
 *
 * Choosing a file starts the framing step and nothing else: no request is made
 * until the person confirms, and abandoning the step uploads nothing at all.
 * What is uploaded is the prepared photo — cropped, shrunk, re-encoded as JPEG,
 * stripped of the EXIF that carried where it was taken — and never the file
 * that was chosen (ADR-0010).
 *
 * How preparing behaves is the preset's business, not this component's and not
 * the call site's. This is handed a preset name and never a dimension, which is
 * what stops four upload sites from becoming four answers.
 *
 * The timing contract with the parent is unchanged and worth restating, because
 * the framing step is a new chance to break it: `onChange` fires with a storage
 * id only once that id exists in Convex, and with `undefined` only when the
 * person clears the photo. A form is never holding an id for a blob that was
 * never uploaded.
 *
 * The `<input type="file">` is visually hidden and driven by a styled
 * `<label htmlFor>` instead of being rendered by the browser (#61). A native
 * file input's width is its UA button plus its "no file chosen" text, in the
 * *browser's* language, and it does not shrink to its container — in Dutch
 * ("Kies bestand geen bestand geselecteerd") that was wide enough to push this
 * card past the viewport and scroll the whole document sideways. Taking the
 * control's width back also takes its wording back, so the field reads the same
 * in every browser and its text lives in the message tree like everything else.
 * Nothing is lost by hiding it: the filename it would show is never the point
 * here, because choosing a file goes straight to the framing step and what is
 * kept afterwards is the preview.
 */

interface ImageUploadFieldProps {
  imageUrl: string | null
  onChange: (imageId: Id<'_storage'> | undefined) => void
  generateUploadUrl: () => Promise<string>
  /** Which preparing rules apply — see `photoPresets.ts`. */
  preset: PhotoPresetName
  /** Overrides the default "Photo" where a caller has a better word for it. */
  label?: string
  fieldId?: string
}

export function ImageUploadField({
  imageUrl,
  onChange,
  generateUploadUrl,
  preset,
  label,
  fieldId = 'image-upload',
}: ImageUploadFieldProps) {
  const image = useMessages().common.image
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [chosenFile, setChosenFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // One owner for the preview's object URL: it is released when it is replaced
  // and when the field goes away, and nowhere else.
  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const upload = async (prepared: PreparedPhoto) => {
    setUploading(true)
    setError(null)
    try {
      const uploadUrl = await generateUploadUrl()
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': PREPARED_PHOTO_TYPE },
        body: prepared.blob,
      })
      if (!res.ok) throw new Error('Upload failed')
      const { storageId } = (await res.json()) as { storageId: Id<'_storage'> }
      // The preview is the blob that was stored, so what the person sees after
      // saving is what they will see when the page is loaded again.
      setPreviewUrl(URL.createObjectURL(prepared.blob))
      onChange(storageId)
    } catch {
      setError(image.failed)
    } finally {
      setUploading(false)
    }
  }

  const displayUrl = previewUrl ?? imageUrl

  return (
    <div className="mx-auto mb-6 max-w-2xl rounded-xl border p-4">
      <label htmlFor={fieldId} className="mb-2 block text-sm font-medium">
        {label ?? image.label}
      </label>
      <div className="flex items-center gap-3">
        {displayUrl ? (
          <img
            src={displayUrl}
            alt=""
            className="h-20 w-20 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="h-20 w-20 shrink-0 rounded-lg bg-black/5 dark:bg-white/10" />
        )}
        <div className="min-w-0 flex-1">
          {/* Visually hidden, not removed: it is still the field, still the
              thing the label above names, and still what a screen reader and a
              keyboard reach. Only its rendering is ours now. */}
          <input
            ref={inputRef}
            id={fieldId}
            type="file"
            accept="image/*"
            className="peer sr-only"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              // Cleared straight away so that choosing the same file again
              // after cancelling still counts as a change.
              e.target.value = ''
              if (file) {
                setError(null)
                setChosenFile(file)
              }
            }}
          />
          <label
            htmlFor={fieldId}
            className="inline-flex max-w-full min-h-9 cursor-pointer items-center truncate rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm font-semibold peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--app-accent)] peer-disabled:cursor-not-allowed peer-disabled:opacity-60"
          >
            {displayUrl ? image.replace : image.choose}
          </label>
          {uploading && <p className="text-xs opacity-60">{image.uploading}</p>}
          {error && (
            <p role="alert" className="text-xs text-red-800">
              {error}
            </p>
          )}
          {displayUrl && !uploading && (
            <button
              type="button"
              className="mt-1 block text-xs underline"
              onClick={() => {
                setPreviewUrl(null)
                onChange(undefined)
                if (inputRef.current) inputRef.current.value = ''
              }}
            >
              {image.remove}
            </button>
          )}
        </div>
      </div>
      {chosenFile ? (
        <PhotoPrepareDialog
          file={chosenFile}
          preset={preset}
          onCancel={() => setChosenFile(null)}
          onConfirm={(prepared) => {
            setChosenFile(null)
            void upload(prepared)
          }}
        />
      ) : null}
    </div>
  )
}
