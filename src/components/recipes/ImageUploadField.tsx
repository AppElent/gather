import { useMutation } from 'convex/react'
import { useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

interface ImageUploadFieldProps {
  spaceSlug: string
  imageUrl: string | null
  onChange: (imageId: Id<'_storage'> | undefined) => void
}

export function ImageUploadField({
  spaceSlug,
  imageUrl,
  onChange,
}: ImageUploadFieldProps) {
  const generateUploadUrl = useMutation(api.recipes.generateUploadUrl)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const uploadUrl = await generateUploadUrl({ spaceSlug })
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!res.ok) throw new Error('Upload failed')
      const { storageId } = (await res.json()) as { storageId: Id<'_storage'> }
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(file)
      })
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
      <label
        htmlFor="recipe-image-upload"
        className="mb-2 block text-sm font-medium"
      >
        Photo
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
            id="recipe-image-upload"
            type="file"
            accept="image/*"
            className="text-sm"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
          {uploading && <p className="text-xs opacity-60">Uploading…</p>}
          {error && <p className="text-xs text-red-800">{error}</p>}
          {displayUrl && !uploading && (
            <button
              type="button"
              className="mt-1 block text-xs underline"
              onClick={() => {
                setPreviewUrl((prev) => {
                  if (prev) URL.revokeObjectURL(prev)
                  return null
                })
                onChange(undefined)
                if (inputRef.current) inputRef.current.value = ''
              }}
            >
              Remove photo
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
