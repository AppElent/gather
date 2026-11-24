import { offersPhoto } from '@gather/core/baby-events'
import type { BabyEventType } from '@gather/core/domain'
import { useMutation } from 'convex/react'
import { useId } from 'react'
import { api } from '../../../convex/_generated/api'
import { useMessages } from '../../lib/i18n'
import { ImageUploadField } from '../photo/ImageUploadField'
import { type EntryPhoto, entryPhotoUrl } from './babyEventFormValues'

interface EntryPhotoFieldProps {
  type: BabyEventType
  /** The stored photo's URL, when editing an entry that has one. */
  photoUrl?: string | null
  value: EntryPhoto
  onChange: (photo: EntryPhoto) => void
  onUploadingChange: (uploading: boolean) => void
  disabled: boolean
}

/** The photo row of a log entry, for the types that offer one. */
export function EntryPhotoField({
  type,
  photoUrl,
  value,
  onChange,
  onUploadingChange,
  disabled,
}: EntryPhotoFieldProps) {
  const generateUploadUrl = useMutation(api.babies.generateUploadUrl)
  const { entry } = useMessages().baby.log
  // A new entry and an edit can be open on one page, each with this field.
  const fieldId = useId()
  if (!offersPhoto(type)) return null
  return (
    <ImageUploadField
      label={entry.photo}
      imageUrl={entryPhotoUrl(value, photoUrl)}
      preset="memoryPhoto"
      generateUploadUrl={generateUploadUrl}
      fieldId={fieldId}
      onChange={(id) => onChange(id ?? null)}
      onUploadingChange={onUploadingChange}
      disabled={disabled}
    />
  )
}
