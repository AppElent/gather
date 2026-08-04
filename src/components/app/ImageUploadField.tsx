import { useEffect, useRef, useState } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
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
 */

interface ImageUploadFieldProps {
  imageUrl: string | null
  onChange: (imageId: Id<'_storage'> | undefined) => void
  generateUploadUrl: () => Promise<string>
  /** Which preparing rules apply — see `photoPresets.ts`. */
  preset: PhotoPresetName
  label?: string
  fieldId?: string
}

export function ImageUploadField({
  imageUrl,
  onChange,
  generateUploadUrl,
  preset,
  label = 'Photo',
  fieldId = 'image-upload',
}: ImageUploadFieldProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [choosing, setChoosing] = useState<File | null>(null)
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
      setError('Could not upload that image')
    } finally {
      setUploading(false)
    }
  }

  const displayUrl = previewUrl ?? imageUrl

  return (
    <div className="mx-auto mb-6 max-w-2xl rounded-xl border p-4">
      <label htmlFor={fieldId} className="mb-2 block text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-3">
        {displayUrl ? (
          <img
            src={displayUrl}
            alt=""
            className="h-20 w-20 rounded-lg object-cover"
          />
        ) : (
          <div className="h-20 w-20 rounded-lg bg-black/5 dark:bg-white/10" />
        )}
        <div>
          <input
            ref={inputRef}
            id={fieldId}
            type="file"
            accept="image/*"
            className="text-sm"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              // Cleared straight away so that choosing the same file again
              // after cancelling still counts as a change.
              e.target.value = ''
              if (file) {
                setError(null)
                setChoosing(file)
              }
            }}
          />
          {uploading && <p className="text-xs opacity-60">Uploading…</p>}
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
              Remove photo
            </button>
          )}
        </div>
      </div>
      {choosing ? (
        <PhotoPrepareDialog
          file={choosing}
          preset={preset}
          onCancel={() => setChoosing(null)}
          onConfirm={(prepared) => {
            setChoosing(null)
            void upload(prepared)
          }}
        />
      ) : null}
    </div>
  )
}
